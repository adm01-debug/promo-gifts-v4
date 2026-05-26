/**
 * Feedback utility for haptic/vibration feedback (Elite UX).
 */
export const feedback = {
  /**
   * Triggers a light vibration (success/confirmation).
   * 10ms is enough for a subtle feel.
   */
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Triggers a medium vibration (selection/toggle).
   */
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  },

  /**
   * Triggers an error/warning vibration pattern.
   */
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  },
};
