import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
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
const CATEGORY = `E2E Raciones ${stamp}`;
const SIZED = `E2E Croquetas ${stamp}`;
const SINGLE = `E2E Patatas ${stamp}`;
const INCLUDED = `E2E Tapa ${stamp}`;
const VENUE = `Bar E2E ${stamp}`;

let originalVenue: { name: string | null; logo_path: string | null } | null = null;

test.beforeAll(async () => {
  const { data } = await admin.from('venue_settings').select('name,logo_path').single();
  originalVenue = data;
});

test.afterAll(async () => {
  // La app no permite borrar; la limpieza de los datos de prueba se hace con el rol de servicio
  await admin.from('dishes').delete().like('name', `E2E % ${stamp}`);
  await admin.from('categories').delete().eq('name', CATEGORY);
  if (originalVenue) await admin.from('venue_settings').update(originalVenue).eq('id', true);
});

async function saveAndBackToCatalog(owner: Page) {
  await owner.getByRole('button', { name: 'Guardar' }).click();
  await expect(owner).toHaveURL(/\/admin$/);
  await expect(owner.getByText('Cambios guardados. Ya se ven en la carta.')).toBeVisible();
}

const dinerDishes = (diner: Page) =>
  diner.getByRole('region', { name: CATEGORY }).getByRole('article').getByRole('heading', { level: 3 });

// Cubre: [menu] «Un plato archivado desaparece de la carta», «Una categoría se queda sin platos activos»;
// [catalog-management] «El dueño crea un plato», «El dueño crea un plato incluido»;
// [venue-settings] «El comensal ve el nombre y el logo del local».
test('el dueño gestiona la carta y el comensal ve los cambios', async ({ page: owner, browser }) => {
  const diner = await (await browser.newContext()).newPage();

  // --- El dueño inicia sesión ------------------------------------------------------
  await owner.goto('/admin');
  await expect(owner).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await owner.getByLabel('Correo electrónico').fill('owner1@menu-now.test');
  await owner.getByLabel('Contraseña').fill('menu-now-dev');
  await owner.getByRole('button', { name: 'Entrar' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Mi carta' })).toBeVisible();

  // --- Pone el nombre del local -------------------------------------------------------
  await owner.getByRole('link', { name: 'Mi local' }).click();
  await owner.getByLabel('Nombre del local').fill(VENUE);
  await owner.getByRole('button', { name: 'Guardar' }).click();
  await expect(owner.getByText('Cambios guardados. Ya se ven en la carta.')).toBeVisible();

  // --- Crea una categoría y un plato con dos tamaños ------------------------------------
  await owner.getByRole('link', { name: 'Mi carta' }).click();
  await owner.getByRole('link', { name: 'Nueva categoría' }).click();
  await owner.getByLabel('Nombre').fill(CATEGORY);
  await saveAndBackToCatalog(owner);

  await owner.getByRole('link', { name: `Nuevo plato (${CATEGORY})` }).click();
  await owner.getByLabel('Nombre').fill(SIZED);
  await owner.getByRole('button', { name: 'Añadir tamaño' }).click();
  await owner.getByLabel(/^Tamaño/).nth(0).fill('Media');
  await owner.getByLabel('Precio').nth(0).fill('4');
  await owner.getByLabel(/^Tamaño/).nth(1).fill('Ración');
  await owner.getByLabel('Precio').nth(1).fill('7,50');
  await owner.getByRole('checkbox', { name: 'Gluten' }).check();
  await owner.getByRole('checkbox', { name: 'Leche' }).check();
  await saveAndBackToCatalog(owner);

  await owner.getByRole('link', { name: `Nuevo plato (${CATEGORY})` }).click();
  await owner.getByLabel('Nombre').fill(SINGLE);
  await owner.getByLabel('Precio').fill('3,20');
  await owner.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' }).check();
  await saveAndBackToCatalog(owner);

  // --- Crea un plato incluido -----------------------------------------------------------
  await owner.getByRole('link', { name: 'Nuevo plato (Incluidos)' }).click();
  await owner.getByLabel('Nombre').fill(INCLUDED);
  await owner.getByLabel('¿Con qué compra se incluye?').fill('Con cada bebida');
  await owner.getByRole('checkbox', { name: 'Gluten' }).check();
  await saveAndBackToCatalog(owner);

  // --- El comensal lo ve ---------------------------------------------------------------
  await diner.goto('/');
  await expect(diner.getByRole('heading', { level: 1, name: VENUE })).toBeVisible();
  await expect(diner.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: CATEGORY })).toBeVisible();
  const sized = diner.getByRole('article', { name: SIZED });
  await expect(sized.getByRole('listitem')).toHaveText(['Media · €4.00', 'Ración · €7.50', 'Gluten', 'Milk']);
  const included = diner.getByRole('region', { name: 'Included' }).getByRole('article', { name: INCLUDED });
  await expect(included).toContainText('Con cada bebida');
  await expect(included).not.toContainText('€');
  await expect(dinerDishes(diner)).toHaveText([SIZED, SINGLE]);

  // --- El dueño cambia el orden y el comensal lo ve -------------------------------------
  await owner.getByRole('button', { name: `Subir ${SINGLE}` }).click();
  await expect(owner.getByRole('button', { name: `Subir ${SINGLE}` })).toBeDisabled();
  await diner.reload();
  await expect(dinerDishes(diner)).toHaveText([SINGLE, SIZED]);

  // --- [menu] «Un plato archivado desaparece de la carta»: el resto sigue ------------------
  await owner.getByRole('button', { name: `Archivar ${SIZED}` }).click();
  await expect(owner.getByRole('button', { name: `Reactivar ${SIZED}` })).toBeVisible();
  await diner.reload();
  await expect(diner.getByRole('article', { name: SIZED })).toHaveCount(0);
  await expect(dinerDishes(diner)).toHaveText([SINGLE]);

  // --- [menu] «Una categoría se queda sin platos activos»: desaparece de la carta y del índice
  await owner.getByRole('button', { name: `Archivar ${SINGLE}` }).click();
  await expect(owner.getByText('Sin platos activos: no se muestra en la carta.').first()).toBeVisible();
  await diner.reload();
  await expect(diner.getByRole('heading', { level: 1, name: VENUE })).toBeVisible();
  await expect(diner.getByRole('heading', { level: 2, name: CATEGORY })).toHaveCount(0);
  await expect(diner.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: CATEGORY })).toHaveCount(0);
});
