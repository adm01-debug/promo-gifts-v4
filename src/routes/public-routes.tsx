import { lazy } from 'react';
import { Route } from 'react-router-dom';
import {
  Auth,
  ResetPassword,
  ForgotPasswordConfirmation,
  SSOCallbackPage,
  Unauthorized,
  TermsPage,
  PrivacyPage,
  PublicMagazineView,
} from './lazy-pages';

// Dev-only harness (sem auth) para validação visual de componentes.
const ColorSwatchesHarness = lazy(() => import('@/pages/dev/ColorSwatchesHarness'));
const ConfirmDialogHarness = lazy(() => import('@/pages/dev/ConfirmDialogHarness'));
const AlertDialogHarness = lazy(() => import('@/pages/dev/AlertDialogHarness'));
const DialogHarness = lazy(() => import('@/pages/dev/DialogHarness'));
const UndoToastHarness = lazy(() => import('@/pages/dev/UndoToastHarness'));
const CnpjFormHarness = lazy(() => import('@/pages/dev/CnpjFormHarness'));
const MagazineRingHarness = lazy(() => import('@/pages/dev/MagazineRingHarness'));
const TabSkipHarness = lazy(() => import('@/pages/dev/TabSkipHarness'));

/**
 * Public routes — accessible without authentication.
 *
 * Includes login, password reset, SSO callback handling, and the
 * unauthorized landing page.
 */
export const publicRoutes = (
  <>
    <Route path="/auth" element={<Auth />} />
    {/* Alias legado — mantém /login funcionando para bookmarks e links externos */}
    <Route path="/login" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/forgot-password-confirmation" element={<ForgotPasswordConfirmation />} />
    <Route path="/auth/callback" element={<SSOCallbackPage />} />
    <Route path="/unauthorized" element={<Unauthorized />} />
    <Route path="/termos" element={<TermsPage />} />
    <Route path="/privacidade" element={<PrivacyPage />} />
    <Route path="/revista-publica/:token" element={<PublicMagazineView />} />
    <Route path="/__test/color-swatches" element={<ColorSwatchesHarness />} />
    <Route path="/__test/confirm-dialog" element={<ConfirmDialogHarness />} />
    <Route path="/__test/alert-dialog" element={<AlertDialogHarness />} />
    <Route path="/__test/dialog" element={<DialogHarness />} />
    <Route path="/__test/undo-toast" element={<UndoToastHarness />} />
    <Route path="/__test/cnpj-form" element={<CnpjFormHarness />} />
    <Route path="/__test/magazine-ring" element={<MagazineRingHarness />} />
    <Route path="/__test/tab-skip" element={<TabSkipHarness />} />
  </>
);
