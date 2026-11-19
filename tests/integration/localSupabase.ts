import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Datos del Supabase local que imprime `supabase status`
const status = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);

export const API_URL = status.API_URL;
export const ANON_KEY = status.ANON_KEY;
export const MAILPIT_URL = status.MAILPIT_URL ?? status.INBUCKET_URL;
const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase local no está arrancado: npm run db:start');
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente como lo usaría la app (clave anónima). */
export const anonClient = () => createClient(API_URL, ANON_KEY, noSession);

/** Cliente con rol de servicio: solo para preparar y limpiar datos de prueba. */
export const adminClient = createClient(API_URL, SERVICE_ROLE_KEY, noSession);

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pruebas.test`;

/** Crea un usuario confirmado; con `owner`, además le da el rol de dueño. */
export async function createUser(email: string, password: string, { owner = false } = {}) {
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? 'createUser');
  if (owner) {
    const { error: roleError } = await adminClient.from('backoffice_users').insert({ user_id: data.user.id, role: 'owner' });
    if (roleError) throw new Error(roleError.message);
  }
  return data.user.id;
}

export async function deleteUser(id: string | undefined) {
  if (id) await adminClient.auth.admin.deleteUser(id);
}

// --- Mailpit (correo local) ---------------------------------------------------------

interface MailSummary {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
}

export async function mailsTo(email: string): Promise<MailSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await response.json()) as { messages: MailSummary[] | null };
  return body.messages ?? [];
}

export async function mailText(id: string): Promise<string> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  const body = (await response.json()) as { Text: string; HTML: string };
  return `${body.Text}\n${body.HTML}`;
}

export async function waitForMail(email: string, timeoutMs = 10_000): Promise<MailSummary> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [mail] = await mailsTo(email);
    if (mail) return mail;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ha llegado ningún correo a ${email}`);
}
