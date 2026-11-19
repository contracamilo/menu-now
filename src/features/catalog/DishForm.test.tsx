import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { adminCategory, adminDish, installCatalog } from '../../test/fakeCatalog';
import { fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { fileOf, MB, stubCanvas } from '../../test/canvas';
import { DishForm } from './DishForm';

function setup(route: string) {
  installCatalog([
    adminCategory({
      id: 'desayunos',
      name: 'Desayunos',
      position: 1,
      dishes: [adminDish({ id: 'cafe', name: 'Café', category_id: 'desayunos', position: 1 })],
    }),
    adminCategory({
      id: 'bocadillos',
      name: 'Bocadillos',
      position: 2,
      dishes: [
        adminDish({
          id: 'tostada',
          name: 'Tostada',
          category_id: 'bocadillos',
          position: 1,
          allergens: ['gluten'],
          no_allergens: false,
        }),
      ],
    }),
    adminCategory({
      id: 'bebidas',
      name: 'Bebidas',
      position: 3,
      dishes: [
        adminDish({
          id: 'cana',
          name: 'Caña',
          category_id: 'bebidas',
          position: 1,
          allergens: ['gluten'],
          no_allergens: false,
          dish_sizes: [{ id: 'cana-s1', label: null, price_cents: 180, position: 1 }],
        }),
      ],
    }),
    adminCategory({
      id: 'cocina',
      name: 'Cocina',
      position: 4,
      dishes: [
        adminDish({
          id: 'paella',
          name: 'Paella',
          category_id: 'cocina',
          position: 1,
          description: 'De marisco',
          photo_path: 'dishes/paella/vieja.jpg',
          allergens: ['crustaceans'],
          no_allergens: false,
        }),
      ],
    }),
    adminCategory({ id: 'incluidos', is_included: true, position: 5 }),
  ]);
  fakeSupabase.rpcs.save_dish = () => ok('id');
  return renderWithProviders(
    <Routes>
      <Route path="/admin" element={<p>Catálogo</p>} />
      <Route path="/admin/dishes/new" element={<DishForm />} />
      <Route path="/admin/dishes/:id" element={<DishForm />} />
    </Routes>,
    { route, zone: 'admin' },
  );
}

const saves = () => fakeSupabase.rpcCalls.filter((c) => c.name === 'save_dish');
const lastSave = () => saves().at(-1)!.args as { p_dish: Record<string, unknown>; p_sizes: Array<Record<string, unknown>> };

async function fillBasics(user: UserEvent, { name, price, allergens = [] as string[] }: { name?: string; price?: string; allergens?: string[] }) {
  const nameInput = await screen.findByLabelText('Nombre');
  if (name) await user.type(nameInput, name);
  if (price) await user.type(screen.getAllByLabelText('Precio')[0], price);
  for (const allergen of allergens) await user.click(screen.getByRole('checkbox', { name: allergen }));
}

const save = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Guardar' }));

describe('DishForm', () => {
  it('[catalog-management] «El dueño crea un plato»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    expect(await screen.findByLabelText('Categoría')).toHaveValue('bocadillos');
    await fillBasics(user, { name: 'Lomo con queso', price: '4,50', allergens: ['Gluten', 'Leche'] });
    await user.type(screen.getByLabelText('Descripción corta (opcional)'), 'Lomo a la plancha y queso manchego');
    await save(user);

    expect(await screen.findByText('Catálogo')).toBeInTheDocument();
    expect(lastSave().p_dish).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      category_id: 'bocadillos',
      name: 'Lomo con queso',
      description: 'Lomo a la plancha y queso manchego',
      included_with: null,
      photo_path: null,
      allergens: ['gluten', 'milk'],
      no_allergens: false,
    });
    expect(lastSave().p_sizes).toEqual([{ label: null, price_cents: 450 }]);
  });

  it('[catalog-management] «El dueño edita el precio de un plato»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/cana');
    const price = await screen.findByLabelText('Precio');
    expect(price).toHaveValue('1,80');
    await user.clear(price);
    await user.type(price, '2,00');
    await save(user);

    await screen.findByText('Catálogo');
    expect(lastSave().p_dish).toMatchObject({ id: 'cana', name: 'Caña', category_id: 'bebidas' });
    expect(lastSave().p_sizes).toEqual([{ id: 'cana-s1', label: null, price_cents: 200 }]);
  });

  it('[catalog-management] «El dueño crea dos platos con el mismo nombre»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bebidas');
    await fillBasics(user, { name: 'Café', price: '1,30' });
    await user.click(screen.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' }));
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_dish).toMatchObject({ name: 'Café', category_id: 'bebidas' });
  });

  it('[catalog-management] «El dueño guarda un plato sin descripción ni foto»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=desayunos');
    await fillBasics(user, { name: 'Café solo', price: '1,20' });
    await user.click(screen.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' }));
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_dish).toMatchObject({ description: null, photo_path: null });
  });

  it('[catalog-management] «El dueño intenta guardar un plato sin nombre»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=desayunos');
    await fillBasics(user, { price: '1,20', allergens: ['Leche'] });
    await save(user);
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(saves()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño crea un plato con varios tamaños»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Croquetas', allergens: ['Gluten'] });
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    const labels = screen.getAllByLabelText(/^Tamaño/);
    const prices = screen.getAllByLabelText('Precio');
    for (const [i, [label, price]] of [['Una', '1,50'], ['Ración', '7,00'], ['Plato', '12']].entries()) {
      await user.type(labels[i], label);
      await user.type(prices[i], price);
    }
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_sizes).toEqual([
      { label: 'Una', price_cents: 150 },
      { label: 'Ración', price_cents: 700 },
      { label: 'Plato', price_cents: 1200 },
    ]);
  });

  it('reordena y quita tamaños', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Croquetas', allergens: ['Gluten'] });
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    const labels = screen.getAllByLabelText(/^Tamaño/);
    const prices = screen.getAllByLabelText('Precio');
    for (const [i, [label, price]] of [['Una', '1,50'], ['Ración', '7'], ['Plato', '12']].entries()) {
      await user.type(labels[i], label);
      await user.type(prices[i], price);
    }
    await user.click(screen.getByRole('button', { name: 'Subir Plato' }));
    await user.click(screen.getByRole('button', { name: 'Quitar tamaño Una' }));
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_sizes.map((s) => s.label)).toEqual(['Plato', 'Ración']);
  });

  it('[catalog-management] «El dueño intenta guardar varios tamaños sin nombre»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Croquetas', price: '1,50', allergens: ['Gluten'] });
    await user.type(screen.getAllByLabelText(/^Tamaño/)[0], 'Una');
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    await user.type(screen.getAllByLabelText('Precio')[1], '7');
    await save(user);
    expect(await screen.findByText('Si hay varios tamaños, cada uno necesita un nombre.')).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it('rechaza nombres de tamaño repetidos', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Croquetas', price: '1,50', allergens: ['Gluten'] });
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    await user.type(screen.getAllByLabelText(/^Tamaño/)[0], 'Ración');
    await user.type(screen.getAllByLabelText(/^Tamaño/)[1], 'ración');
    await user.type(screen.getAllByLabelText('Precio')[1], '7');
    await save(user);
    expect(await screen.findByText('Ya hay un tamaño con ese nombre en este plato.')).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño intenta poner un precio de 0 € fuera de "Incluidos"»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Gratis', price: '0', allergens: ['Gluten'] });
    await save(user);
    expect(
      await screen.findByText('El precio debe ser mayor que cero. Lo que va sin precio se pone en «Incluidos».'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Precio')).toHaveAttribute('aria-invalid', 'true');
    expect(saves()).toHaveLength(0);
  });

  it('rechaza un precio con texto o más de dos decimales', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Raro', price: '2,505', allergens: ['Gluten'] });
    await save(user);
    expect(await screen.findByText('El precio debe ser mayor que cero, con como máximo dos decimales.')).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño crea un plato incluido»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Tapa del día', allergens: ['Gluten'] });
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Incluidos');
    expect(screen.queryByLabelText('Precio')).not.toBeInTheDocument();
    expect(screen.getByText('Por ejemplo: «Con cada bebida». Se muestra en lugar del precio.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('¿Con qué compra se incluye?'), 'Con cada bebida');
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_dish).toMatchObject({ category_id: 'incluidos', included_with: 'Con cada bebida' });
    expect(lastSave().p_sizes).toEqual([]);
  });

  it('[catalog-management] «El dueño intenta guardar un plato incluido sin indicar la compra»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=incluidos');
    await fillBasics(user, { name: 'Tapa del día', allergens: ['Gluten'] });
    await save(user);
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Con qué compra se incluye?')).toHaveAttribute('aria-invalid', 'true');
    expect(saves()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño guarda un plato declarado sin alérgenos»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bebidas');
    await fillBasics(user, { name: 'Agua mineral', price: '1,50' });
    await user.click(screen.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' }));
    await save(user);
    await screen.findByText('Catálogo');
    expect(lastSave().p_dish).toMatchObject({ allergens: [], no_allergens: true });
  });

  it('[catalog-management] «El dueño intenta guardar un plato sin declaración de alérgenos»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await fillBasics(user, { name: 'Ensaladilla', price: '3,50' });
    await save(user);
    expect(
      await screen.findByText('Marca los alérgenos del plato o «No contiene alérgenos de declaración obligatoria».'),
    ).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it('[catalog-management] «El dueño no puede combinar alérgenos y "no contiene alérgenos"»', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/tostada');
    const gluten = await screen.findByRole('checkbox', { name: 'Gluten' });
    expect(gluten).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' }));
    expect(gluten).not.toBeChecked();
    await user.click(gluten);
    expect(screen.getByRole('checkbox', { name: 'No contiene alérgenos de declaración obligatoria' })).not.toBeChecked();
  });

  it('muestra los errores en inglés si la administración está en inglés', async () => {
    localStorage.setItem('menu-now.lang.admin', 'en');
    const user = userEvent.setup();
    setup('/admin/dishes/new?category=bocadillos');
    await user.type(await screen.findByLabelText('Name'), 'Gratis');
    await user.type(screen.getByLabelText('Price'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The price must be greater than zero. Items with no price go in "Included".')).toBeInTheDocument();
  });

  describe('foto del plato', () => {
    it('[catalog-management] «El dueño intenta subir una foto de más de 5 MB»: resto del formulario intacto', async () => {
      const user = userEvent.setup();
      setup('/admin/dishes/paella');
      const name = await screen.findByLabelText('Nombre');
      await user.clear(name);
      await user.type(name, 'Paella valenciana');
      await user.upload(screen.getByLabelText('Cambiar foto'), fileOf(7 * MB, 'image/jpeg', 'paella.jpg'));

      const photoField = screen.getByRole('group', { name: 'Foto (opcional)' });
      expect(await within(photoField).findByRole('alert')).toHaveTextContent(
        'La imagen pesa demasiado. El tamaño máximo es 5 MB.',
      );
      expect(screen.getByLabelText('Nombre')).toHaveValue('Paella valenciana');
      expect(screen.getByLabelText('Descripción corta (opcional)')).toHaveValue('De marisco');
      expect(screen.getByRole('checkbox', { name: 'Crustáceos' })).toBeChecked();
      expect(fakeSupabase.storageCalls).toHaveLength(0);
    });

    it('[catalog-management] «El dueño quita la foto de un plato»: photo_path a null', async () => {
      const user = userEvent.setup();
      setup('/admin/dishes/paella');
      await user.click(await screen.findByRole('button', { name: 'Quitar foto' }));
      expect(screen.getByLabelText('Elegir foto')).toBeInTheDocument();
      await save(user);
      await screen.findByText('Catálogo');
      expect(lastSave().p_dish).toMatchObject({ id: 'paella', photo_path: null });
      expect(fakeSupabase.storageCalls).toEqual([{ op: 'remove', path: ['dishes/paella/vieja.jpg'] }]);
    });

    it('sustituye la foto: sube la nueva redimensionada y borra la anterior', async () => {
      stubCanvas();
      const user = userEvent.setup();
      setup('/admin/dishes/paella');
      await user.upload(await screen.findByLabelText('Cambiar foto'), fileOf(2 * MB, 'image/png', 'paella.png'));
      await waitFor(() => expect(document.querySelector('.image-preview')).toHaveAttribute('src', expect.stringMatching(/^blob:/)));
      await save(user);
      await screen.findByText('Catálogo');

      const upload = fakeSupabase.storageCalls.find((c) => c.op === 'upload')!;
      expect(upload.path).toMatch(/^dishes\/paella\/[0-9a-f-]{36}\.jpg$/);
      expect((upload.body as Blob).type).toBe('image/jpeg');
      expect(lastSave().p_dish.photo_path).toBe(upload.path);
      expect(fakeSupabase.storageCalls.at(-1)).toEqual({ op: 'remove', path: ['dishes/paella/vieja.jpg'] });
    });
  });

  it('[catalog-management] «El dueño gestiona el catálogo desde su móvil»: todos los botones y casillas tienen área táctil', async () => {
    const user = userEvent.setup();
    setup('/admin/dishes/paella');
    await screen.findByLabelText('Nombre');
    await user.click(screen.getByRole('button', { name: 'Añadir tamaño' }));
    const buttons = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
    for (const button of buttons) expect(button).toHaveClass('tap-target');
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox.closest('label')).toHaveClass('checkbox');
    // La foto se elige con un botón (label) que también tiene área táctil
    expect(screen.getByLabelText('Cambiar foto').closest('label')).toHaveClass('tap-target');
  });
});
