import type { ReactNode } from 'react';
import { BackofficeGuard } from './BackofficeGuard';

/** Panel de cocina: dueño o personal (design D1). */
export function RequireKitchen({ children }: { children: ReactNode }) {
  return <BackofficeGuard area="kitchen">{children}</BackofficeGuard>;
}
