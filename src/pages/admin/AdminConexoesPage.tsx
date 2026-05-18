import { Plug, Activity, Settings2, Network, Brain } from "lucide-react";
import { DataSourceDebugTab } from "@/components/admin/connections/DataSourceDebugTab";
import { KeysValidationTab } from "@/components/admin/connections/KeysValidationTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageSEO } from "@/components/seo/PageSEO";
import { SupabaseConnectionsTab } from "@/components/admin/connections/SupabaseConnectionsTab";
import { Bitrix24Tab } from "@/components/admin/connections/Bitrix24Tab";
import { N8nTab } from "@/components/admin/connections/N8nTab";
import { McpTab } from "@/components/admin/connections/McpTab";
import { WebhooksTab } from "@/components/admin/connections/WebhooksTab";
import { IntegrationsHealthCard } from "@/components/admin/connections/IntegrationsHealthCard";
import { SecretsManagerHealthPanel } from "@/components/admin/connections/SecretsManagerHealthPanel";
import { ExternalConnectionsSyncLogPanel } from "@/components/admin/connections/ExternalConnectionsSyncLogPanel";
import { ConnectionsOverviewTable } from "@/components/admin/connections/ConnectionsOverviewTable";
import { SmokeTestChecklist } from "@/components/admin/connections/SmokeTestChecklist";
import { AutoTestIntervalCard } from "@/components/admin/connections/AutoTestIntervalCard";
import { FailureWindowCard } from "@/components/admin/connections/FailureWindowCard";
import { AutoTestJobStatusCard } from "@/components/admin/connections/AutoTestJobStatusCard";
import { CredentialsSourceFilterProvider } from "@/components/admin/connections/CredentialsSourceFilterContext";
import { CredentialsSourceFilter } from "@/components/admin/connections/CredentialsSourceFilter";
import { CredentialsSourceIndicator } from "@/components/admin/connections/CredentialsSourceIndicator";
import { GlobalRefreshFromDbButton } from "@/components/admin/connections/GlobalRefreshFromDbButton";
import { CredentialsChangedBanner } from "@/components/admin/connections/CredentialsChangedBanner";
import { TestAllConnectionsButton } from "@/components/admin/connections/TestAllConnectionsButton";
import { ConnectionsPulseBar } from "@/components/admin/connections/ConnectionsPulseBar";
import { ConnectionsIncidentStrip } from "@/components/admin/connections/ConnectionsIncidentStrip";
import { IncidentTimeline72h } from "@/components/admin/connections/IncidentTimeline72h";
import { ZoneSection } from "@/components/admin/connections/ZoneSection";
import { SeverityFilterProvider } from "@/components/admin/connections/SeverityFilterContext";
import { SeverityFilterToolbar } from "@/components/admin/connections/SeverityFilterToolbar";
import { ExplainModeProvider } from "@/components/admin/connections/ExplainModeContext";
import { ExplainModeToggle } from "@/components/admin/connections/ExplainModeToggle";
import { AiProvidersTab } from "@/components/admin/connections/AiProvidersTab";
import { AiModelsTab } from "@/components/admin/connections/AiModelsTab";
import { AiRoutingTab } from "@/components/admin/connections/AiRoutingTab";
import { useCallback, useEffect, useState } from "react";
import { useSecretsManager } from "@/hooks/useSecretsManager";
import { useSeverityChangeNotifier } from "@/components/admin/connections/useSeverityChangeNotifier";
import { useZoneVisibility, type ZoneId } from "@/components/admin/connections/useZoneVisibility";
import { useZoneCollapse } from "@/components/admin/connections/useZoneCollapse";
import { ZoneQuickNav } from "@/components/admin/connections/ZoneQuickNav";
import { HeaderSeveritySummary } from "@/components/admin/connections/HeaderSeveritySummary";
import { ZoneRefreshButton } from "@/components/admin/connections/ZoneRefreshButton";
import {
  ZoneCommandPalette,
  useZoneCommandPaletteShortcut,
} from "@/components/admin/connections/ZoneCommandPalette";
import { ZoneCommandTrigger } from "@/components/admin/connections/ZoneCommandTrigger";
import { useFocusContext } from "@/components/admin/connections/useFocusContext";

/**
 * /admin/conexoes — Hub Central de Integrações
 *
 * Layout reorganizado em 4 zonas semânticas:
 *   1. Health     → Pulse Bar (sticky), Incident Strip, Health Card
 *   2. Operation  → Configurações operacionais (intervalos, janela, status do job)
 *   3. Connections→ Visão geral, filtros e abas por tipo de integração
 *   4. AI Router  → Providers, Models e Roteamento por function_name (multi-provider)
 *
 * Hierarquia visual: cada zona usa <ZoneSection> com header consistente
 * (ícone + título + descrição), barra lateral colorida e espaçamento padronizado
 * (space-y-8 entre zonas, space-y-4 dentro de cada zona).
 */
