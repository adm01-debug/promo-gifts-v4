import { Navigate, Route } from 'react-router-dom';
import {
  AdvancedPriceSearchPage,
  BusinessIntelligencePage,
  ClientComparatorPage,
  CoverageInsightsDashboardPage,
  CommercialIntelligencePage,
  DropboxBrowserPage,
  KitBuilderPage,
  MagicUp,
  MeusKitsPage,
  MockupGenerator,
  MockupHistoryPage,
  PriceSimulatorPage,
  ProductMatchPage,
  SimuladorWizard,
  StockDashboardPage,
  SimulationPage,
  VisualSearchPage,
} from './lazy-pages';

/**
 * Tools routes — simulador, mockup, BI, magic-up, kit builder, dropbox,
 * advanced search and stock.
 *
 * Mounted under ProtectedRoute.
 */
export const toolsRoutes = (
  <>
    <Route path="/simulador" element={<SimuladorWizard />} />
    <Route path="/simulador-precos" element={<PriceSimulatorPage />} />
    <Route path="/estoque" element={<StockDashboardPage />} />
    <Route path="/busca-preco" element={<AdvancedPriceSearchPage />} />
    <Route path="/montar-kit" element={<KitBuilderPage />} />
    <Route path="/kit-builder" element={<Navigate to="/montar-kit" replace />} />
    <Route path="/meus-kits" element={<MeusKitsPage />} />
    <Route path="/mockup" element={<Navigate to="/mockup-generator" replace />} />
    <Route path="/gerador-mockup" element={<Navigate to="/mockup-generator" replace />} />
    <Route path="/mockup-generator" element={<MockupGenerator />} />
    <Route path="/mockups/historico" element={<MockupHistoryPage />} />
    <Route path="/magic-up" element={<MagicUp />} />
    <Route path="/inteligencia-comercial" element={<CommercialIntelligencePage />} />
    <Route path="/ferramentas/bi" element={<BusinessIntelligencePage />} />
    <Route path="/ferramentas/bi/comparar" element={<ClientComparatorPage />} />
    <Route path="/match" element={<ProductMatchPage />} />
    <Route path="/dropbox" element={<DropboxBrowserPage />} />
    <Route path="/simulacao" element={<SimulationPage />} />
    <Route path="/ferramentas/cobertura" element={<CoverageInsightsDashboardPage />} />
    <Route path="/raio-x" element={<VisualSearchPage />} />
  </>
);
