import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase } from '../test/fakeSupabase';
import { newImagePath, prepareImage, removeImage, uploadImage, validateImage } from './images';

const MB = 1024 * 1024;
const fileOf = (bytes: number, type: string, name = 'foto') => new File([new Uint8Array(bytes)], name, { type });

// Canvas simulado: jsdom no implementa canvas ni createImageBitmap
let drawn: { width: number; height: number; type?: string; quality?: number } | null;

beforeEach(() => {
  drawn = null;
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (file: File & { __w?: number; __h?: number }) => ({
      width: file.__w ?? 4000,
      height: file.__h ?? 3000,
      close: vi.fn(),
    })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    drawn = { width: this.width, height: this.height, type, quality };
    callback(new Blob(['x'], { type }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('validateImage', () => {
  it('rechaza un archivo de 7 MB con error.photoTooLarge', () => {
    expect(validateImage(fileOf(7 * MB, 'image/jpeg'))).toBe('error.photoTooLarge');
  });

  it.each(['image/gif', 'image/heic', 'application/pdf'])('rechaza %s con error.photoType', (type) => {
    expect(validateImage(fileOf(1000, type))).toBe('error.photoType');
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('acepta %s de hasta 5 MB', (type) => {
    expect(validateImage(fileOf(5 * MB, type))).toBeNull();
  });
});

describe('prepareImage', () => {
  it('foto de plato válida → JPEG de 960 px como máximo', async () => {
    const result = await prepareImage(fileOf(2 * MB, 'image/png'), 'dish');
    expect(result.error).toBeUndefined();
    expect(result.blob?.type).toBe('image/jpeg');
    expect(drawn).toMatchObject({ width: 960, height: 720, type: 'image/jpeg', quality: 0.8 });
  });

  it('logo válido → PNG de 512 px como máximo', async () => {
    const file = Object.assign(fileOf(1 * MB, 'image/png'), { __w: 1000, __h: 2000 });
    const result = await prepareImage(file, 'logo');
    expect(result.blob?.type).toBe('image/png');
    expect(drawn).toMatchObject({ width: 256, height: 512, type: 'image/png' });
  });

  it('no amplía una imagen pequeña', async () => {
    const file = Object.assign(fileOf(1000, 'image/jpeg'), { __w: 400, __h: 300 });
    await prepareImage(file, 'dish');
    expect(drawn).toMatchObject({ width: 400, height: 300 });
  });

  it('no redimensiona un archivo inválido', async () => {
    const result = await prepareImage(fileOf(7 * MB, 'image/jpeg'), 'dish');
    expect(result).toEqual({ error: 'error.photoTooLarge' });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('un archivo que el navegador no puede decodificar → error.photoType', async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('decode'));
    expect(await prepareImage(fileOf(1000, 'image/jpeg'), 'dish')).toEqual({ error: 'error.photoType' });
  });
});

describe('subida y borrado', () => {
  it('genera un nombre único por sustitución', () => {
    const a = newImagePath('dish', 'd1');
    expect(a).toMatch(/^dishes\/d1\/[0-9a-f-]{36}\.jpg$/);
    expect(newImagePath('dish', 'd1')).not.toBe(a);
    expect(newImagePath('logo')).toMatch(/^venue\/logo-[0-9a-f-]{36}\.png$/);
  });

  it('sube con caché inmutable y borra la anterior', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await uploadImage('dishes/d1/nueva.jpg', blob);
    await removeImage('dishes/d1/vieja.jpg');
    await removeImage(null);
    expect(fakeSupabase.storageCalls).toEqual([
      { op: 'upload', path: 'dishes/d1/nueva.jpg', body: blob, options: expect.objectContaining({ cacheControl: '31536000' }) },
      { op: 'remove', path: ['dishes/d1/vieja.jpg'] },
    ]);
  });

  it('una subida rechazada lanza un error', async () => {
    fakeSupabase.storageError = { message: 'Payload too large' };
    await expect(uploadImage('x.jpg', new Blob(['x']))).rejects.toThrow('Payload too large');
  });
});
