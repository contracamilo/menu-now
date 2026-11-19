import { useEffect, useState } from 'react';

/** Hora actual que se repinta cada `intervalMs` (tiempo transcurrido del panel, design D8). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
