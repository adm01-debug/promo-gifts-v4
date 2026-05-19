/**
 * Utility for tracking application performance metrics.
 */
export const performanceTracker = {
  mark: (name: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  },

  measure: (name: string, startMark: string, endMark: string) => {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        const measure = performance.measure(name, startMark, endMark);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
        }
        return measure;
      } catch (e) {
        // Mark might not exist yet
      }
    }
    return null;
  },

  /**
   * Track a route transition time.
   */
  startRouteTransition: (pathname: string) => {
    performanceTracker.mark(`route-start:${pathname}`);
  },

  endRouteTransition: (pathname: string) => {
    performanceTracker.mark(`route-end:${pathname}`);
    performanceTracker.measure(
      `Route Transition: ${pathname}`,
      `route-start:${pathname}`,
      `route-end:${pathname}`
    );
  },

  /**
   * Track theme change time.
   */
  startThemeChange: (theme: string) => {
    performanceTracker.mark(`theme-start:${theme}`);
  },

  endThemeChange: (theme: string) => {
    performanceTracker.mark(`theme-end:${theme}`);
    performanceTracker.measure(
      `Theme Change: ${theme}`,
      `theme-start:${theme}`,
      `theme-end:${theme}`
    );
  }
};
