import { useState, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { toast } from "@/hooks/use-toast";

import { Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("name, address, phone, hours, description")
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
        }
      } catch (error: any) {
        console.error("Error fetching restaurant data:", error);
        toast({
          title: "Erro ao carregar dados",
          description:
            error.message || "Não foi possível carregar as configurações",
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

      toast({
        title: "Configurações salvas",
        description: "As alterações foram aplicadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);

      toast({
        title: "Erro ao salvar",
        description:
          error.message || "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Restaurante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Restaurante</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Horário de Funcionamento</Label>
            <Input
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
