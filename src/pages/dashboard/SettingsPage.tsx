import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const [form, setForm] = useState({
    name: "Bistrô du Chef",
    address: "Rua das Flores, 123 - Centro, São Paulo - SP",
    phone: "(11) 99999-9999",
    hours: "Seg-Sex: 11h-23h | Sáb-Dom: 11h-00h",
    description: "Restaurante especializado em culinária contemporânea com ingredientes frescos e sazonais.",
  });

  const handleSave = () => {
    toast({ title: "Configurações salvas", description: "As alterações foram aplicadas com sucesso." });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Informações do seu estabelecimento</p>
      </div>

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
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
