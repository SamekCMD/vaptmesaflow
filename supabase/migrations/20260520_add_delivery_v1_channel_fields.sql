-- Delivery V1: channel flags and order channel

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS local_enabled boolean;

UPDATE public.restaurants
SET local_enabled = true
WHERE local_enabled IS NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN local_enabled SET DEFAULT true,
  ALTER COLUMN local_enabled SET NOT NULL;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean;

UPDATE public.restaurants
SET delivery_enabled = false
WHERE delivery_enabled IS NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN delivery_enabled SET DEFAULT false,
  ALTER COLUMN delivery_enabled SET NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_channel text;

UPDATE public.orders
SET order_channel = 'local'
WHERE order_channel IS NULL
  OR order_channel NOT IN ('local', 'delivery');

ALTER TABLE public.orders
  ALTER COLUMN order_channel SET DEFAULT 'local',
  ALTER COLUMN order_channel SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_order_channel_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_order_channel_check
      CHECK (order_channel IN ('local', 'delivery'));
  END IF;
END;
$$;
