import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras el panel está visible, si el navegador lo admite
 * (design D7). Sin Wake Lock no hace nada: el README pide desactivar el bloqueo automático.
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator) || !navigator.wakeLock?.request) return;
    let sentinel: WakeLockSentinel | null = null;
    let active = true;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (active) sentinel = lock;
        else void lock.release().catch(() => {});
      } catch {
        /* denegado o no disponible ahora: se reintenta al volver a ser visible */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}
