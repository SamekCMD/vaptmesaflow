import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Minus, Plus, RotateCcw, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fontFamilyMap, type RestaurantConfig } from "@/lib/restaurant-config";
import { PublicMenuSkeleton } from "@/components/skeletons/DashboardSkeletons";

type RestaurantDeliveryRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: RestaurantConfig["fontFamily"] | null;
  delivery_enabled: boolean;
};

type DeliveryMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  available: boolean;
};

type CartItem = {
  item: DeliveryMenuItem;
  quantity: number;
};

type CheckoutForm = {
  customerName: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
};

type DeliveryOrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type SessionDeliveryOrderItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
};

type SessionDeliveryOrderSnapshot = {
  id: string;
  displayId: number | null;
  status: DeliveryOrderStatus;
  deliveredAt?: string | null;
  total: number;
  createdAt: string;
  items: SessionDeliveryOrderItem[];
};

const DEFAULT_PRIMARY = "#0ea573";
const DELIVERY_ADDRESS_STORAGE_KEY = "vapt_delivery_address";
const DELIVERY_RECENT_ORDERS_STORAGE_KEY = "vapt_delivery_recent_orders";
const DELIVERED_RETENTION_MS = 30 * 60 * 1000;

const statusMeta: Record<DeliveryOrderStatus, { label: string; step: number }> = {
  pending: { label: "Pedido recebido", step: 1 },
  preparing: { label: "Em preparo", step: 2 },
  ready: { label: "Saiu para entrega", step: 3 },
  out_for_delivery: { label: "A caminho", step: 3 },
  delivered: { label: "Entregue", step: 4 },
  cancelled: { label: "Cancelado", step: 0 },
};

const statusColorMap: Record<DeliveryOrderStatus, string> = {
  pending: "#f59e0b",
  preparing: "#3b82f6",
  ready: "#6366f1",
  out_for_delivery: "#8b5cf6",
  delivered: "#16a34a",
  cancelled: "#ef4444",
};

const normalizeDeliveryStatus = (status: string | null | undefined): DeliveryOrderStatus => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "preparing") return "preparing";
  if (normalized === "ready") return "ready";
  if (normalized === "out_for_delivery") return "out_for_delivery";
  if (normalized === "delivered") return "delivered";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
};

