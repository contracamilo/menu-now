import qrcode from 'qrcode-generator';

export interface QrMatrix {
  /** Lado en módulos, incluido el margen blanco. */
  size: number;
  /** Trazado SVG de los módulos oscuros (un cuadrado de 1×1 por módulo). */
  path: string;
}

const MARGIN = 4; // zona tranquila mínima del estándar QR

/** QR con corrección de errores M de una URL (design D9). Sin dependencias de React. */
export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
    }
  }
  return { size: count + MARGIN * 2, path };
}

/** El mismo QR como archivo SVG independiente, para descargarlo. */
export function qrSvgFile(matrix: QrMatrix, title: string): string {
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.size} ${matrix.size}" width="1024" height="1024" shape-rendering="crispEdges">` +
    `<title>${escaped}</title><rect width="100%" height="100%" fill="#fff"/><path d="${matrix.path}" fill="#000"/></svg>`
  );
}
