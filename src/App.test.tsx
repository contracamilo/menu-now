import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithProviders } from './test/render';

describe('App', () => {
  it('renderiza la carta en /', async () => {
    renderWithProviders(<App />, { route: '/' });
    expect(await screen.findByRole('main')).toBeInTheDocument();
  });

  it('muestra la página 404 en una ruta desconocida', async () => {
    renderWithProviders(<App />, { route: '/no-existe' });
    expect(await screen.findByRole('heading', { name: "This page doesn't exist." })).toBeInTheDocument();
  });

  it('carga la administración de forma diferida en /admin', async () => {
    renderWithProviders(<App />, { route: '/admin/no-existe' });
    expect(await screen.findByRole('heading', { name: 'Esta página no existe.' })).toBeInTheDocument();
  });
});
