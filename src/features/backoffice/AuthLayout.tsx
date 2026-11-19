import type { ReactNode } from 'react';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';

/** Marco de las pantallas públicas de la administración (inicio de sesión y restablecimiento). */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page auth-page">
      <div className="auth-page__lang">
        <LanguageSwitcher />
      </div>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
