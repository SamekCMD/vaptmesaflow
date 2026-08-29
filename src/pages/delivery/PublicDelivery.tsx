import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
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
import { createOrderIdempotencyKey, orderClient } from "@/lib/order-client";
import { parseHostedCheckoutUrl } from "@/lib/hosted-checkout-url";
import {
  clearPendingCheckout,
  paymentClient,
  readPendingCheckout,
  savePendingCheckout,
  type PendingCheckout,
} from "@/lib/payment-client";
import { VaptApiClientError } from "@/lib/vapt-api-client";

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

type DeliveryOrderStatus = "waiting_payment" | "paid" | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type DeliveryPaymentMode = "online" | "on_delivery";

type SessionDeliveryOrderItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
};

type SessionDeliveryOrderSnapshot = {
  publicToken: string;
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
  waiting_payment: { label: "Aguardando pagamento", step: 0 },
  paid: { label: "Pagamento confirmado", step: 1 },
  pending: { label: "Pedido recebido", step: 1 },
  preparing: { label: "Em preparo", step: 2 },
  ready: { label: "Saiu para entrega", step: 3 },
  out_for_delivery: { label: "A caminho", step: 3 },
  delivered: { label: "Entregue", step: 4 },
  cancelled: { label: "Cancelado", step: 0 },
};

const statusColorMap: Record<DeliveryOrderStatus, string> = {
  waiting_payment: "#d97706",
  paid: "#059669",
  pending: "#f59e0b",
  preparing: "#3b82f6",
  ready: "#6366f1",
  out_for_delivery: "#8b5cf6",
  delivered: "#16a34a",
  cancelled: "#ef4444",
};

