import { Route } from 'react-router-dom';
import {
  QuoteBuilderPage,
  QuoteTemplatesPage,
  QuoteViewPage,
  QuotesDashboardPage,
  QuotesKanbanPage,
  QuotesListPage,
} from './lazy-pages';
import { ValidQuoteIdRoute } from './guards/ValidQuoteIdRoute';

/**
 * Quote (orçamentos) routes — list, dashboard, kanban, templates, builder
 * and view-only public/shareable view.
 *
 * Mounted under ProtectedRoute.
 */
export const quoteRoutes = (
  <>
    <Route path="/orcamentos" element={<QuotesListPage />} />
    <Route path="/orcamentos/dashboard" element={<QuotesDashboardPage />} />
    <Route path="/orcamentos/lista" element={<QuotesListPage />} />
    <Route path="/orcamentos/kanban" element={<QuotesKanbanPage />} />
    <Route path="/orcamentos/templates" element={<QuoteTemplatesPage />} />
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
