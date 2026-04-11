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
import { Loader2, CreditCard, ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { SettingsFormSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { useNavigate, useSearchParams } from "react-router-dom";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import { n8nClient, N8nClientError } from "@/lib/n8n-client";
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
  asaas_api_key: string | null;
  asaas_environment: "production" | "sandbox" | null;
  asaas_billing_document: string | null;
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
  asaas_environment?: "production" | "sandbox";
  asaas_billing_document?: string | null;
  asaas_api_key?: string;
};

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
    asaas_environment: "production" as "production" | "sandbox",
    asaas_billing_document: "",
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
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [settingUpAsaas, setSettingUpAsaas] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const handleTestAsaasKey = async () => {
    const keyToTest = paymentForm.new_asaas_api_key.trim();
    if (!keyToTest || !restaurantId) return;
    setTestingKey(true);
    setTestResult(null);
    try {
      const result = await n8nClient.asaas.setup({
        restaurantId,
        asaasApiKey: keyToTest,
        asaasEnvironment: paymentForm.asaas_environment,
        asaasBillingDocument: paymentForm.asaas_billing_document,
      });
      setTestResult({
        type: result.valid ? "success" : "warning",
        message: result.message,
      });
    } catch (error) {
      if (error instanceof N8nClientError) {
        setTestResult({ type: "error", message: error.message });
      } else {
        setTestResult({
          type: "warning",
          message: "Não foi possível validar agora. Tente novamente em instantes.",
        });
      }
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
          .select("id, name, cnpj, address, phone, hours, description, payment_mode, max_pending_orders, max_tables, asaas_api_key, asaas_environment, asaas_billing_document")
          .eq("owner_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          const row = data as RestaurantSettingsRow;
          setRestaurantId(row.id ?? null);
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
            has_asaas_key: !!row.asaas_api_key,
            asaas_environment: row.asaas_environment || "production",
            asaas_billing_document: row.asaas_billing_document || row.cnpj || "",
            new_asaas_api_key: "",
            max_pending_orders: row.max_pending_orders || 3,
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
        } satisfies RestaurantSettingsUpdate)
        .eq("owner_id", user.id);

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
    setSettingUpAsaas(false);
    try {
      if (paymentForm.payment_mode === "prepaid" && !paymentForm.asaas_billing_document.trim()) {
        throw new Error("Informe um CPF ou CNPJ para o cliente operacional do Asaas.");
      }

      const updatePayload: RestaurantSettingsUpdate = {
        payment_mode: paymentForm.payment_mode,
        max_pending_orders: paymentForm.max_pending_orders,
        asaas_environment: paymentForm.asaas_environment,
        asaas_billing_document: paymentForm.asaas_billing_document.trim() || null,
      };

      const pendingAsaasKey = paymentForm.new_asaas_api_key.trim();

      if (pendingAsaasKey) {
        updatePayload.asaas_api_key = pendingAsaasKey;
      }

      const { error } = await supabase
        .from("restaurants")
        .update(updatePayload)
        .eq("owner_id", user.id);

      if (error) throw error;

      if (pendingAsaasKey) {
        setSettingUpAsaas(true);
        const setupResult = await n8nClient.asaas.setup({
          restaurantId,
          asaasApiKey: pendingAsaasKey,
          asaasEnvironment: paymentForm.asaas_environment,
          asaasBillingDocument: paymentForm.asaas_billing_document,
        });

        setPaymentForm(prev => ({ ...prev, has_asaas_key: true, new_asaas_api_key: "" }));
        setTestResult({
          type: setupResult.valid ? "success" : "warning",
          message: setupResult.message,
        });
      }

      toast({ title: "Configurações de pagamento salvas", description: "Modo de operação atualizado." });
    } catch (error: unknown) {
      const description =
        error instanceof N8nClientError
          ? error.message
          : error instanceof Error
          ? error.message
          : "Não foi possível salvar agora.";
      toast({ title: "Erro ao salvar", description, variant: "destructive" });
    } finally {
      setSettingUpAsaas(false);
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
                      ? "Pagamento Antecipado - Cliente paga via Pix antes do pedido ir para a cozinha. Ideal para balcão e fast-food."
                      : "Comanda Aberta - Pedido vai direto para a cozinha, cliente paga depois. Ideal para mesas e consumo no local."}
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

                  <div className="space-y-2">
                    <Label>Ambiente da API</Label>
                    <select
                      value={paymentForm.asaas_environment}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          asaas_environment: e.target.value as "production" | "sandbox",
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="production">Produção</option>
                      <option value="sandbox">Sandbox</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Use Sandbox para chaves de teste do Asaas e Produção para chaves reais.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>CPF ou CNPJ para cobrança operacional</Label>
                    <Input
                      placeholder="Documento usado no cliente operacional do Asaas"
                      value={paymentForm.asaas_billing_document}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          asaas_billing_document: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Esse documento é usado no cliente operacional do Asaas para permitir a criação do Pix sem pedir CPF do cliente final.
                    </p>
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
                      disabled={
                        testingKey ||
                        !paymentForm.new_asaas_api_key.trim() ||
                        !paymentForm.asaas_billing_document.trim()
                      }
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
                    Sua chave será validada imediatamente e o webhook será configurado automaticamente.
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

              <Button onClick={handleSavePayment} disabled={savingPayment || settingUpAsaas}>
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


