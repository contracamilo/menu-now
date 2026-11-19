import { vi } from 'vitest';

/** Simula createImageBitmap y canvas (jsdom no los implementa) para poder "redimensionar". */
export function stubCanvas(size = { width: 1200, height: 900 }) {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...size, close: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback, type?: string) =>
    callback(new Blob(['x'], { type })),
  );
}

export const MB = 1024 * 1024;

export function fileOf(bytes: number, type: string, name = 'imagen') {
  return new File([new Uint8Array(bytes)], name, { type });
}
