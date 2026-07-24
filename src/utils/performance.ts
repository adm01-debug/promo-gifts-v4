import { telemetryService } from '@/services/telemetryService';

import { logger } from '@/lib/logger';
/**
 * Utility for tracking application performance metrics.
 *
 * 🚀 ELITE TRACKING:
 * - Real-time metrics collection
 * - In-memory history with rotation
 * - Persistence for cross-reload analysis
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

const MAX_HISTORY = 50;
const STORAGE_KEY = 'app_performance_metrics';

class PerformanceTracker {
  private history: PerformanceMetric[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      logger.error('[Performance] Error loading history', e);
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(-MAX_HISTORY)));
    } catch {
      // Ignore quota errors
    }
  }

  mark(name: string) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  }

  measure(name: string, startMark: string, endMark: string) {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        const measure = performance.measure(name, startMark, endMark);

        const metric: PerformanceMetric = {
          name,
          duration: measure.duration,
          timestamp: Date.now(),
        };

        this.history.push(metric);
        if (this.history.length > MAX_HISTORY) {
          this.history.shift();
        }

        this.saveHistory();

        // Push to remote telemetry if it's an outlier
        telemetryService.logPerformance(name, measure.duration);

        if (process.env.NODE_ENV === 'development') {
          logger.warn(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
        }

        return measure;
      } catch {
        // Mark might not exist yet
      }
    }
    return null;
  }

  getHistory() {
    return [...this.history];
  }

  getAverage(namePattern: string) {
    const relevant = this.history.filter((m) => m.name.includes(namePattern));
    if (relevant.length === 0) return 0;
    const sum = relevant.reduce((acc, m) => acc + m.duration, 0);
    return sum / relevant.length;
  }

  clear() {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  startRouteTransition(pathname: string) {
    this.mark(`route-start:${pathname}`);
  }

  endRouteTransition(pathname: string) {
    this.mark(`route-end:${pathname}`);
    this.measure(`Route: ${pathname}`, `route-start:${pathname}`, `route-end:${pathname}`);
  }

  startThemeChange(theme: string) {
    this.mark(`theme-start:${theme}`);
  }

  endThemeChange(theme: string) {
    this.mark(`theme-end:${theme}`);
    this.measure(`Theme: ${theme}`, `theme-start:${theme}`, `theme-end:${theme}`);
  }
}

export const performanceTracker = new PerformanceTracker();
