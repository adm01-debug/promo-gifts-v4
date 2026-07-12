/**
 * Magazine Performance Metrics
 *
 * Structured telemetry for the Magazine module.
 * Integrates with GlitchTip (Sentry SDK) already configured at boot.
 *
 * Usage:
 *   import { trackMagazineRender } from '@/lib/telemetry/magazineMetrics';
 *   trackMagazineRender({ magazineId, pageCount, renderMs });
 */

import * as Sentry from '@sentry/react';
import { createClientLogger } from './structuredLogger';

const log = createClientLogger('magazine.metrics');

export interface MagazineRenderMetrics {
  magazineId: string;
  pageCount: number;
  itemCount: number;
  templateId: string;
  renderMs?: number;
}

export interface PublishMetrics {
  magazineId: string;
  itemCount: number;
  success: boolean;
  errorCode?: string;
  durationMs?: number;
}

export interface AuthStallMetrics {
  durationMs: number;
  triggeredByModule: string;
  rolesLoadedAfterStall: boolean;
}

/**
 * trackMagazineRender — record magazine render performance.
 * Fires when paginateMagazine() completes (via useMemo).
 */
export function trackMagazineRender(metrics: MagazineRenderMetrics): void {
  // GlitchTip/Sentry custom event
  Sentry.addBreadcrumb({
    category: 'magazine.render',
    message: `Rendered ${metrics.pageCount} pages for ${metrics.magazineId}`,
    level: 'info',
    data: metrics,
  });

  // Performance threshold alert
  if (metrics.renderMs !== undefined && metrics.renderMs > 500) {
    log.warn('magazine_render_slow', {
      magazineId: metrics.magazineId,
      renderMs: metrics.renderMs,
      pageCount: metrics.pageCount,
    });
    Sentry.captureEvent({
      level: 'warning',
      message: 'Magazine render exceeded 500ms',
      tags: {
        module: 'magazine',
        templateId: metrics.templateId,
      },
      extra: metrics,
    });
  } else {
    log.info('magazine_render_ok', metrics);
  }
}

/**
 * trackPublish — record magazine publication.
 */
export function trackPublish(metrics: PublishMetrics): void {
  if (metrics.success) {
    log.info('magazine_published', metrics);
    Sentry.addBreadcrumb({
      category: 'magazine.publish',
      message: `Magazine ${metrics.magazineId} published with ${metrics.itemCount} items`,
      level: 'info',
      data: metrics,
    });
  } else {
    log.error('magazine_publish_failed', metrics);
    Sentry.captureEvent({
      level: 'error',
      message: 'Magazine publish failed',
      tags: { module: 'magazine', errorCode: metrics.errorCode ?? 'unknown' },
      extra: metrics,
    });
  }
}

/**
 * trackAuthStall — record auth hydration stall affecting Magazine module.
 * Triggered by the 8s watchdog in AuthContext.
 */
export function trackAuthStall(metrics: AuthStallMetrics): void {
  log.warn('auth_stall_detected', metrics);
  Sentry.captureEvent({
    level: 'warning',
    message: `Auth stall ${metrics.durationMs}ms in ${metrics.triggeredByModule}`,
    tags: {
      module: metrics.triggeredByModule,
      rolesLoadedAfterStall: String(metrics.rolesLoadedAfterStall),
    },
    extra: metrics,
  });
}

/**
 * trackReactError — capture React errors with Magazine context.
 * Called from MagazineErrorBoundary.
 */
export function trackReactError(
  error: Error,
  context: { magazineId?: string; step?: string; pageCount?: number }
): void {
  log.error('magazine_react_error', {
    error: error.message,
    context,
  });
  Sentry.withScope((scope) => {
    scope.setTag('module', 'magazine');
    scope.setTag('step', context.step ?? 'unknown');
    scope.setContext('magazine', context);
    // Detect React #310 (useMemo invariant violation)
    if (
      error.message.includes('Minified React error #310') ||
      error.message.includes('rendered more hooks') ||
      error.message.includes('useMemo')
    ) {
      scope.setTag('react_error_code', '310');
      scope.setTag('is_hooks_violation', 'true');
    }
    Sentry.captureException(error);
  });
}
