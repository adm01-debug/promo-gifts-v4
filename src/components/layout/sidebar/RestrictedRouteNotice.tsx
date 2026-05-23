import { ShieldAlert, KeyRound, Lock } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  isDevOnlyPath,
  isAdminOnlyPath,
} from "@/lib/navigation/restricted-routes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RestrictedRouteNoticeProps {
  isCollapsed: boolean;
}

/**
 * Aviso contextual exibido no topo do Sidebar quando o usuário tenta
 * acessar (via URL direta, histórico ou link colado) uma rota técnica
 * para a qual não tem permissão.
 *
 * - Vendedor / Agente em rota dev/admin → mostra alerta + ação "Solicitar acesso".
 * - No modo colapsado, vira só o ícone com tooltip explicativo.
 * - Dev nunca vê (tem acesso).
 */
export function RestrictedRouteNotice({
  isCollapsed,
}: RestrictedRouteNoticeProps) {
  const location = useLocation();
  const { isAdmin, isDev, rolesLoaded } = useAuth();
  const path = location.pathname;

  const isDevRoute = isDevOnlyPath(path);
  const isAdminRoute = !isDevRoute && isAdminOnlyPath(path);

  // Dev sempre tem acesso; nada a avisar.
  if (!rolesLoaded || isDev) return null;

  // Rota técnica: precisa de dev. Bloqueia tanto vendedor quanto admin.
  // Rota admin: bloqueia só vendedor.
  const blocked =
    (isDevRoute && !isDev) || (isAdminRoute && !isAdmin && !isDev);
  if (!blocked) return null;

  const requiredRole = isDevRoute ? "dev" : "admin";
  const title = "Acesso Restrito";
  const description = isDevRoute
    ? "Esta funcionalidade é exclusiva para a equipe técnica de engenharia."
    : "Esta funcionalidade exige permissões de supervisão ou administração.";
  
  const icon = isDevRoute ? KeyRound : Lock;
  const Icon = icon;

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="status"
              aria-label={`${title}: ${description}`}
              className={cn(
                "mx-auto my-2 flex h-8 w-8 items-center justify-center rounded-md",
                "bg-amber-500/10 text-amber-500 border border-amber-500/30 transition-all duration-300",
                "hover:bg-amber-500/20 hover:border-amber-500/50"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs border-amber-500/20 bg-background/95 backdrop-blur-md">
            <p className="font-bold text-amber-500 text-xs flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" />
              {title}
            </p>
            <p className="text-[11px] mt-1 text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-4">
              <span className="text-[10px] text-muted-foreground">
                Nível: <span className="font-mono font-bold text-amber-600/80 uppercase">{requiredRole}</span>
              </span>
              <Button asChild size="xs" variant="ghost" className="h-6 text-[10px] px-2 hover:bg-amber-500/10 hover:text-amber-600">
                <Link to="/">Sair</Link>
              </Button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sidebar-restricted-notice"
      className="mx-2 my-2 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-3 shadow-sm ring-1 ring-white/5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500 shadow-inner">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-amber-500 text-[11px] uppercase tracking-wider">
              {title}
            </p>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-600 uppercase">
              {requiredRole}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            {description}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button asChild size="xs" className="h-7 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg transition-all duration-300">
              <Link to="/">Voltar ao Início</Link>
            </Button>
            <Button variant="ghost" size="xs" className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground">
              Solicitar Acesso
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

