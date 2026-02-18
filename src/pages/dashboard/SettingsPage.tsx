import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { SettingsFormSkeleton } from "@/components/skeletons/DashboardSkeletons";

const SettingsPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    hours: "",
    description: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_mode: "open_tab" as "open_tab" | "prepaid",
    asaas_api_key: "",
    max_pending_orders: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("name, address, phone, hours, description, payment_mode, asaas_api_key, max_pending_orders")
          .eq("owner_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setForm({
            name: data.name || "",
            address: data.address || "",
            phone: data.phone || "",
            hours: data.hours || "",
            description: data.description || "",
          });
          setPaymentForm({
            payment_mode: (data as any).payment_mode || "open_tab",
            asaas_api_key: (data as any).asaas_api_key || "",
            max_pending_orders: (data as any).max_pending_orders || 3,
          });
        }
      } catch (error: any) {
        console.error("Error fetching restaurant data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message || "Não foi possível carregar as configurações",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
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
        })
        .eq("owner_id", user.id);

      if (error) throw error;
      toast({ title: "Configurações salvas", description: "As alterações foram aplicadas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!user) return;

    setSavingPayment(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          payment_mode: paymentForm.payment_mode,
          asaas_api_key: paymentForm.asaas_api_key,
          max_pending_orders: paymentForm.max_pending_orders,
        } as any)
        .eq("owner_id", user.id);

      if (error) throw error;
      toast({ title: "Configurações de pagamento salvas", description: "Modo de operação atualizado." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return <SettingsFormSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Informações do seu estabelecimento
        </p>
      </div>

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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Config Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Configurações de Pagamento</CardTitle>
              <CardDescription>Defina o modo de operação do seu restaurante</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1">
              <Label className="font-semibold">Modo de Operação</Label>
              <p className="text-xs text-muted-foreground">
                {paymentForm.payment_mode === "prepaid"
                  ? "Pagamento Antecipado — Cliente paga via Pix antes do pedido ir para a cozinha. Ideal para balcão e fast-food."
                  : "Comanda Aberta — Pedido vai direto para a cozinha, cliente paga depois. Ideal para mesas e consumo no local."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked={paymentForm.payment_mode === "prepaid"}
                onCheckedChange={(checked) =>
                  setPaymentForm({ ...paymentForm, payment_mode: checked ? "prepaid" : "open_tab" })
                }
              />
              <span className="text-xs font-medium">
                {paymentForm.payment_mode === "prepaid" ? "Antecipado" : "Comanda"}
              </span>
            </div>
          </div>

          {/* Asaas API Key - visible when prepaid */}
          {paymentForm.payment_mode === "prepaid" && (
            <div className="space-y-3 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Integração Asaas</Label>
              </div>

              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Sua API Key do Asaas"
                  value={paymentForm.asaas_api_key}
                  onChange={(e) => {
                    setPaymentForm({ ...paymentForm, asaas_api_key: e.target.value });
                  }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Sua chave será validada automaticamente ao processar o primeiro pagamento.
              </p>
            </div>
          )}

          {/* Max pending orders - visible when open_tab */}
          {paymentForm.payment_mode === "open_tab" && (
            <div className="space-y-2">
              <Label>Limite de Pedidos Pendentes (Anti-fraude)</Label>
              <p className="text-xs text-muted-foreground">
                Máximo de pedidos que um cliente pode ter pendentes antes que novos sejam bloqueados.
              </p>
              <Input
                type="number"
                min={1}
                max={10}
                value={paymentForm.max_pending_orders}
                onChange={(e) => setPaymentForm({ ...paymentForm, max_pending_orders: Number(e.target.value) })}
                className="w-24"
              />
            </div>
          )}

          <Button onClick={handleSavePayment} disabled={savingPayment}>
            {savingPayment ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : "Salvar Configurações de Pagamento"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
