```markdown
# promo-gifts-v4 Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `promo-gifts-v4` TypeScript codebase. You'll learn how to structure files, write imports/exports, follow commit message conventions, and implement and run tests using Vitest. This guide is ideal for contributors seeking to maintain consistency and quality in this repository.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase
- **Example:**  
  ```plaintext
  PromoGiftService.ts
  GiftUtils.ts
  ```

### Import Style
- **Pattern:** Use alias imports to reference modules.
- **Example:**
  ```typescript
  import { GiftService } from '@services/GiftService';
  import { calculateDiscount } from '@utils/DiscountUtils';
  ```

### Export Style
- **Pattern:** Named exports are preferred.
- **Example:**
  ```typescript
  // In GiftUtils.ts
  export function calculateGiftValue() { ... }

  // In another file
  import { calculateGiftValue } from '@utils/GiftUtils';
  ```

### Commit Messages
- **Pattern:** Conventional commits with the `fix` prefix.
- **Example:**
  ```
  fix: correct discount calculation for bulk orders
  ```

## Workflows

### Fixing a Bug
**Trigger:** When you identify a bug in the codebase  
**Command:** `/fix-bug`

1. Create a new branch for your fix.
2. Locate and fix the bug in the relevant TypeScript file(s).
3. Write or update tests to cover the fix.
4. Commit your changes using the `fix:` prefix and a concise description.
   ```
   fix: resolve issue with gift expiration logic
   ```
5. Push your branch and open a pull request.

## Testing Patterns

- **Framework:** Vitest
- **Test File Pattern:** Files end with `.test.ts`
- **Example:**
  ```typescript
  // GiftUtils.test.ts
  import { describe, it, expect } from 'vitest';
  import { calculateGiftValue } from '@utils/GiftUtils';

  describe('calculateGiftValue', () => {
    it('returns correct value for standard input', () => {
      expect(calculateGiftValue(100, 0.2)).toBe(80);
    });
  });
  ```

- **Running Tests:**
  ```bash
  npx vitest
  ```

## Commands
| Command     | Purpose                                  |
|-------------|------------------------------------------|
| /fix-bug    | Start the workflow for fixing a bug      |
```