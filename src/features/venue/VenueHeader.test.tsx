import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fail, fakeSupabase, ok } from '../../test/fakeSupabase';
import { renderWithProviders } from '../../test/render';
import { VenueHeader } from './VenueHeader';

function venue(name: string | null, logo_path: string | null) {
  fakeSupabase.tables.venue_settings = () => ok([{ name, logo_path }]);
}

describe('VenueHeader', () => {
  it('[venue-settings] «El comensal ve el nombre y el logo del local»', async () => {
    venue('Bar Manolo', 'venue/logo-1.png');
    renderWithProviders(<VenueHeader />, { zone: 'menu' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Bar Manolo' })).toBeInTheDocument();
    expect(screen.getByText('Menu')).toHaveClass('venue-header__subtitle');
    const logo = screen.getByRole('img', { name: 'Bar Manolo' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('venue/logo-1.png'));
  });

  it('[venue-settings] «El comensal ve un local sin logo»', async () => {
    venue('Bar Manolo', null);
    renderWithProviders(<VenueHeader />, { zone: 'menu' });
    expect(await screen.findByRole('heading', { name: 'Bar Manolo' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('[venue-settings] «El comensal ve la carta de un local sin nombre configurado»', async () => {
    venue(null, null);
    renderWithProviders(<VenueHeader />, { zone: 'menu' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Menu' })).toBeInTheDocument();
    expect(document.querySelector('.venue-header__subtitle')).toBeNull();
  });

  it('si falla la petición del local, usa el título genérico', async () => {
    fakeSupabase.tables.venue_settings = () => fail('sin conexión');
    renderWithProviders(<VenueHeader />, { zone: 'menu' });
    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument();
  });

  it('[venue-settings] «El dueño ve su local en la administración»', async () => {
    venue('Bar Manolo', 'venue/logo-1.png');
    renderWithProviders(<VenueHeader asHeading={false} />, { zone: 'admin' });
    expect(await screen.findByText('Bar Manolo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bar Manolo' })).toBeInTheDocument();
  });
});

describe('petición temprana del local', () => {
  it('usa la petición que lanzó index.html y no repite la consulta', async () => {
    (window as unknown as Record<string, unknown>).__menuNowEarlyVenue = Promise.resolve([
      { name: 'Bar Temprano', logo_path: null },
    ]);
    renderWithProviders(<VenueHeader />, { zone: 'menu' });
    expect(await screen.findByRole('heading', { name: 'Bar Temprano' })).toBeInTheDocument();
    expect(fakeSupabase.calls.filter((c) => c.table === 'venue_settings')).toHaveLength(0);
    expect((window as unknown as Record<string, unknown>).__menuNowEarlyVenue).toBeUndefined();
  });
});
