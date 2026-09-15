
ALTER TABLE public.restaurants ADD COLUMN address TEXT;
ALTER TABLE public.restaurants ADD COLUMN phone TEXT;
ALTER TABLE public.restaurants ADD COLUMN hours TEXT;
ALTER TABLE public.restaurants ADD COLUMN description TEXT;
ALTER TABLE public.restaurants ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'open_tab';
ALTER TABLE public.restaurants ADD COLUMN max_pending_orders INTEGER NOT NULL DEFAULT 3;
