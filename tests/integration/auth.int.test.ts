import { afterAll, describe, expect, it } from 'vitest';
import { anonClient, createUser, deleteUser, mailText, mailsTo, uniqueEmail, waitForMail } from './localSupabase';

const REDIRECT_TO = 'http://127.0.0.1:5173/admin/reset-password';

/** Abre el enlace del correo como lo haría el navegador y devuelve el fragmento de la redirección. */
async function followRecoveryLink(link: string): Promise<URLSearchParams> {
  const response = await fetch(link, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';
  const url = new URL(location);
  return new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
}

function extractLink(text: string): string {
  const match = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/.exec(text);
  if (!match) throw new Error('El correo no contiene enlace de verificación');
  return match[0].replace(/&amp;/g, '&');
}

describe('Supabase Auth (integración)', () => {
  const ownerEmail = uniqueEmail('dueno');
  let ownerId: string | undefined;

  afterAll(async () => {
    await deleteUser(ownerId);
  });

  it('[backoffice-access] «Nadie puede registrarse desde la aplicación»: el alta fuera de la interfaz es rechazada', async () => {
    const email = uniqueEmail('intruso');
    const { data, error } = await anonClient().auth.signUp({ email, password: 'una-contrasena-larga' });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
    const { error: signInError } = await anonClient().auth.signInWithPassword({ email, password: 'una-contrasena-larga' });
    expect(signInError).not.toBeNull();
  });

  it('[backoffice-access] «El dueño pide restablecer su contraseña», «El dueño crea una contraseña nueva» y «El dueño usa un enlace caducado o ya usado»', async () => {
    ownerId = await createUser(ownerEmail, 'contrasena-vieja', { owner: true });

    // Pide el enlace: llega un correo con enlace a /admin/reset-password
    const { error } = await anonClient().auth.resetPasswordForEmail(ownerEmail, { redirectTo: REDIRECT_TO });
    expect(error).toBeNull();
    const mail = await waitForMail(ownerEmail);
    const link = extractLink(await mailText(mail.ID));
    expect(new URL(link).searchParams.get('redirect_to')).toBe(REDIRECT_TO);

    // Abre el enlace → sesión de recuperación
    const fragment = await followRecoveryLink(link);
    expect(fragment.get('type')).toBe('recovery');
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    expect(accessToken).toBeTruthy();

    // Una contraseña de menos de 8 caracteres se rechaza también en el servidor
    const recovery = anonClient();
    await recovery.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
    const short = await recovery.auth.updateUser({ password: 'corta' });
    expect(short.error).not.toBeNull();

    // Guarda la contraseña nueva
    const updated = await recovery.auth.updateUser({ password: 'contrasena-nueva' });
    expect(updated.error).toBeNull();

    // La anterior deja de servir; la nueva sí
    const old = await anonClient().auth.signInWithPassword({ email: ownerEmail, password: 'contrasena-vieja' });
    expect(old.error).not.toBeNull();
    const fresh = await anonClient().auth.signInWithPassword({ email: ownerEmail, password: 'contrasena-nueva' });
    expect(fresh.error).toBeNull();

    // El mismo enlace no se puede reutilizar
    const reused = await followRecoveryLink(link);
    expect(reused.get('access_token')).toBeNull();
    expect(reused.get('error') ?? reused.get('error_code')).toBeTruthy();
  });

  it('[backoffice-access] «Se pide restablecer la contraseña de un correo sin cuenta»: no se envía ningún enlace', async () => {
    const email = uniqueEmail('sin-cuenta');
    await anonClient().auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(await mailsTo(email)).toHaveLength(0);
  });
});
