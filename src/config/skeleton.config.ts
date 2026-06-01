/**
 * Configuration for skeleton loading thresholds per module/route.
 * Values are in milliseconds.
 */
export const SKELETON_THRESHOLDS: Record<string, number> = {
  // Main modules
  Catalog: 2000,
  ProductDetail: 1500,
  Quotes: 2000,
  Clients: 1500,
  Admin: 3000, // Admin pages often load more data
  Dashboard: 2000,
  Tools: 2500,
  Profile: 1000,
  Auth: 1500,

  // Specific fallbacks
  Generic: 2000,

  // Default threshold if not specified
  DEFAULT: 2000,
};

/**
 * Get the threshold for a specific skeleton name.
 */
export function getSkeletonThreshold(name: string): number {
  return SKELETON_THRESHOLDS[name] || SKELETON_THRESHOLDS.DEFAULT;
}
