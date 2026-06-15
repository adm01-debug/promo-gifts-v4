import { Navigate, Route } from 'react-router-dom';
import {
  CartsListPage,
  CollectionDetailPage,
  CollectionsPage,
  ComparePage,
  FavoritesPage,
  FiltersPage,
  NoveltiesPage,
  ProductDetail,
  ReplenishmentsPage,
  SellerCartsPage,
} from './lazy-pages';
import { ValidProductIdRoute } from './guards/ValidProductIdRoute';

/**
 * Product routes — products list, detail, filters, novelties, replenishments,
 * favorites, carts, comparisons and collections.
 *
 * Mounted under ProtectedRoute (authenticated users only).
 */
export const productRoutes = (
  <>
    <Route path="/produtos" element={<FiltersPage />} />
    <Route path="/produto" element={<Navigate to="/produtos" replace />} />
    <Route
      path="/produto/:id"
      element={
        <ValidProductIdRoute>
          <ProductDetail />
        </ValidProductIdRoute>
      }
    />
    <Route path="/filtros" element={<FiltersPage />} />
    <Route path="/novidades" element={<NoveltiesPage />} />
    <Route path="/reposicao" element={<ReplenishmentsPage />} />
    <Route path="/favoritos" element={<FavoritesPage />} />
    <Route path="/carrinhos" element={<CartsListPage />} />
    <Route path="/carrinhos/:cartId" element={<SellerCartsPage />} />
    <Route path="/comparar" element={<ComparePage />} />
    <Route path="/colecoes" element={<CollectionsPage />} />
    <Route path="/colecoes/:id" element={<CollectionDetailPage />} />
  </>
);
