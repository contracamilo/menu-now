import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, anonClient, createUser, deleteUser, uniqueEmail } from './localSupabase';

const MB = 1024 * 1024;
const jpeg = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return client;
}

describe('Bucket images (integración)', () => {
  const password = 'contrasena-de-prueba';
  const ownerEmail = uniqueEmail('dueno-storage');
  const otherEmail = uniqueEmail('otro-storage');
  const prefix = `pruebas/${Date.now()}`;
  let ownerId: string | undefined;
  let otherId: string | undefined;
  let owner: SupabaseClient;

  beforeAll(async () => {
    ownerId = await createUser(ownerEmail, password, { owner: true });
    otherId = await createUser(otherEmail, password);
    owner = await signedIn(ownerEmail, password);
  });

  afterAll(async () => {
    const { data } = await adminClient.storage.from('images').list(prefix);
    if (data?.length) await adminClient.storage.from('images').remove(data.map((f) => `${prefix}/${f.name}`));
    await deleteUser(ownerId);
    await deleteUser(otherId);
  });

  it('el dueño puede subir una imagen JPEG pequeña (control)', async () => {
    const { error } = await owner.storage.from('images').upload(`${prefix}/ok.jpg`, jpeg(100 * 1024), { contentType: 'image/jpeg' });
    expect(error).toBeNull();
  });

  it('[catalog-management] «El dueño intenta subir una foto de más de 5 MB» y [venue-settings] «El dueño intenta subir un logo de más de 5 MB»: el servidor lo rechaza', async () => {
    const { error } = await owner.storage.from('images').upload(`${prefix}/grande.jpg`, jpeg(6 * MB), { contentType: 'image/jpeg' });
    expect(error).not.toBeNull();
    const { data } = await adminClient.storage.from('images').list(prefix, { search: 'grande' });
    expect(data).toHaveLength(0);
  });

  it.each(['image/gif', 'image/webp', 'application/pdf'])('rechaza el tipo %s', async (contentType) => {
    const { error } = await owner.storage
      .from('images')
      .upload(`${prefix}/archivo-${contentType.replace('/', '-')}`, new Blob([new Uint8Array(1024)], { type: contentType }), { contentType });
    expect(error).not.toBeNull();
  });

  it('sin sesión no se puede subir', async () => {
    const { error } = await anonClient().storage.from('images').upload(`${prefix}/anon.jpg`, jpeg(1024), { contentType: 'image/jpeg' });
    expect(error).not.toBeNull();
  });

  it('con sesión de alguien que no es dueño no se puede subir ni borrar', async () => {
    const other = await signedIn(otherEmail, password);
    const upload = await other.storage.from('images').upload(`${prefix}/otro.jpg`, jpeg(1024), { contentType: 'image/jpeg' });
    expect(upload.error).not.toBeNull();
    await other.storage.from('images').remove([`${prefix}/ok.jpg`]);
    const { data } = await adminClient.storage.from('images').list(prefix, { search: 'ok' });
    expect(data).toHaveLength(1);
  });

  it('las imágenes son públicas para el comensal', async () => {
    const { data } = anonClient().storage.from('images').getPublicUrl(`${prefix}/ok.jpg`);
    expect((await fetch(data.publicUrl)).status).toBe(200);
  });
});
