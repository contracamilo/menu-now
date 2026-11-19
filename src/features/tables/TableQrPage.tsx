import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../../i18n/useT';
import { NotFoundPage } from '../../NotFoundPage';
import { useVenue } from '../venue/useVenue';
import { qrMatrix, qrSvgFile } from './qr';
import { tableUrl, useTables } from './useTables';

/** Tarjeta imprimible con el QR de una mesa (spec table-management «QR único de cada mesa», design D9). */
export function TableQrPage() {
  const t = useT();
  const { id } = useParams();
  const tables = useTables();
  const venue = useVenue();
  const table = tables.data?.find((candidate) => candidate.id === id);
  const url = table ? tableUrl(table.token) : '';
  const matrix = useMemo(() => (url ? qrMatrix(url) : null), [url]);

  if (tables.isPending) return <main className="page" aria-busy="true" />;
  if (!table || !matrix) return <NotFoundPage />;

  function download() {
    const blob = new Blob([qrSvgFile(matrix!, table!.name)], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `qr-${table!.name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}.svg`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main className="page qr-page">
      <div className="qr-page__actions row-actions">
        <button type="button" className="button tap-target button--primary" onClick={() => window.print()}>
          {t('qr.print')}
        </button>
        <button type="button" className="button tap-target" onClick={download}>
          {t('qr.download')}
        </button>
        <Link className="button tap-target" to="/admin/tables">
          {t('admin.tables')}
        </Link>
      </div>

      <article className="qr-card" aria-labelledby="qr-table-name">
        {venue.data?.name && <p className="qr-card__venue">{venue.data.name}</p>}
        <h1 id="qr-table-name" className="qr-card__table">
          {table.name}
        </h1>
        <svg
          className="qr-card__code"
          viewBox={`0 0 ${matrix.size} ${matrix.size}`}
          role="img"
          aria-label={t('qr.urlHint', { url })}
          shapeRendering="crispEdges"
          data-url={url}
        >
          <rect width="100%" height="100%" fill="#fff" />
          <path d={matrix.path} fill="#000" />
        </svg>
        <p className="qr-card__text">{t('qr.cardText')}</p>
        <p className="qr-card__url">{t('qr.urlHint', { url })}</p>
      </article>
    </main>
  );
}
