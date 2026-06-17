/**
 * Centralized lazy-loaded page imports.
 *
 * All page components are loaded via lazyWithRetry for code-splitting and
 * resilient fetch retry on network failures.
 *
 * Organized by area for navigability.
 */
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// ─────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────
export const Auth = lazyWithRetry(() => import('@/pages/auth/Auth'));
export const Unauthorized = lazyWithRetry(() =>
  import('@/components/access/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })),
);
export const ResetPassword = lazyWithRetry(() => import('@/pages/auth/ResetPassword'));
export const ForgotPasswordConfirmation = lazyWithRetry(
  () => import('@/pages/auth/ForgotPasswordConfirmation'),
);
export const SSOCallbackPage = lazyWithRetry(() => import('@/pages/auth/SSOCallbackPage'));
export const TermsPage = lazyWithRetry(() => import('@/pages/auth/TermsPage'));
export const PrivacyPage = lazyWithRetry(() => import('@/pages/auth/PrivacyPage'));

// ─────────────────────────────────────────────────────────────────
// Home / Dashboard / Misc
// ─────────────────────────────────────────────────────────────────
export const Index = lazyWithRetry(() => import('@/pages/Index'));
export const NotFound = lazyWithRetry(() => import('@/pages/NotFound'));
export const CustomizableDashboard = lazyWithRetry(() => import('@/pages/CustomizableDashboard'));

// ─────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────
export const ProductDetail = lazyWithRetry(() => import('@/pages/products/ProductDetail'));
export const FiltersPage = lazyWithRetry(() => import('@/pages/products/FiltersPage'));
export const NoveltiesPage = lazyWithRetry(() => import('@/pages/products/NoveltiesPage'));
export const ReplenishmentsPage = lazyWithRetry(
  () => import('@/pages/products/ReplenishmentsPage'),
);
export const FavoritesPage = lazyWithRetry(() => import('@/pages/products/FavoritesPage'));
export const SellerCartsPage = lazyWithRetry(() => import('@/pages/products/SellerCartsPage'));
export const CartsListPage = lazyWithRetry(() => import('@/pages/products/CartsListPage'));
export const ComparePage = lazyWithRetry(() => import('@/pages/products/ComparePage'));
export const CollectionsPage = lazyWithRetry(() => import('@/pages/collections/CollectionsPage'));
export const CollectionDetailPage = lazyWithRetry(
  () => import('@/pages/collections/CollectionDetailPage'),
);

// ─────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────
export const QuoteTemplatesPage = lazyWithRetry(() => import('@/pages/quotes/QuoteTemplatesPage'));
export const QuotesListPage = lazyWithRetry(() => import('@/pages/quotes/QuotesListPage'));
export const QuotesDashboardPage = lazyWithRetry(
  () => import('@/pages/quotes/QuotesDashboardPage'),
);
export const QuoteBuilderPage = lazyWithRetry(() => import('@/pages/quotes/QuoteBuilderPage'));
export const QuoteViewPage = lazyWithRetry(() => import('@/pages/quotes/QuoteViewPage'));
export const QuotesKanbanPage = lazyWithRetry(() => import('@/pages/quotes/QuotesKanbanPage'));

// ─────────────────────────────────────────────────────────────────
// Admin (supervisor + dev)
// ─────────────────────────────────────────────────────────────────
export const AdminUsuariosPage = lazyWithRetry(() => import('@/pages/admin/AdminUsuariosPage'));
export const AdminPromoverUsuarioPage = lazyWithRetry(
  () => import('@/pages/admin/AdminPromoverUsuarioPage'),
);
export const AdminSegurancaPage = lazyWithRetry(() => import('@/pages/admin/AdminSegurancaPage'));
export const AdminCadastrosPage = lazyWithRetry(() => import('@/pages/admin/AdminCadastrosPage'));
export const AdminPromptsIAPage = lazyWithRetry(() => import('@/pages/admin/AdminPromptsIAPage'));
export const AdminProductFormPage = lazyWithRetry(
  () => import('@/pages/admin/AdminProductFormPage'),
);
export const AdminTelemetriaPage = lazyWithRetry(() => import('@/pages/admin/AdminTelemetriaPage'));
export const AdminClientPerformancePage = lazyWithRetry(
  () => import('@/pages/admin/AdminClientPerformancePage'),
);
export const AdminDesignTokensPage = lazyWithRetry(
  () => import('@/pages/admin/AdminDesignTokensPage'),
);
export const AdminTemasPage = lazyWithRetry(() => import('@/pages/admin/AdminTemasPage'));
export const AdminWorkflowsPage = lazyWithRetry(() => import('@/pages/admin/AdminWorkflowsPage'));
export const AdminLoginAttemptsPage = lazyWithRetry(
  () => import('@/pages/admin/AdminLoginAttemptsPage'),
);
export const AdminExternalDbPage = lazyWithRetry(() => import('@/pages/admin/AdminExternalDbPage'));
export const AdminVideoVariantsPage = lazyWithRetry(
  () => import('@/pages/admin/AdminVideoVariantsPage'),
);
export const AdminAiUsagePage = lazyWithRetry(() => import('@/pages/admin/AdminAiUsagePage'));
export const KitTemplatesAdminPage = lazyWithRetry(
  () => import('@/pages/admin/KitTemplatesAdminPage'),
);
export const KitTemplatesMetricsPage = lazyWithRetry(
  () => import('@/pages/admin/KitTemplatesMetricsPage'),
);
export const PriceFreshnessSettingsPage = lazyWithRetry(
  () => import('@/pages/admin/PriceFreshnessSettings'),
);
export const IntelligenceBadgeSettingsPage = lazyWithRetry(
  () => import('@/pages/admin/IntelligenceBadgeSettingsPage'),
);
export const AdminSegurancaAcessoPage = lazyWithRetry(
  () => import('@/pages/admin/AdminSegurancaAcessoPage'),
);
export const AdminSegurancaChavesPage = lazyWithRetry(
  () => import('@/pages/admin/AdminSegurancaChavesPage'),
);
export const DevChallengeExamplesPage = lazyWithRetry(
  () => import('@/pages/admin/DevChallengeExamplesPage'),
);
export const AdminMigracaoPapeisPage = lazyWithRetry(
  () => import('@/pages/admin/AdminMigracaoPapeisPage'),
);
export const AdminConexoesPage = lazyWithRetry(() => import('@/pages/admin/AdminConexoesPage'));
export const AdminConexoesStatusPage = lazyWithRetry(
  () => import('@/pages/admin/AdminConexoesStatusPage'),
);
export const ObservabilityDashboardPage = lazyWithRetry(
  () => import('@/pages/admin/ObservabilityDashboard'),
);
export const AdminRbacRoutesPage = lazyWithRetry(() => import('@/pages/admin/AdminRbacRoutesPage'));
export const SellerDiscountLimitsAdminPage = lazyWithRetry(
  () => import('@/pages/admin/SellerDiscountLimitsAdminPage'),
);
export const RlsDenialsAdminPage = lazyWithRetry(() => import('@/pages/admin/RlsDenialsAdminPage'));
export const OwnershipAuditAdminPage = lazyWithRetry(
  () => import('@/pages/admin/OwnershipAuditAdminPage'),
);
export const StorageTestPage = lazyWithRetry(() => import('@/pages/admin/StorageTestPage'));
export const AdminCloudflareImagesPage = lazyWithRetry(
  () => import('@/pages/admin/AdminCloudflareImagesPage'),
);

// ─────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────
export const SimuladorWizard = lazyWithRetry(() => import('@/pages/tools/SimuladorWizard'));
export const MockupGenerator = lazyWithRetry(() => import('@/pages/mockups/MockupGenerator'));
export const MagicUp = lazyWithRetry(() => import('@/pages/tools/MagicUp'));
export const PriceSimulatorPage = lazyWithRetry(() => import('@/pages/tools/PriceSimulatorPage'));
export const StockDashboardPage = lazyWithRetry(() => import('@/pages/admin/StockDashboardPage'));
export const AdvancedPriceSearchPage = lazyWithRetry(
  () => import('@/pages/tools/AdvancedPriceSearchPage'),
);
export const KitBuilderPage = lazyWithRetry(() => import('@/pages/kit-builder/KitBuilderPage'));
export const MeusKitsPage = lazyWithRetry(() => import('@/pages/kit-builder/KitLibraryPage'));
export const MockupHistoryPage = lazyWithRetry(() => import('@/pages/mockups/MockupHistoryPage'));
export const DropboxBrowserPage = lazyWithRetry(() => import('@/pages/tools/DropboxBrowserPage'));
export const CommercialIntelligencePage = lazyWithRetry(
  () => import('@/pages/bi/CommercialIntelligencePage'),
);
export const ProductMatchPage = lazyWithRetry(() => import('@/pages/products/ProductMatchPage'));
export const BusinessIntelligencePage = lazyWithRetry(
  () => import('@/pages/bi/BusinessIntelligencePage'),
);
export const ClientComparatorPage = lazyWithRetry(
  () => import('@/pages/clients/ClientComparatorPage'),
);
export const SimulationPage = lazyWithRetry(() => import('@/pages/Simulation'));
export const CoverageInsightsDashboardPage = lazyWithRetry(
  () => import('@/pages/tools/CoverageInsightsDashboardPage'),
);
export const VisualSearchPage = lazyWithRetry(() => import('@/pages/tools/VisualSearchPage'));

// ─────────────────────────────────────────────────────────────────
// Clients (CRM)
// ─────────────────────────────────────────────────────────────────
export const ClientsPage = lazyWithRetry(() => import('@/pages/clients/ClientsPage'));
export const ClientDetailPage = lazyWithRetry(() => import('@/pages/clients/ClientDetailPage'));

// ─────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────
export const TrendsPage = lazyWithRetry(() => import('@/pages/bi/TrendsPage'));

// ─────────────────────────────────────────────────────────────────
// System (dev-only)
// ─────────────────────────────────────────────────────────────────
export const SystemStatusPage = lazyWithRetry(() => import('@/pages/system/SystemStatusPage'));
export const RateLimitDashboard = lazyWithRetry(
  () => import('@/pages/system/RateLimitDashboardPage'),
);
export const ExternalDatabaseTest = lazyWithRetry(
  () => import('@/pages/system/ExternalDatabaseTest'),
);

// ─────────────────────────────────────────────────────────────────
// Roles & Permissions (admin)
// ─────────────────────────────────────────────────────────────────
export const PermissionsPage = lazyWithRetry(() => import('@/pages/admin/PermissionsPage'));
export const RolesPage = lazyWithRetry(() => import('@/pages/admin/RolesPage'));
export const RolePermissionsPage = lazyWithRetry(() => import('@/pages/admin/RolePermissionsPage'));

// ─────────────────────────────────────────────────────────────────
// QA / Internal
// ─────────────────────────────────────────────────────────────────
export const QAPage = lazyWithRetry(() => import('@/pages/QAPage'));
export const SidebarQAPage = lazyWithRetry(() => import('@/pages/SidebarQAPage'));
export const PromoFlixPlayground = lazyWithRetry(() => import('@/pages/PromoFlixPlayground'));
export const OptimizedImageDemo = lazyWithRetry(() => import('@/pages/tools/OptimizedImageDemo'));
