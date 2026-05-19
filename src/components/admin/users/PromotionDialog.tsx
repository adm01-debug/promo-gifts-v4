/**
 * Dialog de promoção (Agente <-> Supervisor) com step-up:
 *  - exige a senha do próprio supervisor
 *  - obriga justificativa (mínimo 10 caracteres)
 *  - chama edge function manage-users action=promote_role
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type UserWithRole } from "./types";

interface PromotionDialogProps {
  user: UserWithRole | null;
  /** 'supervisor' = promover; 'vendedor' = rebaixar */
  targetRole: "supervisor" | "vendedor";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (userId: string, newRole: "supervisor" | "vendedor") => void;
}

const FormSchema = z.object({
  password: z.string().min(1, "Informe sua senha"),
  reason: z
    .string()
    .trim()
    .min(10, "Justificativa deve ter pelo menos 10 caracteres")
    .max(500, "Máximo 500 caracteres"),
});

export function PromotionDialog({
  user,
  targetRole,
  open,
  onOpenChange,
  onSuccess,
}: PromotionDialogProps) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!open) {
      setPassword("");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const isPromotion = targetRole === "supervisor";
  const targetLabel = isPromotion ? "Supervisor" : "Agente";

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);

    const parsed = FormSchema.safeParse({ password, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "promote_role",
          user_id: user.user_id,
          new_role: targetRole,
          caller_password: parsed.data.password,
          reason: parsed.data.reason,
        },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);

      toast.success(
        isPromotion
          ? `${user.full_name ?? "Usuário"} promovido a Supervisor`
          : `${user.full_name ?? "Usuário"} rebaixado a Agente`
      );
      onSuccess(user.user_id, targetRole);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar papel";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPromotion ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            )}
            {isPromotion ? "Promover a Supervisor" : "Rebaixar a Agente"}
          </DialogTitle>
          <DialogDescription>
            {isPromotion
              ? "O usuário ganhará acesso à gestão de descontos, cadastros, relatórios e gestão de outros agentes."
              : "O usuário perderá acesso a gestão de descontos, cadastros e ficará restrito aos próprios dados."}
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Usuário</div>
            <div className="font-medium">{user.full_name || "Sem nome"}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="rounded bg-secondary px-2 py-0.5">
                {user.role === "vendedor" ? "Agente" : "Supervisor"}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-medium">
                {targetLabel}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reason">Motivo da alteração *</Label>
            <Textarea
              id="reason"
              placeholder="Ex.: passou a liderar a equipe comercial regional…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/500 — registrado na auditoria.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Confirme sua senha *</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha atual"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Step-up de segurança — exigido para alterações de papel.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível concluir</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isPromotion ? "Promover" : "Rebaixar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
