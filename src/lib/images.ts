// Imágenes del plato y del logo (design D5): validación del original, redimensionado en el
// navegador con canvas (sin dependencias) y subida al bucket público `images`.
import { supabase } from './supabase';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Valor para el atributo `accept` de los `<input type="file">`. */
export const IMAGE_ACCEPT = ACCEPTED_TYPES.join(',');

export type ImageKind = 'dish' | 'logo';
export type ImageError = 'error.photoTooLarge' | 'error.photoType';

const output: Record<ImageKind, { maxSide: number; type: string; quality?: number }> = {
  dish: { maxSide: 960, type: 'image/jpeg', quality: 0.8 }, // JPEG: webp no está garantizado en Safari
  logo: { maxSide: 512, type: 'image/png' }, // PNG: conserva la transparencia
};

/** Valida el archivo ORIGINAL elegido por el dueño. */
export function validateImage(file: File): ImageError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'error.photoType';
  if (file.size > MAX_IMAGE_BYTES) return 'error.photoTooLarge';
  return null;
}

/** Redimensiona a un máximo de 960 px (plato, JPEG) o 512 px (logo, PNG) sin ampliar. */
export async function resizeImage(file: File, kind: ImageKind): Promise<Blob> {
  const { maxSide, type, quality } = output[kind];
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas 2d no disponible');
  if (type === 'image/jpeg') {
    // JPEG no tiene transparencia: fondo blanco en lugar de negro
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no se pudo generar la imagen'))), type, quality);
  });
}

/** Valida y redimensiona: o la imagen lista para subir, o el error que mostrar. */
export async function prepareImage(
  file: File,
  kind: ImageKind,
): Promise<{ blob: Blob; error?: undefined } | { error: ImageError; blob?: undefined }> {
  const error = validateImage(file);
  if (error) return { error };
  try {
    return { blob: await resizeImage(file, kind) };
  } catch {
    // El navegador no sabe decodificarla (p. ej. un HEIC con extensión cambiada)
    return { error: 'error.photoType' };
  }
}

/** Nombre nuevo en cada sustitución → la caché del navegador puede ser inmutable. */
export function newImagePath(kind: ImageKind, dishId?: string): string {
  const id = crypto.randomUUID();
  return kind === 'dish' ? `dishes/${dishId}/${id}.jpg` : `venue/logo-${id}.png`;
}

export async function uploadImage(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from('images').upload(path, blob, {
    cacheControl: '31536000',
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
}

/** Borra la imagen anterior (best effort: si falla, queda un huérfano inofensivo). */
export async function removeImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from('images').remove([path]);
  } catch {
    /* huérfano aceptado (design D5) */
  }
}
