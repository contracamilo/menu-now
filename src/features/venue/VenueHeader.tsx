import type { ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import { publicImageUrl } from '../../lib/rest';
import { useVenue } from './useVenue';

interface Props {
  /** En la carta el nombre es el `h1`; en la administración cada pantalla tiene su propio título. */
  asHeading?: boolean;
  children?: ReactNode;
}

/** Cabecera con el logo y el nombre del local, compartida por la carta y la administración. */
export function VenueHeader({ asHeading = true, children }: Props) {
  const t = useT();
  const { data } = useVenue(); // si falla, se usa el título genérico
  const name = data?.name ?? null;
  const title = name ?? t('menu.title');
  const Title = asHeading ? 'h1' : 'p';

  return (
    <header className="venue-header">
      {data?.logo_path && (
        <img
          className="venue-header__logo"
          src={publicImageUrl(data.logo_path)}
          alt={title}
          width={56}
          height={56}
          loading="eager"
          decoding="async"
        />
      )}
      <Title className="venue-header__name">{title}</Title>
      {children}
    </header>
  );
}
