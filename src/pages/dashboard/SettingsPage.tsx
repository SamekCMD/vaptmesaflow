import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SettingsFormSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useNavigate, useSearchParams } from "react-router-dom";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import CurrentPaymentMethodsCard from "@/components/payments/CurrentPaymentMethodsCard";
import MercadoPagoSettingsCard from "@/components/payments/MercadoPagoSettingsCard";
import { ENV } from "@/lib/env";
import { useCurrentRestaurant } from "@/features/restaurants/current-restaurant";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";

type RestaurantSettingsRow = {
  id: string;
  cnpj: string | null;
  name: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  description: string | null;
  payment_mode: "open_tab" | "prepaid" | null;
  max_pending_orders: number | null;
  max_tables: number | null;
  local_enabled: boolean | null;
  delivery_enabled: boolean | null;
};

type RestaurantSettingsUpdate = {
  name?: string;
  address?: string;
  phone?: string;
  hours?: string;
  description?: string;
  max_tables?: number;
  payment_mode?: "open_tab" | "prepaid";
  max_pending_orders?: number;
  delivery_enabled?: boolean;
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { restaurantId } = useCurrentRestaurant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const defaultTab = requestedTab === "payments" || requestedTab === "account"
    ? requestedTab
    : "restaurant";
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    hours: "",
    description: "",
    max_tables: 20,
  });
  const [channelsForm, setChannelsForm] = useState({
    local_enabled: true,
    delivery_enabled: false,
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_mode: "open_tab" as "open_tab" | "prepaid",
    max_pending_orders: 3,
  });
  const [accountForm, setAccountForm] = useState({
    full_name: "",
    email: "",
    new_password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !restaurantId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, cnpj, address, phone, hours, description, payment_mode, max_pending_orders, max_tables, local_enabled, delivery_enabled")
          .eq("id", restaurantId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const row = data as RestaurantSettingsRow;
          setForm({
            name: row.name || "",
            address: row.address || "",
            phone: row.phone || "",
            hours: row.hours || "",
            description: row.description || "",
            max_tables: row.max_tables || 20,
          });
          setPaymentForm({
            payment_mode: row.payment_mode || "open_tab",
            max_pending_orders: row.max_pending_orders || 3,
          });
          setChannelsForm({
            local_enabled: row.local_enabled ?? true,
            delivery_enabled: row.delivery_enabled ?? false,
          });
        }

        setAccountForm({
          full_name: user.user_metadata?.full_name || "",
          email: user.email || "",
          new_password: "",
          confirm_password: "",
        });
      } catch (error: unknown) {
        if (import.meta.env.DEV) console.error("Error fetching restaurant data:", error);
        const description =
          error instanceof Error ? error.message : "Não foi possível carregar as configurações";
        toast({
          title: "Erro ao carregar dados",
          description,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId, user]);

  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("settings");

  const handleGuideComplete = () => {
    completeGuideModule("settings");
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

  const handleSave = async () => {
    if (!user || !restaurantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: form.name,
          address: form.address,
          phone: form.phone,
          hours: form.hours,
          description: form.description,
          max_tables: form.max_tables,
          delivery_enabled: channelsForm.delivery_enabled,
        } satisfies RestaurantSettingsUpdate)
        .eq("id", restaurantId);

      if (error) throw error;
      toast({ title: "Configurações salvas", description: "As alterações foram aplicadas com sucesso." });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Não foi possível salvar agora.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!user || !restaurantId) return;
    setSavingPayment(true);
    try {
      const updatePayload: RestaurantSettingsUpdate = {
        payment_mode: paymentForm.payment_mode,
        max_pending_orders: paymentForm.max_pending_orders,
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updatePayload)
        .eq("id", restaurantId);

      if (error) throw error;

      toast({ title: "Fluxo de pagamento salvo", description: "O novo modo já vale para os próximos pedidos." });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Não foi possível salvar agora.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!user) return;
    setSavingAccount(true);
    try {
      // Update name
      if (accountForm.full_name !== user.user_metadata?.full_name) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: accountForm.full_name },
        });
        if (error) throw error;
      }

      // Update password if provided
      if (accountForm.new_password) {
        if (accountForm.new_password !== accountForm.confirm_password) {
          toast({ title: "As senhas não coincidem", variant: "destructive" });
          setSavingAccount(false);
          return;
        }
        if (accountForm.new_password.length < 6) {
          toast({ title: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
          setSavingAccount(false);
          return;
        }
        const { error } = await supabase.auth.updateUser({
          password: accountForm.new_password,
        });
        if (error) throw error;
        setAccountForm(prev => ({ ...prev, new_password: "", confirm_password: "" }));
      }

      toast({ title: "Conta atualizada", description: "Suas informações foram salvas." });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Não foi possível salvar agora.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return <SettingsFormSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {guideMode && (
        <OnboardingGuideCard
          module="settings"
          title={GUIDE_MODULE_CONTENT.settings.title}
          description={GUIDE_MODULE_CONTENT.settings.description}
          nextHref={guideNextModule ? getGuideModuleHref(guideNextModule) : null}
          onComplete={handleGuideComplete}
        />
      )}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie seu restaurante, pagamentos e conta
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-0 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="restaurant"
            className="min-h-11 min-w-0 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
          >
            Restaurante
          </TabsTrigger>
          <TabsTrigger
            value="payments"
            className="min-h-11 min-w-0 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
          >
            Pagamentos
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="min-h-11 min-w-0 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:text-sm"
          >
            Conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restaurant" className="pt-6 space-y-6">
          {/* Restaurant Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do Restaurante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Restaurante</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Horário de Funcionamento</Label>
                <Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Número de mesas do seu restaurante</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.max_tables}
                  onChange={(e) => setForm({ ...form, max_tables: Math.max(1, Math.min(200, Number(e.target.value))) })}
                  className="w-24"
                />
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Salvar Alterações"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Canais Ativos</CardTitle>
              <CardDescription>
                Escolha onde seu restaurante recebe pedidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <Label className="font-semibold">Atendimento no local</Label>
                  <p className="text-xs text-muted-foreground">
                    Sempre ativo na V1 para manter o fluxo presencial funcionando.
                  </p>
                </div>
                <Switch checked={true} disabled aria-label="Atendimento no local sempre ativo" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <Label className="font-semibold">Delivery próprio</Label>
                  <p className="text-xs text-muted-foreground">
                    Ative para receber pedidos remotos no seu canal.
                  </p>
                </div>
                <Switch
                  checked={channelsForm.delivery_enabled}
                  onCheckedChange={(checked) =>
                    setChannelsForm((prev) => ({ ...prev, delivery_enabled: checked }))
                  }
                  aria-label="Ativar delivery próprio"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  O Vapt organiza os pedidos do seu delivery próprio. A entrega pode ser feita pelo
                  restaurante, parceiro local ou retirada no balcão.
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Salvar Canais Ativos"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo do pedido</CardTitle>
              <CardDescription>
                Escolha quando o pagamento deve acontecer em relação ao preparo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="font-semibold">
                    {paymentForm.payment_mode === "prepaid"
                      ? "Pagamento antes do preparo"
                      : "Comanda aberta"}
                  </Label>
                  <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                    {paymentForm.payment_mode === "prepaid"
                      ? "O pedido entra na cozinha somente depois que o pagamento for confirmado."
                      : "O pedido segue direto para a cozinha e pode ser pago depois, no caixa."}
                  </p>
                </div>
                <div className="flex min-h-11 items-center justify-between gap-3 sm:justify-end">
                  <span className="text-xs font-medium text-muted-foreground">
                    {paymentForm.payment_mode === "prepaid" ? "Antecipado" : "Comanda"}
                  </span>
                  <Switch
                    checked={paymentForm.payment_mode === "prepaid"}
                    onCheckedChange={(checked) =>
                      setPaymentForm((current) => ({
                        ...current,
                        payment_mode: checked ? "prepaid" : "open_tab",
                      }))
                    }
                    aria-label="Exigir pagamento antes do preparo"
                  />
                </div>
              </div>

              {paymentForm.payment_mode === "open_tab" && (
                <div className="space-y-2">
                  <Label htmlFor="max-pending-orders">Limite de pedidos pendentes</Label>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia novos pedidos quando o cliente atingir este limite sem concluir o pagamento.
                  </p>
                  <Input
                    id="max-pending-orders"
                    type="number"
                    min={1}
                    max={10}
                    value={paymentForm.max_pending_orders}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        max_pending_orders: Number(event.target.value),
                      }))
                    }
                    className="w-24"
                  />
                </div>
              )}

              <Button onClick={handleSavePayment} disabled={savingPayment} className="w-full sm:w-auto">
                {savingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar fluxo do pedido"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6 pt-6">
          <CurrentPaymentMethodsCard />

          {restaurantId && (
            <MercadoPagoSettingsCard
              restaurantId={restaurantId}
              environment={ENV.paymentEnvironment}
            />
          )}
        </TabsContent>

        <TabsContent value="account" className="pt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações da Conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do titular</Label>
                <Input
                  value={accountForm.full_name}
                  onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={accountForm.email} disabled className="bg-muted/50" />
                <p className="text-[11px] text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
              </div>

              <Button onClick={handleSaveAccount} disabled={savingAccount}>
                {savingAccount ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Salvar"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alterar Senha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={accountForm.new_password}
                  onChange={(e) => setAccountForm({ ...accountForm, new_password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={accountForm.confirm_password}
                  onChange={(e) => setAccountForm({ ...accountForm, confirm_password: e.target.value })}
                  placeholder="Repita a nova senha"
                />
              </div>

              <Button
                onClick={handleSaveAccount}
                disabled={savingAccount || !accountForm.new_password}
                variant="outline"
              >
                {savingAccount ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Alterar Senha"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;


