import { Navigate, Route } from 'react-router-dom';
import { AdminRoute } from '@/components/layout/AdminRoute';
import { DevRoute } from '@/components/layout/DevRoute';
import { DeprecatedRoute } from '@/components/layout/DeprecatedRoute';
import {
  AdminAiUsagePage,
  AdminClientPerformancePage,
  AdminCadastrosPage,
  AdminConexoesPage,
  AdminConexoesStatusPage,
  AdminDesignTokensPage,
  AdminExternalDbPage,
  AdminLoginAttemptsPage,
  AdminMigracaoPapeisPage,
  AdminProductFormPage,
  AdminPromoverUsuarioPage,
  AdminPromptsIAPage,
  AdminRbacRoutesPage,
  AdminSegurancaAcessoPage,
  AdminSegurancaChavesPage,
  AdminSegurancaPage,
  AdminTelemetriaPage,
  EmaHealthPage,

  AdminUsuariosPage,
  AdminVideoVariantsPage,
  AdminWorkflowsPage,
  DevChallengeExamplesPage,
  ExternalDatabaseTest,
  KitTemplatesAdminPage,
  KitTemplatesMetricsPage,
  OwnershipAuditAdminPage,
  PermissionsPage,
  PriceFreshnessSettingsPage,
  IntelligenceBadgeSettingsPage,
  QAPage,
  RateLimitDashboard,
  RlsDenialsAdminPage,
  RolePermissionsPage,
  RolesPage,
  SellerDiscountLimitsAdminPage,
  SidebarQAPage,
  StorageTestPage,
  AdminCloudflareImagesPage,
  SystemStatusPage,
  TrendsPage,
  ObservabilityDashboardPage,
} from './lazy-pages';

/**
 * Admin routes — supervisor + dev (gestão de negócio).
 *
 * Wrapped in `<AdminRoute />`. Internally, dev-only pages (telemetria,
 * conexões, secrets, MCP, audit técnico, prompts IA) are wrapped in
 * `<DevRoute />` for elevated permission gating.
 *
 * Mounted under ProtectedRoute.
 */
export const adminRoutes = (
  <>
    <Route path="/tendencias" element={<TrendsPage />} />
    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
      <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
      <Route path="/admin/usuarios/promover" element={<AdminPromoverUsuarioPage />} />
      <Route path="/admin/limites-desconto" element={<SellerDiscountLimitsAdminPage />} />
      <Route path="/admin/rls-denials" element={<RlsDenialsAdminPage />} />
      <Route path="/admin/auditoria-propriedade" element={<OwnershipAuditAdminPage />} />
      <Route path="/admin/cadastros" element={<AdminCadastrosPage />} />
      <Route path="/admin/cadastros/produto/:id" element={<AdminProductFormPage />} />
      <Route path="/admin/permissoes" element={<PermissionsPage />} />
      <Route path="/admin/roles" element={<RolesPage />} />
      <Route path="/admin/role-permissoes" element={<RolePermissionsPage />} />
      <Route path="/admin/video-variantes" element={<AdminVideoVariantsPage />} />
      <Route path="/admin/kit-templates" element={<KitTemplatesAdminPage />} />
      <Route path="/admin/kit-templates/metricas" element={<KitTemplatesMetricsPage />} />
      <Route
        path="/admin/aprovacoes-desconto"
        element={<Navigate to="/admin/usuarios?tab=discounts" replace />}
      />
      <Route
        path="/admin/performance"
        element={
          <DeprecatedRoute
            message="O módulo de Performance foi descontinuado. Use o BI Comercial para análises."
            redirectTo="/ferramentas/bi"
          />
        }
      />
      <Route
        path="/admin/performance-comercial"
        element={
          <DeprecatedRoute
            message="O módulo de Performance Comercial foi descontinuado. Use o BI Comercial para análises."
            redirectTo="/ferramentas/bi"
          />
        }
      />
      <Route
        path="/admin/comissoes"
        element={
          <DeprecatedRoute
            message="O módulo de Comissões foi descontinuado nesta plataforma."
            redirectTo="/admin/usuarios"
          />
        }
      />
    </Route>

    {/* DEV-ONLY — páginas técnicas com risco elevado (telemetria, conexões, secrets, MCP, audit técnico, prompts IA) */}
    <Route element={<DevRoute />}>
      <Route path="/admin/seguranca" element={<AdminSegurancaPage />} />
      <Route path="/admin/seguranca-acesso" element={<AdminSegurancaAcessoPage />} />
      <Route path="/admin/seguranca/chaves" element={<AdminSegurancaChavesPage />} />
      <Route path="/admin/seguranca/exemplos-challenge" element={<DevChallengeExamplesPage />} />
      <Route path="/admin/seguranca/migracao-papeis" element={<AdminMigracaoPapeisPage />} />
      <Route path="/admin/prompts-ia" element={<AdminPromptsIAPage />} />
      <Route path="/admin/validade-precos" element={<PriceFreshnessSettingsPage />} />
      <Route path="/admin/badges-inteligencia" element={<IntelligenceBadgeSettingsPage />} />
      <Route path="/admin/telemetria" element={<AdminTelemetriaPage />} />
      <Route path="/admin/ema-health" element={<EmaHealthPage />} />

      <Route path="/admin/design-tokens" element={<AdminDesignTokensPage />} />
      <Route path="/admin/client-performance" element={<AdminClientPerformancePage />} />
      <Route path="/admin/rate-limit" element={<RateLimitDashboard />} />
      <Route path="/admin/workflows" element={<AdminWorkflowsPage />} />
      <Route path="/admin/login-attempts" element={<AdminLoginAttemptsPage />} />
      <Route path="/admin/external-db" element={<AdminExternalDbPage />} />
      <Route path="/admin/consumo-ia" element={<AdminAiUsagePage />} />
      <Route path="/admin/conexoes" element={<AdminConexoesPage />} />
      <Route path="/admin/conexoes/status" element={<AdminConexoesStatusPage />} />
      <Route path="/admin/status" element={<SystemStatusPage />} />
      <Route path="/external-db-test" element={<ExternalDatabaseTest />} />
      <Route path="/admin/rbac-rotas" element={<AdminRbacRoutesPage />} />
      <Route path="/admin/storage-test" element={<StorageTestPage />} />
      <Route path="/admin/qa" element={<QAPage />} />
      <Route path="/admin/qa/sidebar" element={<SidebarQAPage />} />
      <Route path="/admin/observabilidade" element={<ObservabilityDashboardPage />} />
      <Route path="/admin/cloudflare-images" element={<AdminCloudflareImagesPage />} />
    </Route>
  </>
);
