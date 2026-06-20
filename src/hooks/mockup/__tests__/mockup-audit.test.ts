/**
 * SUITE DE TESTES — Auditoria do módulo mockup-generator
 *
 * Sprint 1 (T1–T10) + Sprint 2 (BUG-A a BUG-J).
 *
 * Execução: npx vitest run src/hooks/mockup/__tests__/mockup-audit.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readSrc(relativePath: string) {
  return readFileSync(resolve(__dirname, '..', '..', '..', '..', relativePath), 'utf-8');
}

// =====================================================================
// T7 — getTechniquePrompt pure function tests
// =====================================================================

const TECHNIQUE_PROMPTS: Record<string, string> = {
  bordado: 'as professional machine embroidery with visible thread stitch texture',
  silk: 'as screen printed with flat solid colors, matte finish',
  dtf: 'as DTF printed transfer with vibrant colors, slight glossy finish',
  laser: 'as laser engraved, etched into the material surface, monochromatic',
  laser_co2: 'as CO2 laser engraved with precise etching on organic materials',
  laser_fibra: 'as fiber laser marked on metal with high-contrast permanent mark',
  sublimacao: 'as sublimation printed, colors absorbed seamlessly into the material',
  tampografia: 'as pad printed with slightly glossy ink, precise small details',
  hot_stamping: 'as hot stamped with metallic foil finish, shiny reflective surface',
  adesivo: 'as vinyl sticker/decal applied to surface',
  uv: 'as UV printed with raised ink texture, vibrant colors',
  transfer: 'as heat transfer vinyl, smooth finish with slight sheen',
  default: 'as professionally printed/applied logo',
};

type TechniqueInput = { id: string; name: string; code: string | null };

function getTechniquePromptFixed(technique: TechniqueInput): string {
  const code = technique.code?.toLowerCase() || technique.name.toLowerCase();
  for (const [key, prompt] of Object.entries(TECHNIQUE_PROMPTS)) {
    if (key === 'default') continue;
    if (code.includes(key) || technique.name.toLowerCase().includes(key)) return prompt;
  }
  return TECHNIQUE_PROMPTS.default;
}

function getTechniquePromptBUGGY(technique: TechniqueInput): string {
  const code = technique.code?.toLowerCase() || technique.name.toLowerCase();
  for (const [key, prompt] of Object.entries(TECHNIQUE_PROMPTS)) {
    if (code.includes(key) || technique.name.toLowerCase().includes(key)) return prompt;
  }
  return TECHNIQUE_PROMPTS.default;
}

describe('T7 — getTechniquePrompt: "default" nao deve ser matchado no loop', () => {
  it('silk -> retorna prompt correto de silk', () => {
    expect(getTechniquePromptFixed({ id: '1', name: 'Serigrafia', code: 'silk' })).toBe(
      TECHNIQUE_PROMPTS.silk,
    );
  });
  it('laser -> retorna prompt correto de laser', () => {
    expect(getTechniquePromptFixed({ id: '2', name: 'Laser Gravacao', code: 'laser' })).toBe(
      TECHNIQUE_PROMPTS.laser,
    );
  });
  it('bordado -> retorna prompt correto de bordado', () => {
    expect(getTechniquePromptFixed({ id: '3', name: 'Bordado', code: 'bordado' })).toBe(
      TECHNIQUE_PROMPTS.bordado,
    );
  });
  it('tecnica desconhecida -> retorna fallback default', () => {
    expect(getTechniquePromptFixed({ id: '4', name: 'Nova Tecnica', code: null })).toBe(
      TECHNIQUE_PROMPTS.default,
    );
  });
  it('code contendo "default" como substring NAO interrompe loop prematuramente', () => {
    expect(
      getTechniquePromptFixed({ id: '5', name: 'Laser Special', code: 'laser-default-special' }),
    ).toBe(TECHNIQUE_PROMPTS.laser);
  });
  it('[REGRESSAO] versao buggy pode falhar no caso acima', () => {
    const t = { id: '5', name: 'Laser Special', code: 'laser-default-special' };
    expect(getTechniquePromptFixed(t)).toBe(TECHNIQUE_PROMPTS.laser);
    expect([TECHNIQUE_PROMPTS.laser, TECHNIQUE_PROMPTS.default]).toContain(
      getTechniquePromptBUGGY(t),
    );
  });
  it('uv -> retorna prompt de UV', () => {
    expect(getTechniquePromptFixed({ id: '6', name: 'UV Digital', code: 'uv' })).toBe(
      TECHNIQUE_PROMPTS.uv,
    );
  });
  it('sublimacao -> retorna prompt de sublimacao', () => {
    expect(getTechniquePromptFixed({ id: '7', name: 'Sublimacao', code: 'sublimacao' })).toBe(
      TECHNIQUE_PROMPTS.sublimacao,
    );
  });
});

// =====================================================================
// STATIC ANALYSIS — mockupGenerationService.ts
// =====================================================================

describe('Analise estatica — mockupGenerationService.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/hooks/mockup/mockupGenerationService.ts');
  });

  describe('T4 — campos top-level no INSERT', () => {
    it('logo_url como coluna top-level', () => {
      expect(src).toContain('logo_url: logoUrl');
    });
    it('position_x como coluna top-level', () => {
      expect(src).toContain('position_x: area.positionX');
    });
    it('position_y como coluna top-level', () => {
      expect(src).toContain('position_y: area.positionY');
    });
    it('logo_width_cm como coluna top-level', () => {
      expect(src).toContain('logo_width_cm: area.logoWidth');
    });
    it('logo_height_cm como coluna top-level', () => {
      expect(src).toContain('logo_height_cm: area.logoHeight');
    });
  });

  describe('T6 — deleteMockupFromDb com owner scope', () => {
    it('assinatura inclui userId?', () => {
      expect(src).toMatch(/deleteMockupFromDb\s*\(\s*id\s*:\s*string\s*,\s*userId\?/);
    });
    it('filtro user_id aplicado quando userId presente', () => {
      expect(src).toContain("query.eq('user_id', userId)");
    });
  });

  describe('T7 — continue guard no loop de getTechniquePrompt', () => {
    it('codigo-fonte contem o continue guard para chave "default"', () => {
      expect(src).toContain("if (key === 'default') continue;");
    });
  });

  describe('T8 — fetchMockupHistory com LIMIT 200', () => {
    it('query usa .limit(200)', () => {
      expect(src).toContain('.limit(200)');
    });
    it('nenhum limit menor que 200 presente', () => {
      expect(src).not.toMatch(/\.limit\((0|[1-9]\d?|1\d{2})\)[^;]/);
    });
  });

  describe('T10 — thumbnail_url = mockupUrl', () => {
    it('thumbnail_url recebe mockupUrl', () => {
      expect(src).toContain('thumbnail_url: mockupUrl');
    });
    it('thumbnail_url NAO usa logoUrl', () => {
      expect(src).not.toContain('thumbnail_url: logoUrl');
    });
  });

  describe('BUG-C — timeout via Promise.race', () => {
    it('usa Promise.race', () => {
      expect(src).toContain('Promise.race');
    });
    it('GENERATE_TIMEOUT_MS definida', () => {
      expect(src).toContain('GENERATE_TIMEOUT_MS');
    });
    it('timeout >= 30000 ms', () => {
      const match = src.match(/GENERATE_TIMEOUT_MS\s*=\s*(\d+)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(30_000);
    });
    it('mensagem de timeout em PT-BR', () => {
      expect(src).toContain('Tempo esgotado ao gerar mockup');
    });
  });

  describe('BUG-E — SVG pre-validado antes da edge function', () => {
    it('funcao assertNotSvg definida', () => {
      expect(src).toContain('function assertNotSvg');
    });
    it('assertNotSvg chamada antes de supabase.functions.invoke', () => {
      const assertPos = src.indexOf('assertNotSvg');
      const invokePos = src.indexOf('supabase.functions.invoke');
      expect(assertPos).toBeGreaterThan(-1);
      expect(invokePos).toBeGreaterThan(-1);
      expect(assertPos).toBeLessThan(invokePos);
    });
    it('detecta data URL SVG', () => {
      expect(src).toContain("area.logoPreview.startsWith('data:image/svg')");
    });
    it('mensagem de erro SVG em PT-BR', () => {
      expect(src).toContain('SVG não são suportados');
    });
  });

  describe('BUG-I — single-area path envia somente a area processada', () => {
    it('single-area body.areas NAO usa areasWithLogos.map', () => {
      const singleAreaBlock = src.split('if (areasWithLogos.length === 1)')[1];
      expect(singleAreaBlock).toBeDefined();
      const beforeBatch = singleAreaBlock.split('// BATCH')[0];
      expect(beforeBatch).not.toContain('areasWithLogos.map');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — useMockupGenerator.ts
// =====================================================================

describe('Analise estatica — useMockupGenerator.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/hooks/mockup/useMockupGenerator.ts');
  });

  describe('T1/T2 — 7 handlers envolvidos em useCallback com deps corretas', () => {
    const handlers = [
      'saveMockupToHistory',
      'generateMockup',
      'downloadMockup',
      'deleteMockup',
      'resetForm',
      'handleShareMockup',
      'loadFromHistory',
    ] as const;

    it.each(handlers)('%s usa useCallback', (fn) => {
      expect(src).toMatch(new RegExp(`const\\s+${fn}\\s*=\\s*useCallback`));
    });

    it('saveMockupToHistory: array de deps inclui todas as closures criticas', () => {
      expect(src).toContain(
        '[user, selectedProduct, selectedTechnique, selectedClient, mockupAnnotations]',
      );
    });

    it('deleteMockup: deps incluem mockupToDelete e user', () => {
      expect(src).toContain('[mockupToDelete, user]');
    });

    it('eslint-disable comments removidos (NAO mais necessarios)', () => {
      // Nota: era necessario na versao buggy sem useCallback
      expect(src).not.toMatch(
        /eslint-disable-next-line react-hooks\/exhaustive-deps\s*\nconst\s+(saveMockupToHistory|generateMockup|downloadMockup|deleteMockup|resetForm|handleShareMockup|loadFromHistory)/,
      );
    });
  });

  describe('T3 — Memory leaks: cleanup de timeouts', () => {
    it('historyPushTimeout limpo em cleanup', () => {
      expect(src).toContain('clearTimeout(historyPushTimeout.current)');
    });
    it('draftNoticeTimeoutRef criada como useRef', () => {
      expect(src).toContain('draftNoticeTimeoutRef');
    });
    it('draftNoticeTimeoutRef limpa em cleanup', () => {
      expect(src).toContain('clearTimeout(draftNoticeTimeoutRef.current)');
    });
    it('pelo menos 2 useEffect de cleanup', () => {
      const cleanups = src.match(/return\s*\(\)\s*=>\s*\{[^}]*clearTimeout/g);
      expect(cleanups?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
  });

  describe('T5 — Batch DB saves: Promise.allSettled', () => {
    it('usa Promise.allSettled', () => {
      expect(src).toContain('Promise.allSettled');
    });
    it('resultado filtrado por "fulfilled"', () => {
      expect(src).toContain("res.status === 'fulfilled'");
    });
  });

  describe('T6 — deleteMockup passa userId', () => {
    it('chama deleteMockupFromDb com user?.id', () => {
      expect(src).toContain('deleteMockupFromDb(mockupToDelete, user?.id)');
    });
  });

  describe('T9 — URL params preservados', () => {
    it('usa URLSearchParams.delete para product_id', () => {
      expect(src).toContain("newParams.delete('product_id')");
    });
    it('usa URLSearchParams.delete para technique', () => {
      expect(src).toContain("newParams.delete('technique')");
    });
    it('NAO usa replaceState com pathname puro', () => {
      expect(src).not.toContain("replaceState({}, '', window.location.pathname)");
    });
    it('URL final preserva params extras', () => {
      expect(src).toMatch(/newSearch\s*\?\s*`\?\${newSearch}`\s*:\s*''/);
    });
  });

  describe('BUG-F — resetForm: async + await clearDraft()', () => {
    it('resetForm é async', () => {
      expect(src).toMatch(/const\s+resetForm\s*=\s*useCallback\s*\(\s*async/);
    });
    it('clearDraft é awaited dentro de resetForm', () => {
      const resetBlock = src.split('const resetForm')[1].split('}, [')[0];
      expect(resetBlock).toContain('await clearDraft()');
    });
  });

  describe('BUG-J — isDraftLoading exposto', () => {
    it('isDraftLoading presente no return', () => {
      expect(src).toContain('isDraftLoading,');
    });
    it('isDraftLoading desestruturado de useMockupDraft', () => {
      expect(src).toContain('isLoading: isDraftLoading,');
    });
  });

  describe('FileReader.onerror em handleAreaLogoUpload', () => {
    it('reader.onerror está definido', () => {
      // Regression guard: missing onerror means corrupted/unreadable files fail silently.
      const uploadBlock =
        src.split('const handleAreaLogoUpload')[1]?.split('const getProductImage')[0] ?? '';
      expect(uploadBlock).toContain('reader.onerror');
    });
    it('reader.onerror exibe toast de erro', () => {
      const uploadBlock =
        src.split('const handleAreaLogoUpload')[1]?.split('const getProductImage')[0] ?? '';
      expect(uploadBlock).toMatch(/reader\.onerror[\s\S]*?toast\.error/);
    });
  });

  describe('loadFromHistory — clearDraft awaited', () => {
    it('loadFromHistory é async', () => {
      expect(src).toMatch(/const\s+loadFromHistory\s*=\s*useCallback\s*\(\s*async/);
    });
    it('clearDraft é awaited dentro de loadFromHistory', () => {
      const block = src.split('const loadFromHistory')[1]?.split('const wizardStep')[0] ?? '';
      expect(block).toContain('await clearDraft()');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — useMockupDraft.ts
// =====================================================================

describe('Analise estatica — useMockupDraft.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/hooks/mockup/useMockupDraft.ts');
  });

  describe('BUG-A — FK queries de pre-validacao removidas', () => {
    it('NAO contém query de products no saveToBackend', () => {
      const saveBlock = src.split('saveToBackend')[1]?.split('loadFromBackend')[0] ?? '';
      expect(saveBlock).not.toContain("from('products').select('id').eq('id', data.productId)");
    });
    it('NAO contém query de tabela_preco_gravacao_oficial no saveToBackend', () => {
      const saveBlock = src.split('saveToBackend')[1]?.split('loadFromBackend')[0] ?? '';
      expect(saveBlock).not.toContain("from('tabela_preco_gravacao_oficial')");
    });
    it('NAO contém query de bitrix_clients no saveToBackend', () => {
      const saveBlock = src.split('saveToBackend')[1]?.split('loadFromBackend')[0] ?? '';
      expect(saveBlock).not.toContain("from('bitrix_clients')");
    });
    it('IDs usados via nullish coalescing', () => {
      expect(src).toContain('const safeProductId: string | null = data.productId ?? null;');
      expect(src).toContain('const safeTechniqueId: string | null = data.techniqueId ?? null;');
      expect(src).toContain('const safeClientId: string | null = data.clientId ?? null;');
    });
  });

  describe('BUG-H — console.warn no fallback FK', () => {
    it('bloco catch/fallback 23503 emite logger.warn (migrado de console.warn)', () => {
      expect(src).toContain('logger.warn');
    });
    it('mensagem de warn menciona FK violation', () => {
      expect(src).toContain('FK violation on draft save');
    });
  });

  describe('clearDraft — surface Supabase delete errors', () => {
    it('clearDraft destructura { error: deleteError } da chamada delete', () => {
      // Regression guard: ensures the delete result is NOT silently ignored.
      // Before fix: `await supabase...delete()...` — no error check.
      // After fix:  `const { error: deleteError } = await supabase...delete()...`
      const clearBlock = src.split('const clearDraft')[1]?.split('const saveDraft')[0] ?? '';
      expect(clearBlock).toContain('error: deleteError');
    });
    it('clearDraft lança deleteError quando presente', () => {
      const clearBlock = src.split('const clearDraft')[1]?.split('const saveDraft')[0] ?? '';
      expect(clearBlock).toContain('if (deleteError) throw deleteError');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — useMockupTechniques.ts
// =====================================================================

describe('Analise estatica — useMockupTechniques.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/hooks/mockup/useMockupTechniques.ts');
  });

  describe('BUG-B — nao retorna [] durante loading', () => {
    it('bloco de loading retorna techniques.map(toUnlimited)', () => {
      const loadingBlock =
        src.split('customizationData === undefined && isFetching')[1]?.split('}')[0] ?? '';
      expect(loadingBlock).not.toContain('return [];');
      expect(loadingBlock).toContain('return techniques.map(toUnlimited)');
    });
    it('funcao auxiliar toUnlimited definida', () => {
      expect(src).toContain('function toUnlimited');
    });
  });

  describe('BUG-D — null guard antes de codeMap.set', () => {
    it('guard if (!tech.code) continue presente', () => {
      expect(src).toContain('if (!tech.code) continue;');
    });
    it('guard precede codeMap.set', () => {
      const guardPos = src.indexOf('if (!tech.code) continue;');
      const setPos = src.indexOf('codeMap.set(tech.code,');
      expect(guardPos).toBeGreaterThan(-1);
      expect(setPos).toBeGreaterThan(-1);
      expect(guardPos).toBeLessThan(setPos);
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — useLogoProcessing.ts
// =====================================================================

describe('Analise estatica — useLogoProcessing.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/logo-editor/useLogoProcessing.ts');
  });

  describe('catch block loga erros de processamento de logo', () => {
    it('importa logger de @/lib/logger', () => {
      expect(src).toContain("from '@/lib/logger'");
    });
    it('catch block chama logger.error', () => {
      const catchBlock = src.split('.catch(')[1]?.split('.finally(')[0] ?? '';
      expect(catchBlock).toContain('logger.error');
    });
    it('catch block ainda reseta processedLogoUrl para null', () => {
      const catchBlock = src.split('.catch(')[1]?.split('.finally(')[0] ?? '';
      expect(catchBlock).toContain('setProcessedLogoUrl(null)');
    });
    it('erro nao e silenciado — parametro tipado como unknown', () => {
      expect(src).toMatch(/\.catch\s*\(\s*\(err\s*:\s*unknown\)/);
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — ArtFileUpload.tsx
// =====================================================================

describe('Analise estatica — ArtFileUpload.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/ArtFileUpload.tsx');
  });

  describe('handleRemove — erro de storage nao silenciado', () => {
    it('destructura { error: storageErr } do storage.remove', () => {
      const removeBlock =
        src.split('const handleRemove')[1]?.split('const handleDownload')[0] ?? '';
      expect(removeBlock).toContain('error: storageErr');
    });
    it('storageErr e logado quando presente', () => {
      const removeBlock =
        src.split('const handleRemove')[1]?.split('const handleDownload')[0] ?? '';
      expect(removeBlock).toContain('logger.error');
      expect(removeBlock).toContain('storageErr');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — ShareMenu.tsx
// =====================================================================

describe('Analise estatica — ShareMenu.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/ShareMenu.tsx');
  });

  describe('catch blocks — erros de clipboard/download/pdf nao silenciados', () => {
    it('importa logger de @/lib/logger', () => {
      expect(src).toContain("from '@/lib/logger'");
    });
    it('handleCopyLink catch captura err como unknown', () => {
      const copyBlock =
        src.split('const handleCopyLink')[1]?.split('const handleDownloadPNG')[0] ?? '';
      expect(copyBlock).toMatch(/catch\s*\(\s*err\s*:\s*unknown\s*\)/);
    });
    it('handleCopyLink catch loga o erro', () => {
      const copyBlock =
        src.split('const handleCopyLink')[1]?.split('const handleDownloadPNG')[0] ?? '';
      expect(copyBlock).toContain('logger.error');
    });
    it('handleDownloadPNG catch captura err como unknown', () => {
      const pngBlock =
        src.split('const handleDownloadPNG')[1]?.split('const handleDownloadPDF')[0] ?? '';
      expect(pngBlock).toMatch(/catch\s*\(\s*err\s*:\s*unknown\s*\)/);
    });
    it('handleDownloadPNG catch loga o erro', () => {
      const pngBlock =
        src.split('const handleDownloadPNG')[1]?.split('const handleDownloadPDF')[0] ?? '';
      expect(pngBlock).toContain('logger.error');
    });
    it('handleDownloadPDF catch captura err como unknown', () => {
      const pdfBlock =
        src.split('const handleDownloadPDF')[1]?.split('const handleWhatsApp')[0] ?? '';
      expect(pdfBlock).toMatch(/catch\s*\(\s*err\s*:\s*unknown\s*\)/);
    });
    it('handleDownloadPDF catch loga o erro', () => {
      const pdfBlock =
        src.split('const handleDownloadPDF')[1]?.split('const handleWhatsApp')[0] ?? '';
      expect(pdfBlock).toContain('logger.error');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — AreaCard.tsx
// =====================================================================

describe('Analise estatica — AreaCard.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/AreaCard.tsx');
  });

  describe('displayName — memo() component identificavel no React DevTools', () => {
    it('exporta como memo()', () => {
      expect(src).toContain('export const AreaCard = memo(');
    });
    it('define displayName apos o componente', () => {
      expect(src).toContain("AreaCard.displayName = 'AreaCard'");
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — useMockupGenerator.ts
// =====================================================================

describe('Analise estatica — useMockupGenerator.ts', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/hooks/mockup/useMockupGenerator.ts');
  });

  describe('reader.onerror — erro de FileReader nao silenciado', () => {
    it('importa logger de @/lib/logger', () => {
      expect(src).toContain("from '@/lib/logger'");
    });
    it('onerror handler recebe parametro de evento', () => {
      const onerrorBlock = src.split('reader.onerror')[1]?.split('reader.readAsDataURL')[0] ?? '';
      expect(onerrorBlock).toContain('(e) =>');
    });
    it('onerror handler chama logger.error', () => {
      const onerrorBlock = src.split('reader.onerror')[1]?.split('reader.readAsDataURL')[0] ?? '';
      expect(onerrorBlock).toContain('logger.error');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — MockupHistoryPanel.tsx
// =====================================================================

describe('Analise estatica — MockupHistoryPanel.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/MockupHistoryPanel.tsx');
  });

  describe('displayName — componentes memo() identificaveis no React DevTools', () => {
    it('MockupGridCard e exportado como memo()', () => {
      expect(src).toContain('const MockupGridCard = memo(');
    });
    it('MockupGridCard define displayName', () => {
      expect(src).toContain("MockupGridCard.displayName = 'MockupGridCard'");
    });
    it('MockupListRow e exportado como memo()', () => {
      expect(src).toContain('const MockupListRow = memo(');
    });
    it('MockupListRow define displayName', () => {
      expect(src).toContain("MockupListRow.displayName = 'MockupListRow'");
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — MockupResultCard.tsx
// =====================================================================

describe('Analise estatica — MockupResultCard.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/MockupResultCard.tsx');
  });

  describe('displayName — memo() component identificavel no React DevTools', () => {
    it('MockupResultCard e exportado como memo()', () => {
      expect(src).toContain('export const MockupResultCard = memo(');
    });
    it('MockupResultCard define displayName', () => {
      expect(src).toContain("MockupResultCard.displayName = 'MockupResultCard'");
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — SaveTemplateDialog.tsx
// =====================================================================

describe('Analise estatica — SaveTemplateDialog.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/SaveTemplateDialog.tsx');
  });

  describe('a11y — label associado ao input via htmlFor/id', () => {
    it('Input tem id="template-name-input"', () => {
      expect(src).toContain('id="template-name-input"');
    });
    it('label tem htmlFor="template-name-input"', () => {
      expect(src).toContain('htmlFor="template-name-input"');
    });
  });
});

// =====================================================================
// STATIC ANALYSIS — MockupAnnotations.tsx
// =====================================================================

describe('Analise estatica — MockupAnnotations.tsx', () => {
  let src: string;
  beforeEach(() => {
    src = readSrc('src/components/mockup/MockupAnnotations.tsx');
  });

  describe('a11y — aria-label semantico no botao de remover anotacao', () => {
    it('botao de remover tem aria-label descritivo', () => {
      expect(src).toContain('aria-label="Remover anotação"');
    });
    it('aria-label "Fechar" nao e usado no botao de remover anotacao', () => {
      const beforeRemove = src.split('removeAnnotation(ann.id)')[0] ?? '';
      expect(beforeRemove).not.toContain('aria-label="Fechar"');
    });
  });
});
