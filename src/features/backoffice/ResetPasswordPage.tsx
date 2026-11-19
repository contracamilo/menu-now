import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { useSession } from './session';

export const PASSWORD_MIN = 8;

/**
 * Destino del enlace del correo (design D9). supabase-js convierte el enlace en una sesión de
 * recuperación (evento PASSWORD_RECOVERY); sin sesión válida —enlace caducado o ya usado— no
 * se puede cambiar la contraseña.
 */
export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const { status, session } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  if (status === 'loading') return null;

  if (!session || invalid) {
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <p role="alert" className="message message--error">
          {t('auth.resetInvalid')}
        </p>
        <Link className="tap-target" to="/admin/forgot-password">
          {t('auth.forgot')}
        </Link>
      </AuthLayout>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < PASSWORD_MIN) {
      setError('error.passwordShort');
      return;
    }
    setError(null);
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      if (/session/i.test(updateError.message)) setInvalid(true);
      else setError(/least|short|weak/i.test(updateError.message) ? 'error.passwordShort' : 'form.saveError');
      return;
    }
    navigate('/admin', { replace: true, state: { notice: 'auth.resetDone' } });
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="reset-password">{t('auth.newPassword')}</label>
          <input
            id="reset-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby="reset-password-error"
            onChange={(e) => setPassword(e.target.value)}
          />
          <span id="reset-password-error" role="alert" className="message message--error">
            {error && t(error)}
          </span>
        </div>
        <button type="submit" className="button tap-target button--primary" disabled={pending}>
          {t('auth.resetSave')}
        </button>
      </form>
    </AuthLayout>
  );
}
