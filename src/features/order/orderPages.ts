// Pantallas del pedido que no necesita la carta (design D1): resumen, «Mis pedidos» y detalle.
// Van juntas en un único chunk diferido. Con un import() por pantalla, rolldown saca de index el
// código que comparten (React Router, TanStack Query, i18n…) a otro chunk que la carta tiene que
// descargar antes de pintar, y el LCP de `/` pasa de ~1,86 s a ~2,11 s.
export { default as OrderSummaryPage } from './OrderSummaryPage';
export { default as MyOrdersPage } from './MyOrdersPage';
export { default as OrderDetailPage } from './OrderDetailPage';
