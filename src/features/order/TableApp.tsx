import { lazy, Suspense } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { NotFoundPage } from '../../NotFoundPage';
import { OrderProvider } from './OrderProvider';
import { TableMenuPage } from './TableMenuPage';

// Resumen, confirmación y «Mis pedidos» en un único chunk aparte: la carta no los descarga (design D1).
// Un solo import() a propósito: ver orderPages.ts.
const orderPages = () => import('./orderPages');
const OrderSummaryPage = lazy(() => orderPages().then((m) => ({ default: m.OrderSummaryPage })));
const MyOrdersPage = lazy(() => orderPages().then((m) => ({ default: m.MyOrdersPage })));
const OrderDetailPage = lazy(() => orderPages().then((m) => ({ default: m.OrderDetailPage })));

/** Todo lo que cuelga de `/t/:token`: la carta de la mesa y su pedido (design D1). */
export function TableApp() {
  const { token = '' } = useParams();
  return (
    <OrderProvider key={token} token={token}>
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        <Routes>
          <Route index element={<TableMenuPage />} />
          <Route path="order" element={<OrderSummaryPage />} />
          <Route path="orders" element={<MyOrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </OrderProvider>
  );
}
