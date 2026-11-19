import { useT } from './i18n/useT';

export function NotFoundPage() {
  const t = useT();
  return (
    <main className="page">
      <h1>{t('common.notFound')}</h1>
    </main>
  );
}
