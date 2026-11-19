import { useEffect, useState } from 'react';

/**
 * true en cuanto el contenido se ha pintado al menos una vez (dos fotogramas después de
 * activarse). La carta lo usa para pedir las fotos después de pintar el texto (design D6).
 */
export function useAfterFirstPaint(active: boolean): boolean {
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (!active || painted) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [active, painted]);

  return painted;
}
