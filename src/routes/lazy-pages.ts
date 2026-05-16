/**
 * Centralized lazy-loaded page imports.
 *
 * All page components are loaded via lazyWithRetry for code-splitting and
 * resilient fetch retry on network failures.
 *
 * Organized by area for navigability.
 */
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// ─────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────
export const Auth = lazyWithRetry(() => import("@/pages/Auth"));
export const Unauthorized = lazyWithRetry(() =>
  import("@/components/access/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })),
);
export const ResetPassword = lazyWithRetry(() => import("@/pages/ResetPassword"));
export const SSOCallbackPage = lazyWithRetry(() => import("@/pages/SSOCallbackPage"));
export const TermsPage = lazyWithRetry(() => import("@/pages/TermsPage"));
export const PrivacyPage = lazyWithRetry(() => import("@/pages/PrivacyPage"));

// ─────────────────────────────────────────────────────────────────
// Home / Dashboard / Misc
// ─────────────────────────────────────────────────────────────────
export const Index = lazyWithRetry(() => import("@/pages/Index"));
export const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
export const CustomizableDashboard = lazyWithRetry(() => import("@/pages/CustomizableDashboard"));

// ─────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────
export const ProductDetail = lazyWithRetry(() => import("@/pages/ProductDetail"));
export const FiltersPage = lazyWithRetry(() => import("@/pages/FiltersPage"));
export const NoveltiesPage = lazyWithRetry(() => import("@/pages/NoveltiesPage"));
export const ReplenishmentsPage = lazyWithRetry(() => import("@/pages/ReplenishmentsPage"));
export const FavoritesPage = lazyWithRetry(() => import("@/pages/FavoritesPage"));
export const SellerCartsPage = lazyWithRetry(() => import("@/pages/SellerCartsPage"));
export const ComparePage = lazyWithRetry(() => import("@/pages/ComparePage"));
export const CollectionsPage = lazyWithRetry(() => import("@/pages/CollectionsPage"));
export const CollectionDetailPage = lazyWithRetry(() => import("@/pages/CollectionDetailPage"));

// ─────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────
export const QuoteTemplatesPage = lazyWithRetry(() => import("@/pages/QuoteTemplatesPage"));
export const QuotesListPage = lazyWithRetry(() => import("@/pages/QuotesListPage"));
export const QuotesDashboardPage = lazyWithRetry(() => import("@/pages/QuotesDashboardPage"));
export const QuoteBuilderPage = lazyWithRetry(() => import("@/pages/QuoteBuilderPage"));
export const QuoteViewPage = lazyWithRetry(() => import("@/pages/QuoteViewPage"));
export const QuotesKanbanPage = lazyWithRetry(() => import("@/pages/QuotesKanbanPage"));

// ─────────────────────────────────────────────────────────────────
// Admin (supervisor + dev)
// ─────────────────────────────────────────────────────────────────
export const AdminUsuariosPage = lazyWithRetry(() => import("@/pages/admin/AdminUsuariosPage"));
export const AdminPromoverUsuarioPage = lazyWithRetry(() => import("@/pages/admin/AdminPromoverUsuarioPage"));
export const AdminSegurancaPage = lazyWithRetry(() => import("@/pages/admin/AdminSegurancaPage"));
export const AdminCadastrosPage = lazyWithRetry(() => import("@/pages/admin/AdminCadastrosPage"));
export const AdminPromptsIAPage = lazyWithRetry(() => import("@/pages/admin/AdminPromptsIAPage"));
export const AdminProductFormPage = lazyWithRetry(() => import("@/pages/admin/AdminProductFormPage"));
export const AdminTelemetriaPage = lazyWithRetry(() => import("@/pages/admin/AdminTelemetriaPage"));
export const AdminDesignTokensPage = lazyWithRetry(() => import("@/pages/admin/AdminDesignTokensPage"));
export const AdminTemasPage = lazyWithRetry(() => import("@/pages/admin/AdminTemasPage"));
export const AdminWorkflowsPage = lazyWithRetry(() => import("@/pages/admin/AdminWorkflowsPage"));
export const AdminLoginAttemptsPage = lazyWithRetry(() => import("@/pages/admin/AdminLoginAttemptsPage"));
export const AdminExternalDbPage = lazyWithRetry(() => import("@/pages/admin/AdminExternalDbPage"));
export const AdminVideoVariantsPage = lazyWithRetry(() => import("@/pages/admin/AdminVideoVariantsPage"));
export const AdminAiUsagePage = lazyWithRetry(() => import("@/pages/admin/AdminAiUsagePage"));
export const KitTemplatesAdminPage = lazyWithRetry(() => import("@/pages/admin/KitTemplatesAdminPage"));
export const KitTemplatesMetricsPage = lazyWithRetry(() => import("@/pages/admin/KitTemplatesMetricsPage"));
export const PriceFreshnessSettingsPage = lazyWithRetry(() => import("@/pages/admin/PriceFreshnessSettings"));
export const AdminSegurancaAcessoPage = lazyWithRetry(() => import("@/pages/admin/AdminSegurancaAcessoPage"));
export const AdminSegurancaChavesPage = lazyWithRetry(() => import("@/pages/admin/AdminSegurancaChavesPage"));
export const DevChallengeExamplesPage = lazyWithRetry(() => import("@/pages/admin/DevChallengeExamplesPage"));
export const AdminMigracaoPapeisPage = lazyWithRetry(() => import("@/pages/admin/AdminMigracaoPapeisPage"));
export const AdminConexoesPage = lazyWithRetry(() => import("@/pages/admin/AdminConexoesPage"));
export const AdminConexoesStatusPage = lazyWithRetry(() => import("@/pages/admin/AdminConexoesStatusPage"));
export const AdminRbacRoutesPage = lazyWithRetry(() => import("@/pages/admin/AdminRbacRoutesPage"));
export const SellerDiscountLimitsAdminPage = lazyWithRetry(() => import("@/pages/admin/SellerDiscountLimitsAdminPage"));
export const RlsDenialsAdminPage = lazyWithRetry(() => import("@/pages/admin/RlsDenialsAdminPage"));
export const OwnershipAuditAdminPage = lazyWithRetry(() => import("@/pages/admin/OwnershipAuditAdminPage"));

// ─────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────
export const SimuladorWizard = lazyWithRetry(() => import("@/pages/SimuladorWizard"));
export const MockupGenerator = lazyWithRetry(() => import("@/pages/MockupGenerator"));
export const MagicUp = lazyWithRetry(() => import("@/pages/MagicUp"));
export const PriceSimulatorPage = lazyWithRetry(() => import("@/pages/PriceSimulatorPage"));
export const StockDashboardPage = lazyWithRetry(() => import("@/pages/StockDashboardPage"));
export const AdvancedPriceSearchPage = lazyWithRetry(() => import("@/pages/AdvancedPriceSearchPage"));
export const KitBuilderPage = lazyWithRetry(() => import("@/pages/KitBuilderPage"));
export const MeusKitsPage = lazyWithRetry(() => import("@/pages/KitLibraryPage"));
export const MockupHistoryPage = lazyWithRetry(() => import("@/pages/MockupHistoryPage"));
export const DropboxBrowserPage = lazyWithRetry(() => import("@/pages/DropboxBrowserPage"));
export const CommercialIntelligencePage = lazyWithRetry(() => import("@/pages/CommercialIntelligencePage"));
export const ProductMatchPage = lazyWithRetry(() => import("@/pages/ProductMatchPage"));
export const BusinessIntelligencePage = lazyWithRetry(() => import("@/pages/BusinessIntelligencePage"));
export const ClientComparatorPage = lazyWithRetry(() => import("@/pages/ClientComparatorPage"));

// ─────────────────────────────────────────────────────────────────
// Clients (CRM)
// ─────────────────────────────────────────────────────────────────
export const ClientsPage = lazyWithRetry(() => import("@/pages/ClientsPage"));
export const ClientDetailPage = lazyWithRetry(() => import("@/pages/ClientDetailPage"));

// ─────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────
export const TrendsPage = lazyWithRetry(() => import("@/pages/TrendsPage"));

// ─────────────────────────────────────────────────────────────────
// System (dev-only)
// ─────────────────────────────────────────────────────────────────
export const SystemStatusPage = lazyWithRetry(() => import("@/pages/SystemStatusPage"));
export const RateLimitDashboard = lazyWithRetry(() => import("@/pages/RateLimitDashboardPage"));
export const ExternalDatabaseTest = lazyWithRetry(() => import("@/pages/ExternalDatabaseTest"));

// ─────────────────────────────────────────────────────────────────
// Roles & Permissions (admin)
// ─────────────────────────────────────────────────────────────────
export const PermissionsPage = lazyWithRetry(() => import("@/pages/PermissionsPage"));
export const RolesPage = lazyWithRetry(() => import("@/pages/RolesPage"));
export const RolePermissionsPage = lazyWithRetry(() => import("@/pages/RolePermissionsPage"));

// ─────────────────────────────────────────────────────────────────
// QA / Internal
// ─────────────────────────────────────────────────────────────────
export const QAPage = lazyWithRetry(() => import("@/pages/QAPage"));
export const SidebarQAPage = lazyWithRetry(() => import("@/pages/SidebarQAPage"));
