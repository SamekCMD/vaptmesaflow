
-- 1. Restaurants
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  primary_color TEXT NOT NULL DEFAULT '#5C8A72',
  secondary_color TEXT NOT NULL DEFAULT '#111114',
  font_family TEXT NOT NULL DEFAULT 'modern',
  logo_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'starter',
  plan_status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  total_tables INTEGER NOT NULL DEFAULT 1,
  max_tables INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_select_own" ON public.restaurants FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners_update_own" ON public.restaurants FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners_insert_own" ON public.restaurants FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "public_read_by_slug" ON public.restaurants FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated_read_by_slug" ON public.restaurants FOR SELECT TO authenticated USING (true);

-- 2. Menu Items
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Geral',
  available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  available_from TEXT,
  available_until TEXT,
  badge TEXT,
  is_chef_suggestion BOOLEAN NOT NULL DEFAULT false,
  prep_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_menu" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "owner_manage_menu" ON public.menu_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- 3. Menu Item Variations
CREATE TABLE public.menu_item_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  options TEXT[] NOT NULL DEFAULT '{}',
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_variations" ON public.menu_item_variations FOR SELECT USING (true);
CREATE POLICY "owner_manage_variations" ON public.menu_item_variations FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_id AND r.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.menu_items mi
    JOIN public.restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_id AND r.owner_id = auth.uid()
  )
);

-- 4. Table Sessions
CREATE TABLE public.table_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_open_sessions" ON public.table_sessions FOR SELECT USING (true);
CREATE POLICY "public_insert_sessions" ON public.table_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_sessions" ON public.table_sessions FOR UPDATE USING (true);
CREATE POLICY "owner_manage_sessions" ON public.table_sessions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- 5. Orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_session_id UUID REFERENCES public.table_sessions(id),
  table_number TEXT,
  display_id INTEGER,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "public_insert_orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "owner_manage_orders" ON public.orders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- Auto-generate display_id per restaurant
CREATE OR REPLACE FUNCTION public.set_order_display_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(display_id), 0) + 1 INTO NEW.display_id
  FROM public.orders
  WHERE restaurant_id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_set_order_display_id
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_display_id();

-- 6. Order Items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "public_insert_order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "owner_manage_order_items" ON public.order_items FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_id AND r.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = order_id AND r.owner_id = auth.uid()
  )
);

-- 7. Order Feedback
CREATE TABLE public.order_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  reasons TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_feedback" ON public.order_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "public_upsert_feedback" ON public.order_feedback FOR UPDATE USING (true);
CREATE POLICY "owner_read_feedback" ON public.order_feedback FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- 8. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Storage bucket for menu images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

CREATE POLICY "public_read_menu_images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "auth_upload_menu_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "auth_update_menu_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images');
CREATE POLICY "auth_delete_menu_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images');

-- 10. Enable realtime for orders (KDS needs it)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
