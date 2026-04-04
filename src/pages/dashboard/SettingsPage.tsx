import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { SettingsFormSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useNavigate, useSearchParams } from "react-router-dom";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";

const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    hours: "",
    description: "",
    max_tables: 20,
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_mode: "open_tab" as "open_tab" | "prepaid",
    has_asaas_key: false,
    new_asaas_api_key: "",
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const handleTestAsaasKey = async () => {
    const keyToTest = paymentForm.new_asaas_api_key.trim();
    if (!keyToTest) return;
    setTestingKey(true);
    setTestResult(null);
    try {
      const response = await fetch("https://api.asaas.com/v3/myAccount", {
        method: "GET",
        headers: {
          access_token: keyToTest,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        setTestResult({ type: "success", message: "✓ Chave válida e conectada" });
      } else if (response.status === 401) {
        setTestResult({ type: "error", message: "✗ Chave inválida. Verifique e tente novamente." });
      } else {
        setTestResult({ type: "warning", message: "⚠ Não foi possível validar. Salve e teste com um pedido real." });
      }
    } catch {
      setTestResult({ type: "warning", message: "⚠ Não foi possível validar. Salve e teste com um pedido real." });
    } finally {
      setTestingKey(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("name, address, phone, hours, description, payment_mode, max_pending_orders, max_tables, asaas_api_key")
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
            max_tables: (data as any).max_tables || 20,
          });
          setPaymentForm({
            payment_mode: (data as any).payment_mode || "open_tab",
            has_asaas_key: !!(data as any).asaas_api_key,
            new_asaas_api_key: "",
            max_pending_orders: (data as any).max_pending_orders || 3,
          });
        }

        setAccountForm({
          full_name: user.user_metadata?.full_name || "",
          email: user.email || "",
          new_password: "",
          confirm_password: "",
        });
      } catch (error: any) {
        if (import.meta.env.DEV) console.error("Error fetching restaurant data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message || "Não foi possível carregar as configurações",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("settings");

  const handleGuideComplete = () => {
    completeGuideModule("settings");
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

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
          max_tables: form.max_tables,
        } as any)
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
      const updatePayload: any = {
        payment_mode: paymentForm.payment_mode,
        max_pending_orders: paymentForm.max_pending_orders,
      };

      if (paymentForm.new_asaas_api_key.trim()) {
        updatePayload.asaas_api_key = paymentForm.new_asaas_api_key;
      }

      const { error } = await supabase
        .from("restaurants")
        .update(updatePayload)
        .eq("owner_id", user.id);

      if (error) throw error;

      if (paymentForm.new_asaas_api_key.trim()) {
        setPaymentForm(prev => ({ ...prev, has_asaas_key: true, new_asaas_api_key: "" }));
      }

      toast({ title: "Configurações de pagamento salvas", description: "Modo de operação atualizado." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
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
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
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
          Gerencie seu restaurante e sua conta
        </p>
      </div>

      <Tabs defaultValue="restaurant" className="w-full">
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-0 h-auto p-0">
          <TabsTrigger
            value="restaurant"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:font-medium text-muted-foreground text-sm px-4 py-2.5"
          >
            Restaurante
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:font-medium text-muted-foreground text-sm px-4 py-2.5"
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

                  <div className="flex items-center gap-2 text-sm">
                    {paymentForm.has_asaas_key ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 font-medium">Chave API configurada</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive font-medium">Nenhuma chave configurada</span>
                      </>
                    )}
                  </div>

                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder={paymentForm.has_asaas_key ? "Inserir nova chave para substituir" : "Sua API Key do Asaas"}
                      value={paymentForm.new_asaas_api_key}
                      onChange={(e) => {
                        setPaymentForm({ ...paymentForm, new_asaas_api_key: e.target.value });
                        setTestResult(null);
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

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingKey || !paymentForm.new_asaas_api_key.trim()}
                      onClick={handleTestAsaasKey}
                    >
                      {testingKey ? (<><Loader2 className="mr-2 h-3 w-3 animate-spin" />Testando...</>) : "Testar Conexão"}
                    </Button>
                    {testResult && (
                      <span className={`text-xs font-medium ${
                        testResult.type === "success" ? "text-green-600" :
                        testResult.type === "error" ? "text-red-600" :
                        "text-yellow-600"
                      }`}>
                        {testResult.message}
                      </span>
                    )}
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
