-- add-panel-cocina: estados nuevos del pedido (design D2).
-- Va en su propia migración: PostgreSQL no permite usar un valor recién añadido a un enum
-- en la misma transacción que lo añade.
alter type public.order_status add value if not exists 'in_preparation';
alter type public.order_status add value if not exists 'served';
alter type public.order_status add value if not exists 'cancelled';
