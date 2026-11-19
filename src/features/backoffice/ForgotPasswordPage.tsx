import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n/useT';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

/** Pide el enlace de restablecimiento. Siempre el mismo mensaje, exista o no la cuenta (design D9). */
export function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
    } catch {
      /* el resultado no se revela */
    }
    setPending(false);
    setSent(true);
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {sent ? (
        <p role="status" className="message message--success">
          {t('auth.resetSent')}
        </p>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="forgot-email">{t('auth.email')}</label>
            <input
              id="forgot-email"
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="button tap-target button--primary" disabled={pending}>
            {t('auth.resetRequest')}
          </button>
        </form>
      )}
      <p>
        <Link className="tap-target" to="/admin/login">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
