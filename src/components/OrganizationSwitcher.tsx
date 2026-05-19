import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrganizationSwitcher() {
  const { organizations, currentOrg, switchOrganization, createOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      // Simple slug generation
      const slug = newOrgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await createOrganization(newOrgName, slug);
      setShowNewOrgDialog(false);
      setNewOrgName("");
    } finally {
      setIsCreating(false);
    }
  };

  if (organizations.length === 0) return null;

  return (
    <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label="Selecionar organização"
            className="w-[200px] justify-between font-medium hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="truncate">{currentOrg?.name || "Selecionar Org"}</span>
            </div>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[240px] p-2" align="start">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Organizações
          </DropdownMenuLabel>
          <div className="space-y-1 my-1">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => {
                  switchOrganization(org.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  currentOrg?.id === org.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border bg-background shrink-0">
                  <Building2 className="h-3 w-3" />
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                {currentOrg?.id === org.id && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator className="-mx-2 my-1" />
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOpen(false);
                setShowNewOrgDialog(true);
              }}
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-muted"
            >
              <PlusCircle className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Criar Organização</span>
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova organização</DialogTitle>
          <DialogDescription>
            Adicione uma nova empresa para gerenciar produtos e orçamentos separadamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome da Organização</Label>
            <Input
              id="name"
              placeholder="Ex: Minha Empresa Ltda"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNewOrgDialog(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateOrg} disabled={isCreating || !newOrgName.trim()}>
            {isCreating ? "Criando..." : "Criar Organização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
