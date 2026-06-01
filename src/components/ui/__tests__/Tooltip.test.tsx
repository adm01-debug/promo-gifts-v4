import { describe, it, expect } from 'vitest';
import { TOOLTIP_DELAY } from '../tooltip';

describe('Tooltip Constants', () => {
  it('should have the correct delay duration constant', () => {
    expect(TOOLTIP_DELAY).toBe(1000);
  });
});
