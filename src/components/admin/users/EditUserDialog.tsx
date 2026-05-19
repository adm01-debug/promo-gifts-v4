import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, X } from "lucide-react";
import { type UserWithRole } from "./types";

interface EditUserDialogProps {
  user: UserWithRole | null;
  onClose: () => void;
  onSave: (userId: string, form: { full_name: string; email: string; is_active: boolean }) => Promise<boolean>;
  onUploadAvatar: (userId: string, file: File) => Promise<string | null>;
  onRemoveAvatar: (userId: string) => Promise<boolean>;
}

export function EditUserDialog({ user, onClose, onSave, onUploadAvatar, onRemoveAvatar }: EditUserDialogProps) {
  const [form, setForm] = useState({ full_name: "", email: "", is_active: true, avatar_url: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);

  // Sync form when user changes
  if (user && initialized !== user.user_id) {
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      is_active: user.is_active !== false,
      avatar_url: user.avatar_url || "",
    });
    setInitialized(user.user_id);
  }

  const handleClose = () => {
    setInitialized(null);
    onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setIsUploading(true);
    const url = await onUploadAvatar(user.user_id, e.target.files[0]);
    if (url) setForm((f) => ({ ...f, avatar_url: url }));
    setIsUploading(false);
  };

  const handleRemove = async () => {
    if (!user) return;
    setIsUploading(true);
    const ok = await onRemoveAvatar(user.user_id);
    if (ok) setForm((f) => ({ ...f, avatar_url: "" }));
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const ok = await onSave(user.user_id, { full_name: form.full_name, email: form.email, is_active: form.is_active });
    setIsSaving(false);
    if (ok) handleClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Altere as informações de <span className="font-semibold">{user?.full_name || "este usuário"}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={form.avatar_url || undefined} alt={form.full_name} />
                <AvatarFallback className="text-xl bg-muted">
                  {(form.full_name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> : <Camera className="h-5 w-5 text-primary-foreground" />}
              </label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Foto do Usuário</Label>
              {form.avatar_url && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={handleRemove} disabled={isUploading}>
                  <X className="h-3 w-3 mr-1" />
                  Remover
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome Completo</Label>
            <Input id="edit-name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Nome do usuário" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-active">Status Ativo</Label>
            <Switch id="edit-active" checked={form.is_active} onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
