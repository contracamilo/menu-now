import { useCallback, useEffect, useRef, useState } from 'react';

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

/** Varios pedidos en el mismo segundo suenan una sola vez (design D7). */
const MIN_GAP_MS = 1_000;

/**
 * Aviso sonoro de pedido nuevo con Web Audio (design D7): dos tonos cortos, sin archivos. El
 * navegador deja el audio suspendido hasta que alguien toca la página; mientras tanto
 * `suspended` es verdadero y `resume()` (un toque) lo activa.
 */
export function useAlertSound() {
  const context = useRef<AudioContext | null>(null);
  const lastPlay = useRef(0);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return;
    }
    context.current = ctx;
    const update = () => setSuspended(ctx.state === 'suspended');
    update();
    ctx.addEventListener?.('statechange', update);
    return () => {
      ctx.removeEventListener?.('statechange', update);
      void ctx.close?.().catch(() => {});
      context.current = null;
    };
  }, []);

  const resume = useCallback(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== 'suspended') return;
    void ctx
      .resume()
      .then(() => setSuspended(ctx.state === 'suspended'))
      .catch(() => {});
  }, []);

  const play = useCallback(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = Date.now();
    if (now - lastPlay.current < MIN_GAP_MS) return;
    lastPlay.current = now;
    [
      [0, 880],
      [0.2, 1175],
    ].forEach(([delay, frequency]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.25;
      oscillator.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + delay;
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }, []);

  return { suspended, resume, play };
}
