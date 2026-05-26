/**
 * Global Design System Policy: No Orange Glow
 *
 * This policy prohibits the use of "glow" effects or large orange halos
 * across the entire system to maintain a clean, high-contrast UI.
 *
 * Rules:
 * 1. NO 'shadow-glow' or 'shadow-glow-focus' classes.
 * 2. NO hardcoded primary/orange shadows (e.g., drop-shadow-[...hsl(--primary)...]).
 * 3. NO 'text-shadow' on links or headings.
 * 4. NO '.ambient-glow' pseudo-elements.
 * 5. Focus states must use standard 'ring-2' without radial halos.
 * 6. Theme skins must not reintroduce glows via 'applyGxNeonGlow'.
 */
export const NO_ORANGE_GLOW_POLICY = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  status: 'active',
  scope: 'global',
};
