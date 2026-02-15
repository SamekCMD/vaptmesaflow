import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MenuTableSkeleton } from "@/components/skeletons/DashboardSkeletons";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

const initialItems: MenuItem[] = [
  { id: 1, name: "X-Burguer Especial", price: 32.9, category: "Hambúrgueres", available: true },
  { id: 2, name: "Pizza Margherita", price: 45.0, category: "Pizzas", available: true },
  { id: 3, name: "Salada Caesar", price: 28.0, category: "Saladas", available: true },
  { id: 4, name: "Suco Natural", price: 12.0, category: "Bebidas", available: false },
  { id: 5, name: "Brownie com Sorvete", price: 22.0, category: "Sobremesas", available: true },
];

const MenuManagement = () => {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: "", price: "", category: "" });
  const [loading, setLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.name || !form.price || !form.category) return;
    if (editItem) {
      setItems(items.map((i) => (i.id === editItem.id ? { ...i, name: form.name, price: parseFloat(form.price), category: form.category } : i)));
      toast({ title: "Item atualizado", description: `"${form.name}" foi editado com sucesso.` });
    } else {
      setItems([...items, { id: Date.now(), name: form.name, price: parseFloat(form.price), category: form.category, available: true }]);
      toast({ title: "Item adicionado", description: `"${form.name}" foi adicionado ao cardápio.` });
    }
    setForm({ name: "", price: "", category: "" });
    setEditItem(null);
    setDialogOpen(false);
  };

  const handleEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, price: String(item.price), category: item.category });
    setDialogOpen(true);
  };

  const handleDelete = (item: MenuItem) => {
    setItems(items.filter((i) => i.id !== item.id));
    toast({ title: "Item removido", description: `"${item.name}" foi removido do cardápio.`, variant: "destructive" });
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ name: "", price: "", category: "" });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Cardápio</h1>
            <p className="text-muted-foreground text-sm">Carregando itens...</p>
          </div>
        </div>
        <MenuTableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Cardápio</h1>
          <p className="text-muted-foreground text-sm">{items.length} itens cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: X-Burguer" />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Hambúrgueres" />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar itens..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell>R$ {item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={item.available ? "default" : "secondary"} className={item.available ? "bg-primary/10 text-primary border-0" : ""}>
                      {item.available ? "Disponível" : "Indisponível"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuManagement;
