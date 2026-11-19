import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useT } from '../../i18n/useT';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { safeNext, useSession } from './session';

/** Inicio de sesión del dueño (design D9). No hay enlace de registro. */
export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { session } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to={next} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (signInError) {
      // Mensaje genérico: no se distingue «correo inexistente» de «contraseña incorrecta»
      setError(true);
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <AuthLayout title={t('auth.title')}>
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="login-email">{t('auth.email')}</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">{t('auth.password')}</label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p role="alert" className="message message--error">
          {error && t('auth.invalid')}
        </p>
        <button type="submit" className="button tap-target button--primary" disabled={pending}>
          {t('auth.submit')}
        </button>
      </form>
      <p>
        <Link className="tap-target" to="/admin/forgot-password">
          {t('auth.forgot')}
        </Link>
      </p>
    </AuthLayout>
  );
}
