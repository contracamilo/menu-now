import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Solo para limpiar: rol de servicio del Supabase LOCAL.
const status = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Mesa sembrada en supabase/seed.sql
const TABLE = 'Mesa 1';
const TABLE_URL = '/t/00000000-0000-4000-8000-0000000000f1';
const startedAt = new Date().toISOString();

test.afterAll(async () => {
  // La app no permite borrar pedidos: se quitan los de esta prueba con el rol de servicio
  const { data: table } = await admin.from('tables').select('id').eq('name', TABLE).single();
  if (table) await admin.from('orders').delete().eq('table_id', table.id).gte('created_at', startedAt);
});

async function staffSignsIn(browser: Browser): Promise<Page> {
  const staff = await (await browser.newContext()).newPage();
  await staff.goto('/admin/kitchen');
  await staff.getByLabel('Correo electrónico').fill('staff@menu-now.test');
  await staff.getByLabel('Contraseña').fill('menu-now-dev');
  await staff.getByRole('button', { name: 'Entrar' }).click();
  await expect(staff.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
  await expect(staff).toHaveURL(/\/admin\/kitchen$/);
  return staff;
}

/** El comensal pide una tostada entera y devuelve el número de pedido. */
async function dinerOrders(diner: Page): Promise<number> {
  await diner.goto(TABLE_URL);
  await expect(diner.getByText(`Table: ${TABLE}`)).toBeVisible();
  await diner.getByRole('button', { name: 'Add Tostada con tomate', exact: true }).click();
  await diner.getByRole('dialog', { name: 'Choose a size for Tostada con tomate' }).getByRole('button', { name: /^Entera/ }).click();
  await diner.getByRole('link', { name: /^View order/ }).click();
  await diner.getByRole('button', { name: 'Confirm order' }).click();
  const heading = diner.getByRole('heading', { level: 1, name: /^Order no\. \d+$/ });
  await expect(heading).toBeVisible();
  return Number((await heading.textContent())!.match(/\d+/)![0]);
}

const kitchenCard = (staff: Page, number: number) =>
  staff.locator('article').filter({ has: staff.getByRole('heading', { name: `Nº ${number}`, exact: true }) });

/** El comensal vuelve a «Mis pedidos» desde la carta y mira el estado de su pedido. */
async function dinerChecks(diner: Page, number: number, statusText: string) {
  await diner.goto(TABLE_URL);
  await diner.getByRole('link', { name: 'My orders' }).click();
  await expect(diner.getByRole('link', { name: new RegExp(`Order no\\. ${number}\\b`) })).toContainText(`Status: ${statusText}`);
}

// Cubre: [kitchen-panel] «Llega un pedido mientras el panel está abierto», «El pedido sale a la mesa»,
// «El personal cancela un pedido recibido»; [table-ordering] «El comensal comprueba si su pedido está en marcha»,
// «El comensal ve que su pedido se ha cancelado».
test('del pedido del comensal al panel de cocina y de vuelta', async ({ browser }) => {
  const staff = await staffSignsIn(browser);
  const diner = await (await browser.newContext()).newPage();

  // El pedido aparece en el panel sin recargar, resaltado como nuevo
  const first = await dinerOrders(diner);
  const card = kitchenCard(staff, first);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText('Nuevo')).toBeVisible();
  await expect(card.getByText('Recibido')).toBeVisible();
  await expect(card.getByText(TABLE, { exact: true })).toBeVisible();
  await expect(card.getByText('1 × Tostada con tomate · Entera')).toBeVisible();

  // Empezar → el comensal lo ve «En preparación» al volver a «Mis pedidos»
  await staff.getByRole('button', { name: `Empezar el pedido nº ${first}` }).click();
  await expect(card.getByText('En preparación')).toBeVisible();
  await dinerChecks(diner, first, 'Being prepared');

  // Servido → sale de la vista activa, pasa al histórico y el comensal lo ve «Servido»
  await staff.getByRole('button', { name: `Marcar como servido el pedido nº ${first}` }).click();
  await expect(card).toHaveCount(0);
  await staff.getByRole('link', { name: /^Histórico de hoy/ }).click();
  await expect(kitchenCard(staff, first).getByText(/^Servido a las \d\d:\d\d$/)).toBeVisible();
  await dinerChecks(diner, first, 'Served');

  // Un segundo pedido que el personal cancela
  await staff.getByRole('link', { name: /^Pendientes/ }).click();
  const second = await dinerOrders(diner);
  await expect(kitchenCard(staff, second)).toBeVisible({ timeout: 15_000 });
  await staff.getByRole('button', { name: `Cancelar el pedido nº ${second}` }).click();
  const dialog = staff.getByRole('dialog', { name: `¿Cancelar el pedido nº ${second} de ${TABLE}? No se puede deshacer.` });
  await dialog.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(kitchenCard(staff, second)).toHaveCount(0);
  await staff.getByRole('link', { name: /^Histórico de hoy/ }).click();
  await expect(kitchenCard(staff, second).getByText(/^Cancelado a las \d\d:\d\d$/)).toBeVisible();

  // El comensal abre el detalle del pedido cancelado
  await dinerChecks(diner, second, 'Cancelled');
  await diner.getByRole('link', { name: new RegExp(`Order no\\. ${second}\\b`) }).click();
  await expect(diner.getByText('Status: Cancelled')).toBeVisible();
  await expect(diner.getByText('This order has been cancelled. If you have any questions, please ask the staff.')).toBeVisible();
});
