import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Solo para preparar y limpiar: rol de servicio del Supabase LOCAL.
const status = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now().toString(36);
// Una mesa por prueba: los nombres de mesa activa no se pueden repetir
const TABLES = [`E2E ${stamp} A`, `E2E ${stamp} B`];

// Platos de la carta de referencia (supabase/seed.sql) que el dueño toca durante la prueba
const ARCHIVED_DISH = 'Porras';
const REPRICED_DISH = 'Croissant a la plancha';
let restore: { archivedId: string; repricedSizeId: string; repricedCents: number } | null = null;

test.beforeAll(async () => {
  const { data: dishes } = await admin
    .from('dishes')
    .select('id,name,dish_sizes(id,price_cents)')
    .in('name', [ARCHIVED_DISH, REPRICED_DISH]);
  const archived = dishes!.find((d) => d.name === ARCHIVED_DISH)!;
  const repriced = dishes!.find((d) => d.name === REPRICED_DISH)!;
  restore = {
    archivedId: archived.id,
    repricedSizeId: repriced.dish_sizes[0].id,
    repricedCents: repriced.dish_sizes[0].price_cents,
  };
});

test.afterAll(async () => {
  // La app no permite borrar pedidos ni mesas: la limpieza se hace con el rol de servicio
  const { data: tables } = await admin.from('tables').select('id').in('name', TABLES);
  const ids = (tables ?? []).map((t) => t.id);
  if (ids.length) {
    await admin.from('orders').delete().in('table_id', ids);
    await admin.from('tables').delete().in('id', ids);
  }
  if (restore) {
    await admin.from('dishes').update({ archived_at: null }).eq('id', restore.archivedId);
    await admin.from('dish_sizes').update({ price_cents: restore.repricedCents }).eq('id', restore.repricedSizeId);
  }
});

