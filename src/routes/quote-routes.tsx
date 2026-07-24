import { Navigate, Route } from 'react-router-dom';
import {
  QuoteBuilderPage,
  QuoteViewPage,
  QuotesDashboardPage,
  QuotesKanbanPage,
  QuotesListPage,
} from './lazy-pages';
import { ValidQuoteIdRoute } from './guards/ValidQuoteIdRoute';

/**
 * Quote (orçamentos) routes — list, dashboard, kanban, builder
 * and view-only public/shareable view.
 *
 * Mounted under ProtectedRoute.
 *
 * Nota: a rota legada `/orcamentos/templates` foi removida. Mantemos um
 * redirect permanente para `/orcamentos` para evitar 404 em links antigos.
 */
export const quoteRoutes = (
  <>
    <Route path="/orcamentos" element={<QuotesListPage />} />
    <Route path="/orcamentos/dashboard" element={<QuotesDashboardPage />} />
    <Route path="/orcamentos/lista" element={<QuotesListPage />} />
    <Route path="/orcamentos/kanban" element={<QuotesKanbanPage />} />
    <Route path="/orcamentos/templates" element={<Navigate to="/orcamentos" replace />} />

    
    <Route path="/orcamentos/novo" element={<QuoteBuilderPage />} />
    <Route
      path="/orcamentos/:id/editar"
      element={
        <ValidQuoteIdRoute>
          <QuoteBuilderPage />
        </ValidQuoteIdRoute>
      }
    />
    <Route
      path="/orcamentos/:id"
      element={
        <ValidQuoteIdRoute>
          <QuoteViewPage />
        </ValidQuoteIdRoute>
      }
    />
  </>
);