const normalizeDeliveryStatus = (status: string | null | undefined): DeliveryOrderStatus => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "waiting_payment") return "waiting_payment";
  if (normalized === "paid") return "paid";
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
  const [lastOrderToken, setLastOrderToken] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<DeliveryOrderStatus | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(readPendingCheckout);
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
  const idempotencyKeyRef = useRef<string | null>(null);

  const pruneDeliveredOrders = (orders: SessionDeliveryOrderSnapshot[]) => {
    const now = Date.now();
    return orders.filter((order) => {
      if (order.status !== "delivered") return true;
      if (!order.deliveredAt) return false;
      return now - new Date(order.deliveredAt).getTime() < DELIVERED_RETENTION_MS;
    });
  };

  useEffect(() => {
    const fetchDeliveryData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      const { data: restData, error: restError } = await supabase
        .rpc("get_public_restaurant_by_slug", { p_slug: slug })
        .maybeSingle();

      if (restError || !restData || !restData.delivery_enabled) {
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

    const rawAddress = localStorage.getItem(`${DELIVERY_ADDRESS_STORAGE_KEY}_${restaurant.id}`);
    if (rawAddress) {
      try {
        const parsed = JSON.parse(rawAddress) as CheckoutForm;
        if (parsed.customerName && parsed.phone && parsed.street && parsed.number && parsed.neighborhood) {
          setSavedAddress(parsed);
          setCheckoutForm(parsed);
        }
      } catch {
        // no-op
      }
    }

    const rawOrders = localStorage.getItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`);
    if (rawOrders) {
      try {
        const parsed = JSON.parse(rawOrders) as SessionDeliveryOrderSnapshot[];
        if (Array.isArray(parsed)) {
          const cleaned = pruneDeliveredOrders(
            parsed.filter((order) => typeof order.publicToken === "string" && order.publicToken.length > 0),
          );
          localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(cleaned));
          setRecentOrders(cleaned);
          if (cleaned[0]) {
            setLastOrderId(cleaned[0].id);
            setLastOrderToken(cleaned[0].publicToken);
            setLastOrderStatus(cleaned[0].status);
            setLastOrderCode(cleaned[0].displayId ? `#${cleaned[0].displayId}` : "recebido");
          }
        }
      } catch {
        // no-op
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id || !lastOrderId || !lastOrderToken) return;

    let active = true;
    const poll = async () => {
      const data = await orderClient.get(lastOrderId, lastOrderToken).catch(() => null);
      if (!active || !data?.orderId) return;

      const normalized = normalizeDeliveryStatus(data.status);
      setLastOrderStatus(normalized);
      setLastOrderCode(data.displayId ? `#${data.displayId}` : "recebido");

      if (normalized !== "waiting_payment" && pendingCheckout?.orderId === data.orderId) {
        clearPendingCheckout();
        setPendingCheckout(null);
      }

      setRecentOrders((current) => {
        const updated = current.map((order) => {
          if (order.id !== data.orderId) return order;
          if (normalized === "delivered" && !order.deliveredAt) {
            return {
              ...order,
              displayId: data.displayId ?? order.displayId,
              status: normalized,
              deliveredAt: new Date().toISOString(),
            };
          }
          return { ...order, displayId: data.displayId ?? order.displayId, status: normalized };
        });

        const cleaned = pruneDeliveredOrders(updated);
        localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(cleaned));

        if (cleaned.length === 0) {
          setLastOrderId(null);
          setLastOrderToken(null);
          setLastOrderCode(null);
          setLastOrderStatus(null);
        }
        return cleaned;
      });
    };

    void poll();
    const intervalId = window.setInterval(() => void poll(), 4000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [lastOrderId, lastOrderToken, pendingCheckout?.orderId, restaurant?.id]);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))), [items]);
  const filteredItems = useMemo(() => items.filter((item) => item.category === activeCategory), [items, activeCategory]);
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(() => cartItems.reduce((acc, current) => acc + current.item.price * current.quantity, 0), [cartItems]);
  const cartItemsCount = useMemo(() => cartItems.reduce((acc, current) => acc + current.quantity, 0), [cartItems]);
  const primaryColor = restaurant?.primary_color || DEFAULT_PRIMARY;
  const fontFamily = restaurant?.font_family || "modern";
  const resumableCheckout =
    lastOrderStatus === "waiting_payment" &&
    pendingCheckout?.orderId === lastOrderId
      ? pendingCheckout
      : null;

  const addToCart = (item: DeliveryMenuItem) => {
    setCart((current) => {
      const existing = current[item.id];
      return {
        ...current,
        [item.id]: { item, quantity: (existing?.quantity || 0) + 1 },
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
      return { ...current, [itemId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  };

  const updateCheckoutField = (key: keyof CheckoutForm, value: string) => {
    setCheckoutForm((current) => ({ ...current, [key]: value }));
  };

  const saveAddress = () => {
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
      setAddressModalOpen(true);
      toast({
        title: "Endereço pendente",
        description: "Defina seu endereço para confirmar o pedido.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const submitOrder = async (paymentMode: DeliveryPaymentMode) => {
    if (!restaurant || submitting) return;
    if (!validateCheckout() || !savedAddress) return;
    setSubmitting(true);

    try {
      idempotencyKeyRef.current ??= createOrderIdempotencyKey();
      const order = await orderClient.create(
        {
          restaurantSlug: restaurant.slug,
          channel: "delivery",
          items: cartItems.map((cartItem) => ({
            menuItemId: cartItem.item.id,
            quantity: cartItem.quantity,
          })),
          delivery: {
            name: savedAddress.customerName,
            phone: savedAddress.phone,
            street: savedAddress.street,
            number: savedAddress.number,
            neighborhood: savedAddress.neighborhood,
            paymentMode,
          },
        },
        idempotencyKeyRef.current,
      );

      const snapshot: SessionDeliveryOrderSnapshot = {
        id: order.orderId,
        publicToken: order.publicToken,
        displayId: order.displayId,
        status: normalizeDeliveryStatus(order.status),
        deliveredAt: null,
        total: Number(order.totalPrice),
        createdAt: new Date().toISOString(),
        items: cartItems.map((cartItem) => ({
          itemId: cartItem.item.id,
          name: cartItem.item.name,
          price: cartItem.item.price,
          quantity: cartItem.quantity,
        })),
      };

      setRecentOrders((current) => {
        const next = [snapshot, ...current.filter((saved) => saved.id !== snapshot.id)].slice(0, 4);
        localStorage.setItem(`${DELIVERY_RECENT_ORDERS_STORAGE_KEY}_${restaurant.id}`, JSON.stringify(next));
        return next;
      });

      setLastOrderId(order.orderId);
      setLastOrderToken(order.publicToken);
      setLastOrderStatus(normalizeDeliveryStatus(order.status));
      setLastOrderCode(order.displayId ? `#${order.displayId}` : "recebido");

      if (paymentMode === "online") {
        const checkout = await paymentClient.startHosted(
          order.orderId,
          order.publicToken,
          `checkout-${idempotencyKeyRef.current}`,
        );
        const checkoutUrl = parseHostedCheckoutUrl(checkout.checkoutUrl);

        const pending: PendingCheckout = {
          orderId: order.orderId,
          publicToken: order.publicToken,
          transactionId: checkout.transactionId,
          returnPath: `${window.location.pathname}${window.location.search}`,
          checkoutUrl: checkoutUrl.toString(),
          expiresAt: checkout.expiresAt,
        };
        savePendingCheckout(pending);
        setPendingCheckout(pending);
        idempotencyKeyRef.current = null;
        window.location.assign(checkoutUrl.toString());
        return;
      }

      idempotencyKeyRef.current = null;
      setCart({});
      toast({
        title: "Pedido enviado",
        description: "O pagamento será feito na entrega. Acompanhe o preparo por aqui.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao enviar pedido",
        description: error instanceof VaptApiClientError ? error.message : "Não foi possível finalizar agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reorder = (snapshot: SessionDeliveryOrderSnapshot) => {
    const nextCart: Record<string, CartItem> = {};
    snapshot.items.forEach((savedItem) => {
      const liveItem = items.find((item) => item.id === savedItem.itemId && item.available);
      if (!liveItem) return;
      nextCart[liveItem.id] = { item: liveItem, quantity: savedItem.quantity };
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${primaryColor}1f`, color: primaryColor }}>
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Delivery em preparação</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">O restaurante ainda não ativou pedidos por delivery. Tente novamente em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24 lg:pb-10" style={{ fontFamily: fontFamilyMap[fontFamily] }}>
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-border" style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}>
              {restaurant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Delivery próprio</p>
            <h1 className="truncate text-base font-semibold text-foreground">{restaurant.name}</h1>
          </div>
          <Store className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pt-4 sm:gap-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4 sm:space-y-5">
          <div className="rounded-2xl border border-border bg-card px-4 py-4 sm:rounded-3xl sm:px-5 sm:py-5">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Peça direto da loja</h2>
            <p className="mt-2 text-sm text-muted-foreground">Monte seu pedido e confirme em segundos.</p>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max min-w-full gap-2 pb-1">
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
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
                    {item.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                    <p className="mt-2 text-base font-semibold" style={{ color: primaryColor }}>
                      R$ {item.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <Button type="button" className="h-11 w-full rounded-xl text-sm font-semibold sm:w-auto sm:min-w-[120px]" style={{ backgroundColor: primaryColor }} onClick={() => addToCart(item)}>
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

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
            <h2 className="text-lg font-semibold text-foreground">Seu carrinho</h2>
            <div className="mt-4 space-y-3">
              {cartItems.length === 0 && <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>}
              {cartItems.map(({ item, quantity }) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-9 w-9 rounded-lg p-0" onClick={() => decreaseCartItem(item.id)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[20px] text-center text-sm font-semibold">{quantity}</span>
                      <Button type="button" variant="outline" className="h-9 w-9 rounded-lg p-0" onClick={() => addToCart(item)}>
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

          <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">Endereço de entrega</h2>
                <p className="mt-1 text-xs text-muted-foreground">{savedAddress ? "Endereço salvo neste navegador." : "Defina uma vez e reutilize no próximo acesso."}</p>
              </div>
              <Button type="button" variant="outline" className="h-10 shrink-0 px-3 text-xs sm:h-9" onClick={() => setAddressModalOpen(true)}>
                {savedAddress ? "Editar" : "Definir"}
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              {savedAddress ? (
                <div className="space-y-1 text-sm">
                  <p className="break-words font-medium text-foreground">{savedAddress.customerName}</p>
                  <p className="break-words text-muted-foreground">{savedAddress.phone}</p>
                  <p className="break-words text-muted-foreground">{savedAddress.street}, {savedAddress.number} - {savedAddress.neighborhood}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum endereço salvo ainda.</p>
              )}
            </div>

            <div className="mt-5 hidden grid-cols-1 gap-2 lg:grid">
              <Button type="button" className="h-11 w-full rounded-xl text-sm font-semibold" style={{ backgroundColor: primaryColor }} onClick={() => submitOrder("online")} disabled={submitting}>
                {submitting ? "Abrindo pagamento..." : "Pagar online"}
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full rounded-xl text-sm font-semibold" onClick={() => submitOrder("on_delivery")} disabled={submitting}>
                Pagar na entrega
              </Button>
              <p className="text-center text-[11px] leading-4 text-muted-foreground">No pagamento online, o pedido só entra em preparo após a confirmação.</p>
            </div>

            {lastOrderCode && lastOrderStatus && (
              <div className="mt-4 rounded-xl border border-border bg-background p-3">
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setStatusExpanded((current) => !current)}>
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">Status do pedido {lastOrderCode}</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: statusColorMap[lastOrderStatus] }}>{statusMeta[lastOrderStatus].label}</p>
                  </div>
                  {statusExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                <AnimatePresence initial={false}>
                  {statusExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((step) => {
                          const active = step <= statusMeta[lastOrderStatus].step;
                          return <div key={step} className="h-1.5 rounded-full" style={{ backgroundColor: active ? statusColorMap[lastOrderStatus] : "hsl(var(--border))" }} />;
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {resumableCheckout && (
                  <Button asChild className="mt-4 h-10 w-full rounded-lg text-sm font-semibold">
                    <a href={resumableCheckout.checkoutUrl}>Continuar pagamento</a>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-base font-semibold text-foreground">Peça novamente</h2>
              <span className="text-xs text-muted-foreground">{recentOrders.length} salvos no navegador</span>
            </div>
            <div className="mt-3 space-y-2">
              {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido salvo neste navegador.</p>}
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-foreground">{order.displayId ? `Pedido #${order.displayId}` : "Pedido"}</p>
                    <span className="text-xs" style={{ color: statusColorMap[order.status] }}>{statusMeta[order.status].label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{order.items.reduce((sum, it) => sum + it.quantity, 0)} itens • R$ {order.total.toFixed(2).replace(".", ",")}</p>
                  <Button type="button" variant="outline" className="mt-2 h-10 w-full text-xs" onClick={() => reorder(order)}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Pedir novamente
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{cartItemsCount} itens</p>
            <p className="truncate text-sm font-semibold text-foreground">Total: R$ {cartTotal.toFixed(2).replace(".", ",")}</p>
          </div>
          <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl px-3 text-xs font-semibold" aria-label="Pagar na entrega" onClick={() => submitOrder("on_delivery")} disabled={submitting}>
            Na entrega
          </Button>
          <Button type="button" className="h-11 min-w-[128px] shrink-0 rounded-xl px-4 text-sm font-semibold" aria-label="Continuar para pagamento online" style={{ backgroundColor: primaryColor }} onClick={() => submitOrder("online")} disabled={submitting}>
            {submitting ? "Abrindo..." : "Pagar online"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {addressModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddressModalOpen(false)}>
            <motion.div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} onClick={(event) => event.stopPropagation()}>
              <h3 className="text-lg font-semibold text-foreground">Seu endereço</h3>
              <p className="mt-1 text-xs text-muted-foreground">Vamos salvar neste navegador para agilizar seus próximos pedidos.</p>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-name">Nome</Label>
                  <Input id="delivery-name" value={checkoutForm.customerName} onChange={(event) => updateCheckoutField("customerName", event.target.value)} placeholder="Seu nome" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-phone">Telefone</Label>
                  <Input id="delivery-phone" value={checkoutForm.phone} onChange={(event) => updateCheckoutField("phone", event.target.value)} placeholder="(00) 00000-0000" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-street">Rua</Label>
                  <Input id="delivery-street" value={checkoutForm.street} onChange={(event) => updateCheckoutField("street", event.target.value)} placeholder="Nome da rua" className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-number">Número</Label>
                    <Input id="delivery-number" value={checkoutForm.number} onChange={(event) => updateCheckoutField("number", event.target.value)} placeholder="123" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-neighborhood">Bairro</Label>
                    <Input id="delivery-neighborhood" value={checkoutForm.neighborhood} onChange={(event) => updateCheckoutField("neighborhood", event.target.value)} placeholder="Centro" className="h-11" />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setAddressModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="h-11 flex-1" style={{ backgroundColor: primaryColor }} onClick={saveAddress}>
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