async function ownerSignsIn(owner: Page) {
  await owner.goto('/admin/tables');
  await owner.getByLabel('Correo electrónico').fill('owner1@menu-now.test');
  await owner.getByLabel('Contraseña').fill('menu-now-dev');
  await owner.getByRole('button', { name: 'Entrar' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Mesas' })).toBeVisible();
}

/** El dueño crea la mesa y devuelve la URL que codifica su QR. */
async function ownerCreatesTable(owner: Page, TABLE: string): Promise<string> {
  await owner.getByRole('link', { name: 'Nueva mesa' }).click();
  await owner.getByLabel(/^Nombre de la mesa/).fill(TABLE);
  await owner.getByRole('button', { name: 'Guardar' }).click();
  await expect(owner).toHaveURL(/\/admin\/tables$/);
  await expect(owner.getByRole('list', { name: 'Mesas' }).getByRole('heading', { name: TABLE })).toBeVisible();

  await owner.getByRole('link', { name: `Ver QR de ${TABLE}` }).click();
  await expect(owner.getByRole('heading', { level: 1, name: TABLE })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Imprimir' })).toBeVisible();
  const url = await owner.locator('svg.qr-card__code').getAttribute('data-url');
  expect(url).toMatch(/\/t\/[0-9a-f-]{36}$/);
  return url!;
}

async function newDiner(browser: Browser, url: string, TABLE: string) {
  const diner = await (await browser.newContext()).newPage();
  await diner.goto(url);
  await expect(diner.getByText(`Table: ${TABLE}`)).toBeVisible();
  return diner;
}

const addButton = (diner: Page, dish: string) => diner.getByRole('button', { name: `Add ${dish}`, exact: true });

async function openSummary(diner: Page) {
  await diner.getByRole('link', { name: /^View order/ }).click();
  await expect(diner.getByRole('heading', { level: 1, name: 'Your order' })).toBeVisible();
}

const orderNumber = (diner: Page) => diner.getByRole('heading', { level: 1, name: /^Order no\. \d+$/ });

// Cubre: [table-management] «El dueño crea una mesa», «El dueño imprime el QR de una mesa»;
// [table-ordering] «El comensal confirma su pedido».
test('el dueño crea una mesa y el comensal pide desde su QR', async ({ page: owner, browser }) => {
  const TABLE = TABLES[0];
  await ownerSignsIn(owner);
  const url = await ownerCreatesTable(owner, TABLE);

  const diner = await newDiner(browser, url, TABLE);
  await addButton(diner, 'Tostada con tomate').click();
  await diner.getByRole('dialog', { name: 'Choose a size for Tostada con tomate' }).getByRole('button', { name: 'Entera · €2.50' }).click();
  await expect(diner.getByRole('link', { name: 'View order · 1 · €2.50' })).toBeVisible();

  await openSummary(diner);
  await diner.getByLabel(/^Note \(optional\)/).fill('Poco tostada');
  await diner.getByRole('button', { name: 'Confirm order' }).click();

  await expect(orderNumber(diner)).toBeVisible();
  await expect(diner.getByText(`Table: ${TABLE}`)).toBeVisible();
  await expect(diner.getByText('1 × Tostada con tomate · Entera')).toBeVisible();
  await expect(diner.getByText('Poco tostada')).toBeVisible();
  await expect(diner.getByText('Status: Received')).toBeVisible();
  // Sin ningún dato personal: no hay campos de nombre, correo ni teléfono en todo el flujo
  await expect(diner.getByRole('textbox')).toHaveCount(0);
});

// Cubre: [table-ordering] «Un plato se archiva mientras el comensal decide»,
// «El dueño cambia un precio mientras el comensal decide», «El dueño archiva la mesa mientras el comensal decide».
test('los cambios del dueño mientras el comensal decide', async ({ page: owner, browser }) => {
  const TABLE = TABLES[1];
  await ownerSignsIn(owner);
  const url = await ownerCreatesTable(owner, TABLE);
  const diner = await newDiner(browser, url, TABLE);

  // --- El dueño archiva un plato del pedido ---------------------------------------------
  await addButton(diner, ARCHIVED_DISH).click();
  await addButton(diner, 'Bizcocho casero').click();
  await openSummary(diner);

  await owner.goto('/admin');
  await owner.getByRole('button', { name: `Archivar ${ARCHIVED_DISH}`, exact: true }).click();
  await expect(owner.getByRole('link', { name: `Editar ${ARCHIVED_DISH}` }).first()).toBeVisible();

  await diner.getByRole('button', { name: 'Confirm order' }).click();
  await expect(diner.getByRole('alert')).toContainText(`have been removed from your order: ${ARCHIVED_DISH}`);
  await expect(diner.getByRole('heading', { level: 2 })).toHaveText(['Bizcocho casero']);
  await expect(diner.locator('.order-total')).toContainText('€2.00');
  await diner.getByRole('button', { name: 'Confirm order' }).click();
  await expect(orderNumber(diner)).toBeVisible();
  await expect(diner.getByText('1 × Bizcocho casero')).toBeVisible();

  // --- El dueño cambia un precio ---------------------------------------------------------
  await diner.getByRole('link', { name: 'Back to the menu' }).click();
  await addButton(diner, REPRICED_DISH).click();
  await openSummary(diner);
  await expect(diner.locator('.order-total')).toContainText('€2.20');

  await owner.getByRole('link', { name: `Editar ${REPRICED_DISH}` }).click();
  await owner.getByLabel('Precio').fill('2,40');
  await owner.getByRole('button', { name: 'Guardar' }).click();
  await expect(owner.getByText('Cambios guardados. Ya se ven en la carta.')).toBeVisible();

  await diner.getByRole('button', { name: 'Confirm order' }).click();
  await expect(diner.getByRole('alert')).toContainText(`The price has changed for: ${REPRICED_DISH}`);
  await expect(diner.locator('.order-total')).toContainText('€2.40');
  await diner.getByRole('button', { name: 'Confirm order' }).click();
  await expect(orderNumber(diner)).toBeVisible();
  await expect(diner.locator('.order-total')).toContainText('€2.40');

  // --- El dueño archiva la mesa ----------------------------------------------------------
  await diner.getByRole('link', { name: 'Back to the menu' }).click();
  await addButton(diner, 'Bizcocho casero').click();
  await openSummary(diner);

  await owner.goto('/admin/tables');
  await owner.getByRole('button', { name: `Archivar ${TABLE}` }).click();
  await expect(owner.getByRole('button', { name: `Reactivar ${TABLE}` })).toBeVisible();

  await diner.getByRole('button', { name: 'Confirm order' }).click();
  await expect(diner.getByRole('alert')).toContainText('Orders can no longer be placed from this table. Please ask the staff.');
  await expect(diner.getByRole('button', { name: 'Confirm order' })).toHaveCount(0);
});
