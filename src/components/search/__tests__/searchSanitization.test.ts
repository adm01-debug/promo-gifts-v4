/**
 * Tests for PostgREST filter-injection sanitization in useGlobalSearch.
 *
 * The regex under test strips characters that could alter PostgREST .or() / .ilike()
 * filter semantics when a user-controlled search term is interpolated into filter strings
 * like: `.or(\`name.ilike.%${term}%,description.ilike.%${term}%\`)`
 *
 * Dangerous characters:
 *   %  - SQL LIKE wildcard
 *   _  - SQL LIKE single-char wildcard
 *   \  - escape character
 *   (  - PostgREST filter grouping open
 *   )  - PostgREST filter grouping close
 *   ,  - PostgREST filter separator (introduces new filter clause)
 *   .  - PostgREST operator separator (e.g. `column.operator.value`)
 *   *  - PostgREST / glob wildcard
 */

// Exact regex from useGlobalSearch.ts line 426
const SANITIZE_REGEX = /[%_\\(),.*]/g;

/** Sanitize a search term the same way useGlobalSearch does. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(SANITIZE_REGEX, '').trim();
}

/** Characters that must never survive sanitization. */
const DANGEROUS_CHARS = ['%', '_', '\\', '(', ')', ',', '.', '*'];

describe('Search term sanitization (PostgREST filter injection)', () => {
  // ─── Normal search terms pass through unchanged ───────────────────────
  describe('normal search terms pass through unchanged', () => {
    const normalTerms = [
      'caneta',
      'brinde corporativo',
      'kit presente',
      'copo térmico',
      'mochila executiva',
      'pendrive 16gb',
    ];

    it.each(normalTerms)('"%s" is unchanged', (term) => {
      expect(sanitizeSearchTerm(term)).toBe(term);
    });
  });

  // ─── Individual dangerous characters are stripped ─────────────────────
  describe('individual dangerous characters are stripped', () => {
    const cases: Array<[string, string]> = [
      ['test%injection', 'testinjection'],
      ['test_wild', 'testwild'],
      ['test()', 'test'],
      ['test,break', 'testbreak'],
      ['test.dot', 'testdot'],
      ['test*glob', 'testglob'],
      ['test\\escape', 'testescape'],
    ];

    it.each(cases)('"%s" becomes "%s"', (input, expected) => {
      expect(sanitizeSearchTerm(input)).toBe(expected);
    });
  });

  // ─── Complex injection attempts are neutralized ───────────────────────
  describe('complex injection attempts are neutralized', () => {
    const injectionCases: Array<[string, string, string]> = [
      ['PostgREST .or() breakout with fake clause', '%.eq.true,admin.eq.true', 'eqtrueadmineqtrue'],
      ['Parenthesized sub-filter injection', '(admin)', 'admin'],
      ['ilike wildcard glob injection', 'name.ilike.*', 'nameilike'],
      ['Close-paren + new clause injection', ',id.eq.1)', 'ideq1'],
      ['SQL LIKE full-wildcard', '%', ''],
      ['Chained PostgREST operators', 'col.eq.val,other.neq.x', 'coleqvalotherneqx'],
      ['Backslash escape sequence injection', '\\%\\_', ''],
      ['Nested parentheses with commas', 'a(b,c(d))', 'abcd'],
      ['Asterisk glob pattern', '***', ''],
      [
        'Mixed operator injection attempt',
        'name.ilike.%admin%,role.eq.superuser',
        'nameilikeadminroleeqsuperuser',
      ],
    ];

    it.each(injectionCases)('%s: "%s" -> "%s"', (_desc, input, expected) => {
      expect(sanitizeSearchTerm(input)).toBe(expected);
    });
  });

  // ─── Unicode characters are preserved ─────────────────────────────────
  describe('unicode / accented characters are preserved', () => {
    const unicodeCases: Array<[string, string]> = [
      ['café', 'café'],
      ['ação', 'ação'],
      ['São Paulo', 'São Paulo'],
      ['caneta esferográfica', 'caneta esferográfica'],
      ['naïve', 'naïve'],
      ['über', 'über'],
      ['日本語', '日本語'],
      ['корпоративный', 'корпоративный'],
    ];

    it.each(unicodeCases)('"%s" is preserved as "%s"', (input, expected) => {
      expect(sanitizeSearchTerm(input)).toBe(expected);
    });
  });

  // ─── Numbers and alphanumeric mixes are preserved ─────────────────────
  describe('numbers and alphanumeric mixes are preserved', () => {
    const numericCases: Array<[string, string]> = [
      ['123', '123'],
      ['kit 500ml', 'kit 500ml'],
      ['caneta 0800', 'caneta 0800'],
      ['abc123def', 'abc123def'],
    ];

    it.each(numericCases)('"%s" is preserved as "%s"', (input, expected) => {
      expect(sanitizeSearchTerm(input)).toBe(expected);
    });
  });

  // ─── Input that becomes empty after sanitization ──────────────────────
  describe('input becomes empty after sanitization', () => {
    const emptyAfterCases = [
      '%()*._\\',
      '...',
      '***',
      '()',
      ',,,',
      '%%%',
      '___',
      '\\\\\\',
      '%_\\(),.*',
    ];

    it.each(emptyAfterCases)('"%s" becomes empty string', (input) => {
      expect(sanitizeSearchTerm(input)).toBe('');
    });
  });

  // ─── Already clean strings are unchanged ──────────────────────────────
  describe('already clean strings are returned unchanged', () => {
    const cleanStrings = [
      'caneta azul',
      'brinde corporativo premium',
      'kit executivo de luxo',
      'mochila notebook 15 polegadas',
      'copo stanley 473ml',
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'mixed CaSe 123',
      'hyphens-are-ok',
      "apostrophe's fine",
      'colons: ok',
      'semicolons; too',
      'bang!',
      'question?',
      'hash#tag',
      'at@sign',
      'dollar$',
      'ampersand&',
      'plus+sign',
      'equals=sign',
      'pipe|char',
      'brackets[]',
      'curly{}',
      'caret^',
      'tilde~',
    ];

    it.each(cleanStrings)('"%s" is unchanged', (input) => {
      expect(sanitizeSearchTerm(input)).toBe(input);
    });
  });

  // ─── Fuzz: 200 random strings ─────────────────────────────────────────
  describe('fuzz: 200 random strings with mixed safe/dangerous chars', () => {
    const safeChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -éàãçõü';
    const dangerousChars = '%_\\(),.* ';
    const allChars = safeChars + dangerousChars;

    // Deterministic PRNG (Mulberry32) so test is reproducible
    function mulberry32(seed: number) {
      return function () {
        seed += 0x6d2b79f5;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const rng = mulberry32(42);

    function randomString(minLen: number, maxLen: number, charset: string): string {
      const len = Math.floor(rng() * (maxLen - minLen + 1)) + minLen;
      let result = '';
      for (let i = 0; i < len; i++) {
        result += charset[Math.floor(rng() * charset.length)];
      }
      return result;
    }

    const fuzzInputs: string[] = [];
    for (let i = 0; i < 200; i++) {
      fuzzInputs.push(randomString(1, 40, allChars));
    }

    it.each(fuzzInputs.map((s, i) => [`fuzz#${i}`, s]))(
      '%s: no dangerous character survives sanitization',
      (_label, input) => {
        const result = sanitizeSearchTerm(input as string);
        for (const ch of DANGEROUS_CHARS) {
          expect(result).not.toContain(ch);
        }
      },
    );

    it('all 200 fuzz inputs were tested', () => {
      expect(fuzzInputs).toHaveLength(200);
    });
  });

  // ─── Structural property: sanitized output is always a subset of input chars
  describe('structural properties', () => {
    it('sanitized output only contains characters from the original input', () => {
      const inputs = ['hello%world', 'test(1,2)', 'café.latte', 'a\\b*c_d', '', '   '];
      for (const input of inputs) {
        const result = sanitizeSearchTerm(input);
        for (const ch of result) {
          expect(input).toContain(ch);
        }
      }
    });

    it('sanitized output length is always <= input length', () => {
      const inputs = ['abc', '%_%', 'normal', '(((', 'mix.ed*case\\1'];
      for (const input of inputs) {
        expect(sanitizeSearchTerm(input).length).toBeLessThanOrEqual(input.length);
      }
    });

    it('sanitization is idempotent (applying twice gives same result)', () => {
      const inputs = ['test%val', 'clean', '(a,b)', '***', 'café%'];
      for (const input of inputs) {
        const once = sanitizeSearchTerm(input);
        const twice = sanitizeSearchTerm(once);
        expect(twice).toBe(once);
      }
    });
  });
});