const PublicDelivery = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<RestaurantDeliveryRow | null>(null);
  const [items, setItems] = useState<DeliveryMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<DeliveryOrderStatus | null>(null);
  const [recentOrders, setRecentOrders] = useState<SessionDeliveryOrderSnapshot[]>([]);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savedAddress, setSavedAddress] = useState<CheckoutForm | null>(null);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    customerName: "",
    phone: "",
    street: "",
    number: "",
    neighborhood: "",
  });

  useEffect(() => {
    const fetchDeliveryData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      const { data: restData, error: restError } = await supabase
        .from("restaurants")
        .select("id, name, slug, logo_url, primary_color, secondary_color, font_family, delivery_enabled")
        .eq("slug", slug)
        .single();

      if (restError || !restData) {
        setRestaurant(null);
        setLoading(false);
        return;
      }

      const parsedRestaurant = restData as RestaurantDeliveryRow;
      setRestaurant(parsedRestaurant);

      const { data: menuData } = await supabase
        .from("menu_items")
        .select("id, name, description, price, category, image_url, available")
        .eq("restaurant_id", parsedRestaurant.id)
        .eq("available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      const parsedItems = ((menuData || []) as DeliveryMenuItem[]).map((menuItem) => ({
        ...menuItem,
        price: Number(menuItem.price),
      }));

      setItems(parsedItems);
      if (parsedItems.length > 0) setActiveCategory(parsedItems[0].category);
      setLoading(false);
    };

    fetchDeliveryData();
  }, [slug]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const raw = localStorage.getItem(`${DELIVERY_ADDRESS_STORAGE_KEY}_${restaurant.id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as CheckoutForm;
      if (parsed.customerName && parsed.phone && parsed.street && parsed.number && parsed.neighborhood) {
        setSavedAddress(parsed);
        setCheckoutForm(parsed);
      }
    } catch {
      // no-op
    }
  }, [restaurant?.id]);

  const pruneDeliveredOrders = (orders: SessionDeliveryOrderSnapshot[]) => {
    const now = Date.now();
    return orders.filter((order) => {
      if (order.status !== "delivered") return true;
      if (!order.deliveredAt) return false;
      return now - new Date(order.deliveredAt).getTime() < DELIVERED_RETENTION_MS;
    });
  };

  useEffect(() => {
    if (!restaurant?.id) return;
    const raw = localStorage.getItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SessionDeliveryOrderSnapshot[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const cleaned = pruneDeliveredOrders(parsed);
      localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(cleaned));
      setRecentOrders(cleaned);
      if (cleaned[0]) {
        setLastOrderId(cleaned[0].id);
        setLastOrderStatus(cleaned[0].status);
        setLastOrderCode(cleaned[0].displayId ? `#${cleaned[0].displayId}` : "recebido");
      } else {
        setLastOrderId(null);
        setLastOrderStatus(null);
        setLastOrderCode(null);
      }
    } catch {
      // no-op
    }
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id || !lastOrderId) return;

    let active = true;
    const poll = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, display_id, status")
        .eq("id", lastOrderId)
        .eq("restaurant_id", restaurant.id)
        .single();

      if (!active || !data?.id) return;

      const normalized = normalizeDeliveryStatus(data.status);
      setLastOrderStatus(normalized);
      setLastOrderCode(data.display_id ? `#${data.display_id}` : "recebido");

      setRecentOrders((current) => {
        const next = current.map((order) => {
          if (order.id !== data.id) return order;
          if (normalized === "delivered" && !order.deliveredAt) {
            return { ...order, displayId: data.display_id ?? order.displayId, status: normalized, deliveredAt: new Date().toISOString() };
          }
          return { ...order, displayId: data.display_id ?? order.displayId, status: normalized };
        });
        const cleaned = pruneDeliveredOrders(next);
        localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(cleaned));
        if (cleaned.length === 0) {
          setLastOrderId(null);
          setLastOrderStatus(null);
          setLastOrderCode(null);
        }
        return cleaned;
      });
    };

    poll();
    const intervalId = window.setInterval(poll, 4000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [lastOrderId, restaurant?.id]);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))), [items]);
  const filteredItems = useMemo(
    () => items.filter((item) => item.category === activeCategory),
    [items, activeCategory],
  );
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((acc, current) => acc + current.item.price * current.quantity, 0),
    [cartItems],
  );

  const primaryColor = restaurant?.primary_color || DEFAULT_PRIMARY;
  const fontFamily = restaurant?.font_family || "modern";

  const addToCart = (item: DeliveryMenuItem) => {
    setCart((current) => {
      const existing = current[item.id];
      return {
        ...current,
        [item.id]: {
          item,
          quantity: (existing?.quantity || 0) + 1,
        },
      };
    });
  };

  const decreaseCartItem = (itemId: string) => {
    setCart((current) => {
      const existing = current[itemId];
      if (!existing) return current;
      if (existing.quantity <= 1) {
        const next = { ...current };
        delete next[itemId];
        return next;
      }
      return {
        ...current,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const updateCheckoutField = (key: keyof CheckoutForm, value: string) => {
    setCheckoutForm((current) => ({ ...current, [key]: value }));
  };

  const saveAddressToSession = () => {
    if (
      !checkoutForm.customerName.trim() ||
      !checkoutForm.phone.trim() ||
      !checkoutForm.street.trim() ||
      !checkoutForm.number.trim() ||
      !checkoutForm.neighborhood.trim()
    ) {
      toast({
        title: "Dados incompletos",
        description: "Preencha nome, telefone, rua, número e bairro.",
        variant: "destructive",
      });
      return;
    }
    if (!restaurant?.id) return;

    const normalized: CheckoutForm = {
      customerName: checkoutForm.customerName.trim(),
      phone: checkoutForm.phone.trim(),
      street: checkoutForm.street.trim(),
      number: checkoutForm.number.trim(),
      neighborhood: checkoutForm.neighborhood.trim(),
    };

    localStorage.setItem(`${DELIVERY_ADDRESS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(normalized));
    setSavedAddress(normalized);
    setAddressModalOpen(false);
    toast({ title: "Endereço salvo", description: "Este endereço ficará salvo neste navegador." });
  };

  const validateCheckout = () => {
    if (cartItems.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione ao menos 1 item.", variant: "destructive" });
      return false;
    }
    if (!savedAddress) {
      toast({
        title: "Endereço pendente",
        description: "Defina seu endereço para confirmar o pedido.",
        variant: "destructive",
      });
      setAddressModalOpen(true);
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!restaurant || submitting) return;
    if (!validateCheckout() || !savedAddress) return;
    setSubmitting(true);

    const deliveryNotes = `Delivery | Nome: ${savedAddress.customerName} | Telefone: ${savedAddress.phone} | Endereço: ${savedAddress.street}, ${savedAddress.number} - ${savedAddress.neighborhood}`;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        total_price: cartTotal,
        status: "pending",
        order_channel: "delivery",
        table_number: null,
        table_session_id: null,
      })
      .select("id, display_id")
      .single();

    if (orderError || !orderData) {
      toast({
        title: "Erro ao enviar pedido",
        description: "Não foi possível finalizar agora. Tente novamente.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    const orderItemsPayload = cartItems.map((cartItem) => ({
      order_id: orderData.id,
      product_id: cartItem.item.id,
      product_name: cartItem.item.name,
      quantity: cartItem.quantity,
      unit_price: cartItem.item.price,
      notes: deliveryNotes,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderData.id);
      toast({
        title: "Erro ao salvar itens",
        description: "O pedido não foi concluído. Tente novamente.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    const snapshot: SessionDeliveryOrderSnapshot = {
      id: orderData.id,
      displayId: orderData.display_id ?? null,
      status: "pending",
      deliveredAt: null,
      total: cartTotal,
      createdAt: new Date().toISOString(),
      items: cartItems.map((ci) => ({
        itemId: ci.item.id,
        name: ci.item.name,
        price: ci.item.price,
        quantity: ci.quantity,
      })),
    };

    setRecentOrders((current) => {
      const next = [snapshot, ...current].slice(0, 4);
      localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(next));
      return next;
    });
    setLastOrderId(orderData.id);
    setLastOrderStatus("pending");
    setLastOrderCode(orderData.display_id ? `#${orderData.display_id}` : "recebido");
    setCart({});
    toast({
      title: "Pedido enviado",
      description: "Recebemos seu pedido. Agora acompanhe o status.",
    });
    setSubmitting(false);
  };

  const reorder = (snapshot: SessionDeliveryOrderSnapshot) => {
    const nextCart: Record<string, CartItem> = {};

    snapshot.items.forEach((savedItem) => {
      const liveItem = items.find((item) => item.id === savedItem.itemId && item.available);
      if (!liveItem) return;
      nextCart[liveItem.id] = {
        item: liveItem,
        quantity: savedItem.quantity,
      };
    });

    if (Object.keys(nextCart).length === 0) {
      toast({
        title: "Itens indisponíveis",
        description: "Os itens desse pedido antigo não estão disponíveis agora.",
        variant: "destructive",
      });
      return;
    }

    setCart(nextCart);
    toast({ title: "Pedido reaplicado", description: "Seu carrinho foi preenchido com o pedido anterior." });
  };

  if (loading) return <PublicMenuSkeleton />;

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Delivery não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira o link e tente novamente.</p>
      </div>
    );
  }

  if (!restaurant.delivery_enabled) {
    return (
      <div className="min-h-screen bg-background px-4 py-14" style={{ fontFamily: fontFamilyMap[fontFamily] }}>
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-7 text-center sm:p-8">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${primaryColor}1f`, color: primaryColor }}
          >
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Delivery em preparação</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            O restaurante ainda não ativou pedidos por delivery. Tente novamente em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10" style={{ fontFamily: fontFamilyMap[fontFamily] }}>
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-border"
              style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
            >
              {restaurant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Delivery próprio
            </p>
            <h1 className="truncate text-base font-semibold text-foreground">{restaurant.name}</h1>
          </div>
          <Store className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 overflow-x-hidden px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-border bg-card px-5 py-5">
            <h2 className="text-2xl font-semibold text-foreground">Peça direto da loja</h2>
            <p className="mt-2 text-sm text-muted-foreground">Monte seu pedido e confirme em segundos.</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className="whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium"
                  style={{
                    borderColor: active ? `${primaryColor}66` : "hsl(var(--border))",
                    backgroundColor: active ? `${primaryColor}14` : "hsl(var(--card))",
                    color: active ? primaryColor : "hsl(var(--foreground))",
                  }}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">{item.name}</h3>
                    {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                    <p className="mt-2 text-base font-semibold" style={{ color: primaryColor }}>
                      R$ {item.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-xl text-sm font-semibold sm:min-w-[120px] sm:w-auto"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => addToCart(item)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Sem itens nessa categoria no momento.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">Seu carrinho</h2>
            <div className="mt-4 space-y-3">
              {cartItems.length === 0 && <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>}
              {cartItems.map(({ item, quantity }) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 rounded-lg p-0"
                        onClick={() => decreaseCartItem(item.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[24px] text-center text-sm font-semibold">{quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 rounded-lg p-0"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">R$ {(item.price * quantity).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold text-foreground">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Endereço de entrega</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {savedAddress ? "Endereço salvo neste navegador." : "Defina uma vez e reutilize no próximo acesso."}
                </p>
              </div>
              <Button type="button" variant="outline" className="h-10 px-3 text-xs sm:h-9" onClick={() => setAddressModalOpen(true)}>
                {savedAddress ? "Editar" : "Definir"}
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              {savedAddress ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{savedAddress.customerName}</p>
                  <p className="text-muted-foreground">{savedAddress.phone}</p>
                  <p className="text-muted-foreground">
                    {savedAddress.street}, {savedAddress.number} - {savedAddress.neighborhood}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum endereço salvo ainda.</p>
              )}
            </div>

            <Button
              type="button"
              className="mt-5 h-11 w-full rounded-xl text-sm font-semibold"
              style={{ backgroundColor: primaryColor }}
              onClick={submitOrder}
              disabled={submitting}
            >
              {submitting ? "Enviando pedido..." : "Confirmar pedido"}
            </Button>

            {lastOrderCode && lastOrderStatus && (
              <div className="mt-4 rounded-xl border border-border bg-background p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setStatusExpanded((current) => !current)}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status do pedido {lastOrderCode}</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: statusColorMap[lastOrderStatus] }}>
                      {statusMeta[lastOrderStatus].label}
                    </p>
                  </div>
                  {statusExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {statusExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((step) => {
                          const active = step <= statusMeta[lastOrderStatus].step;
                          return (
                            <div
                              key={step}
                              className="h-1.5 rounded-full transition-colors"
                              style={{
                                backgroundColor: active ? statusColorMap[lastOrderStatus] : "hsl(var(--border))",
                              }}
                            />
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-3">
              <h2 className="text-base font-semibold text-foreground">Peça novamente</h2>
              <span className="text-xs text-muted-foreground">{recentOrders.length} salvos no navegador</span>
            </div>
            <div className="mt-3 space-y-2">
              {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido salvo neste navegador.</p>}
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {order.displayId ? `Pedido #${order.displayId}` : "Pedido"}
                    </p>
                    <span className="text-xs text-muted-foreground">{statusMeta[order.status].label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.items.reduce((sum, it) => sum + it.quantity, 0)} itens • R${" "}
                    {order.total.toFixed(2).replace(".", ",")}
                  </p>
                  <Button type="button" variant="outline" className="mt-2 h-9 w-full text-xs" onClick={() => reorder(order)}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Pedir novamente
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <AnimatePresence>
        {addressModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAddressModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground">Seu endereço</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Vamos salvar neste navegador para agilizar seus próximos pedidos.
              </p>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-name">Nome</Label>
                  <Input
                    id="delivery-name"
                    value={checkoutForm.customerName}
                    onChange={(event) => updateCheckoutField("customerName", event.target.value)}
                    placeholder="Seu nome"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-phone">Telefone</Label>
                  <Input
                    id="delivery-phone"
                    value={checkoutForm.phone}
                    onChange={(event) => updateCheckoutField("phone", event.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-street">Rua</Label>
                  <Input
                    id="delivery-street"
                    value={checkoutForm.street}
                    onChange={(event) => updateCheckoutField("street", event.target.value)}
                    placeholder="Nome da rua"
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-number">Número</Label>
                    <Input
                      id="delivery-number"
                      value={checkoutForm.number}
                      onChange={(event) => updateCheckoutField("number", event.target.value)}
                      placeholder="123"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-neighborhood">Bairro</Label>
                    <Input
                      id="delivery-neighborhood"
                      value={checkoutForm.neighborhood}
                      onChange={(event) => updateCheckoutField("neighborhood", event.target.value)}
                      placeholder="Centro"
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setAddressModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="h-11 flex-1" style={{ backgroundColor: primaryColor }} onClick={saveAddressToSession}>
                  Salvar endereço
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicDelivery;
