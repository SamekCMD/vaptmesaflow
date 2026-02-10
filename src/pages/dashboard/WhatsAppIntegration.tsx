import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Wifi, WifiOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const WhatsAppIntegration = () => {
  const [connected, setConnected] = useState(true);
  const [greeting, setGreeting] = useState(
    "Olá! 👋 Bem-vindo ao Bistrô du Chef! Eu sou o assistente virtual. Posso mostrar nosso cardápio ou anotar seu pedido. Como posso ajudar?"
  );

  const handleSaveGreeting = () => {
    toast({ title: "Mensagem salva", description: "A mensagem de saudação foi atualizada." });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Integração WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Configure o bot de atendimento</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status da Conexão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${connected ? "bg-primary/10" : "bg-destructive/10"}`}>
                {connected ? <Wifi className="h-5 w-5 text-primary" /> : <WifiOff className="h-5 w-5 text-destructive" />}
              </div>
              <div>
                <p className="font-medium text-sm">WhatsApp Bot</p>
                <Badge variant={connected ? "default" : "destructive"} className={connected ? "bg-primary/10 text-primary border-0" : ""}>
                  {connected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConnected(!connected)}>
              {connected ? "Desconectar" : "Reconectar"}
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xl font-bold">147</p>
              <p className="text-xs text-muted-foreground">Mensagens hoje</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xl font-bold">23</p>
              <p className="text-xs text-muted-foreground">Pedidos via bot</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xl font-bold">98%</p>
              <p className="text-xs text-muted-foreground">Taxa de resolução</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem de Saudação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Mensagem enviada quando o cliente inicia conversa</Label>
            <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={4} className="mt-2" />
          </div>
          <Button onClick={handleSaveGreeting}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Salvar Mensagem
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppIntegration;
