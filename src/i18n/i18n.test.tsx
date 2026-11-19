import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider, translate, type Zone } from './I18nProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useT } from './useT';
import { es } from './es';
import { en } from './en';

function Title() {
  return <h1>{useT()('menu.title')}</h1>;
}

function renderZone(zone: Zone) {
  return render(
    <I18nProvider zone={zone}>
      <Title />
      <LanguageSwitcher />
    </I18nProvider>,
  );
}

describe('i18n', () => {
  it('la carta arranca en inglés', () => {
    renderZone('menu');
    expect(screen.getByRole('heading')).toHaveTextContent('Menu');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('la administración arranca en español', () => {
    renderZone('admin');
    expect(screen.getByRole('heading')).toHaveTextContent('Carta');
    expect(document.documentElement.lang).toBe('es');
  });

  it('cambia de idioma y recuerda la elección de cada zona por separado', async () => {
    const user = userEvent.setup();
    const menu = renderZone('menu');
    await user.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Carta');
    expect(document.documentElement.lang).toBe('es');
    menu.unmount();

    const admin = renderZone('admin');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Menu');
    admin.unmount();

    // Tras volver a montar, cada zona conserva su propia elección
    const menuAgain = renderZone('menu');
    expect(screen.getByRole('heading')).toHaveTextContent('Carta');
    menuAgain.unmount();
    renderZone('admin');
    expect(screen.getByRole('heading')).toHaveTextContent('Menu');
  });

  it('funciona aunque localStorage no esté disponible', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('bloqueado');
      },
    });
    try {
      const user = userEvent.setup();
      renderZone('menu');
      expect(screen.getByRole('heading')).toHaveTextContent('Menu');
      await user.click(screen.getByRole('button', { name: 'Español' }));
      expect(screen.getByRole('heading')).toHaveTextContent('Carta');
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('interpola variables', () => {
    expect(translate('es', 'admin.moveUp', { name: 'Caña' })).toBe('Subir Caña');
    expect(translate('en', 'form.charCount', { count: 3, max: 40 })).toBe('3/40');
  });

  it('en.ts tiene exactamente las mismas claves que es.ts', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});