export default function AdminConexoesPage() {
  const { secrets, list, refreshCache, isLoading: secretsLoading } = useSecretsManager();
  const [refreshTick, setRefreshTick] = useState(0);
  const { visible, toggle, showAll, isolateZone, hiddenCount } = useZoneVisibility();
  const { collapsed, toggle: toggleCollapse, expand: expandZone } = useZoneCollapse();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useZoneCommandPaletteShortcut();
  const [highlightZone, setHighlightZone] = useState<string | null>(null);
  const { context: focusContext, setZone: persistZone, setIncident: persistIncident } = useFocusContext();
  useEffect(() => { list(); }, [list]);
  // Toast automático em escaladas P0/P1 — com confirmação para não repetir
  useSeverityChangeNotifier();

  // Listener para "ir até zona" disparado pela Incident Strip / Quick Nav / Palette:
  // reabre a zona se estiver oculta, rola até ela, aplica highlight 1.8s e persiste o foco.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ zone: ZoneId; anchorId: string }>).detail;
      if (!detail) return;
      const { zone, anchorId } = detail;
      // Reabre zona se estiver oculta
      if (!visible[zone]) toggle(zone);
      // Garante que esteja expandida (não colapsada)
      expandZone(zone);
      // Persiste para restaurar no próximo reload
      persistZone(zone);
      // Aguarda render para garantir que o nó existe
      requestAnimationFrame(() => {
        const el = document.getElementById(anchorId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          setHighlightZone(anchorId);
          window.setTimeout(() => setHighlightZone((cur) => (cur === anchorId ? null : cur)), 1800);
        }
      });
    };
    window.addEventListener("connections:focus-zone", handler);
    return () => window.removeEventListener("connections:focus-zone", handler);
  }, [visible, toggle, expandZone, persistZone]);

  // Listener para abertura de incidente (drawer) — persiste o id para restaurar no reload.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ incidentId: string | null }>).detail;
      if (!detail) return;
      persistIncident(detail.incidentId);
    };
    window.addEventListener("connections:incident-open", handler);
    return () => window.removeEventListener("connections:incident-open", handler);
  }, [persistIncident]);

  // Restauração one-shot ao montar: recoloca o usuário na última zona em foco.
  // (O drawer do último incidente é reaberto pela ConnectionsIncidentStrip,
  // que tem acesso aos dados carregados.)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored) return;
    if (!focusContext.lastZone) {
      setRestored(true);
      return;
    }
    const zone = focusContext.lastZone;
    const anchorId = `zone-${zone}`;
    if (!visible[zone]) toggle(zone);
    expandZone(zone);
    requestAnimationFrame(() => {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setHighlightZone(anchorId);
        window.setTimeout(
          () => setHighlightZone((cur) => (cur === anchorId ? null : cur)),
          1800,
        );
      }
      setRestored(true);
    });
    // Intencionalmente roda apenas uma vez no mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGlobalRefreshed = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <SeverityFilterProvider>
      <ExplainModeProvider>
      <CredentialsSourceFilterProvider>
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <PageSEO title="Conexões | Admin" description="Hub central de integrações externas: Supabase, Bitrix24, n8n, MCP, Webhooks, AI Router." />

          {/* Pulse Bar sticky + Timeline 72h + Incident Strip ficam fora das zonas */}
          <ConnectionsPulseBar />
          <IncidentTimeline72h />
          <ConnectionsIncidentStrip />

          {/* Page Header */}
          <header className="flex items-center gap-3 pb-2 border-b border-border/40">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plug className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">Conexões</h1>
              <p className="text-sm text-muted-foreground">
                Hub central de integrações externas e credenciais do sistema.
              </p>
            </div>
            <HeaderSeveritySummary className="mr-1 hidden sm:inline-flex" />
            <ZoneCommandTrigger onOpen={() => setPaletteOpen(true)} />
            <GlobalRefreshFromDbButton onRefreshed={handleGlobalRefreshed} />
            <TestAllConnectionsButton />
            <SmokeTestChecklist availableSecrets={secrets} />
          </header>

          <ZoneCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

          {/* Faixa de auto-refresh: aparece quando integration_credentials muda no banco (Realtime) */}
          <CredentialsChangedBanner onRefreshed={handleGlobalRefreshed} />

          {/* Filtro global de severidade + toggle "ver como calculamos" */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SeverityFilterToolbar />
            <ExplainModeToggle />
          </div>

          {/* Quick nav (anchors + toggles de visibilidade por zona) */}
          <ZoneQuickNav
            visible={visible}
            onToggle={toggle}
            onIsolate={isolateZone}
            onShowAll={showAll}
            hiddenCount={hiddenCount}
          />

        {/* Zonas semânticas com mais respiro entre elas */}
        <div className="space-y-8">
          {/* ZONA 1 — HEALTH */}
          {visible.health && (
          <ZoneSection
            id="zone-health"
            icon={Activity}
            title="Saúde"
            description="Status agregado das integrações em tempo real (health check a cada 60s)."
            tone="primary"
            highlight={highlightZone === "zone-health"}
            collapsed={collapsed.health}
            onToggleCollapse={() => toggleCollapse("health")}
            actions={
              <ZoneRefreshButton
                label="Atualizar zona Saúde"
                successMessage="Saúde atualizada"
                queryKeys={[
                  ["integrations-health"],
                  ["connections-pulse-bar"],
                  ["connections-recent-incidents"],
                  ["connections-incident-timeline-72h"],
                ]}
              />
            }
          >
            <IntegrationsHealthCard secrets={secrets} />
            <SecretsManagerHealthPanel />
            <ExternalConnectionsSyncLogPanel />
          </ZoneSection>
          )}

          {/* ZONA 2 — OPERATION */}
          {visible.operation && (
          <ZoneSection
            id="zone-operation"
            icon={Settings2}
            title="Operação"
            description="Configurações do auto-test (verificação periódica), janela de falha contínua e status do job de monitoramento."
            tone="info"
            highlight={highlightZone === "zone-operation"}
            collapsed={collapsed.operation}
            onToggleCollapse={() => toggleCollapse("operation")}
            actions={
              <ZoneRefreshButton
                label="Atualizar zona Operação (cron, intervalos, janela)"
                successMessage="Operação atualizada"
                queryKeys={[
                  ["auto-test-interval"],
                  ["failure-window"],
                  ["auto-test-job-status"],
                  ["connections-pulse-bar"],
                ]}
              />
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <AutoTestIntervalCard />
              <FailureWindowCard />
            </div>
            <AutoTestJobStatusCard />
          </ZoneSection>
          )}

          {/* ZONA 3 — CONNECTIONS */}
          {visible.connections && (
          <ZoneSection
            id="zone-connections"
            icon={Network}
            title="Conexões"
            description="Visão consolidada de todas as integrações ativas e gestão por tipo (banco, Bitrix24, n8n, MCP, webhooks)."
            tone="neutral"
            highlight={highlightZone === "zone-connections"}
            collapsed={collapsed.connections}
            onToggleCollapse={() => toggleCollapse("connections")}
            actions={
              <ZoneRefreshButton
                label="Atualizar zona Conexões (tabela e abas)"
                successMessage="Conexões atualizadas"
                queryKeys={[["connections-overview"]]}
                onRefresh={() => setRefreshTick((n) => n + 1)}
              />
            }
          >
            <CredentialsSourceIndicator
              secrets={secrets}
              isLoading={secretsLoading}
              onRefresh={async () => {
                const result = await refreshCache();
                if (!result.ok) {
                  throw new Error(result.error?.message ?? "Falha no refresh_cache");
                }
                await list();
              }}
            />

            {secrets.length > 0 && (
              <CredentialsSourceFilter
                secrets={secrets}
                className="rounded-lg border bg-card px-4 py-3"
              />
            )}

            <ConnectionsOverviewTable refreshSignal={refreshTick} />

            <Tabs defaultValue="databases" className="space-y-4 pt-2">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="databases">Bancos de Dados</TabsTrigger>
                <TabsTrigger value="bitrix24">Bitrix24</TabsTrigger>
                <TabsTrigger value="n8n">n8n</TabsTrigger>
                <TabsTrigger value="mcp">MCP (Claude)</TabsTrigger>
                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                <TabsTrigger value="debug">🐛 Debug</TabsTrigger>
                <TabsTrigger value="validation">🛡️ Validação</TabsTrigger>
              </TabsList>
              <TabsContent value="databases"><SupabaseConnectionsTab /></TabsContent>
              <TabsContent value="bitrix24"><Bitrix24Tab /></TabsContent>
              <TabsContent value="n8n"><N8nTab /></TabsContent>
              <TabsContent value="mcp"><McpTab /></TabsContent>
              <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
              <TabsContent value="debug"><DataSourceDebugTab /></TabsContent>
              <TabsContent value="validation"><KeysValidationTab /></TabsContent>
            </Tabs>
          </ZoneSection>
          )}

          {/* ZONA 4 — AI ROUTER (multi-provider) */}
          {visible["ai-router"] && (
          <ZoneSection
            id="zone-ai-router"
            icon={Brain}
            title="AI Router"
            description="Provedores, modelos e roteamento por edge function. Configure aqui quem responde a cada chamada de IA, com fallback automático em falha."
            tone="primary"
            highlight={highlightZone === "zone-ai-router"}
            collapsed={collapsed["ai-router"]}
            onToggleCollapse={() => toggleCollapse("ai-router")}
            actions={
              <ZoneRefreshButton
                label="Atualizar zona AI Router"
                successMessage="AI Router atualizado"
                queryKeys={[
                  ["ai-router", "providers"],
                  ["ai-router", "models"],
                  ["ai-router", "routing"],
                ]}
              />
            }
          >
            <Tabs defaultValue="providers" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="providers">Providers</TabsTrigger>
                <TabsTrigger value="models">Modelos</TabsTrigger>
                <TabsTrigger value="routing">Roteamento</TabsTrigger>
              </TabsList>
              <TabsContent value="providers"><AiProvidersTab /></TabsContent>
              <TabsContent value="models"><AiModelsTab /></TabsContent>
              <TabsContent value="routing"><AiRoutingTab /></TabsContent>
            </Tabs>
          </ZoneSection>
          )}
        </div>
      </div>
    </CredentialsSourceFilterProvider>
    </ExplainModeProvider>
    </SeverityFilterProvider>
  );
}
