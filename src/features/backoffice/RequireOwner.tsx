import type { ReactNode } from 'react';
import { BackofficeGuard } from './BackofficeGuard';

/** Pantallas del dueño: el personal se lleva al panel de cocina (design D1). */
export function RequireOwner({ children }: { children: ReactNode }) {
  return <BackofficeGuard area="admin">{children}</BackofficeGuard>;
}
