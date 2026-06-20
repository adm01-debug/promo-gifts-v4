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
} from './lazy-pages';

// Dev-only harness (sem auth) para validação visual de componentes.
const ColorSwatchesHarness = lazy(() => import('@/pages/dev/ColorSwatchesHarness'));

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
  </>
);
