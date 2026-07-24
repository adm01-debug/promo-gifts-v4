/**
 * MagicUpResultPanel — testes de navegação por teclado (WCAG 2.1.1 Keyboard)
 * + WAI-ARIA APG Tabs Pattern (roving tabindex, aria-selected sincronizado).
 *
 * Cobre prev/next, dots de paginação e thumbnails:
 * - Tab order segue ordem do DOM
 * - Enter/Space ativam handlers em <button> nativos
 * - Apenas a tab ativa é alcançável via Tab (roving tabindex)
 * - aria-selected sincronizado entre dots e thumbnails
 *
 * Estratégia: stub de subcomponentes pesados (AdImageResult, MagicUpVariationComparator)
 * para isolar o foco apenas nos controles de variação do painel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, within, createEvent } from "@testing-library/react";
import { MagicUpResultPanel } from "@/pages/magic-up/MagicUpResultPanel";

vi.mock("@/components/magic-up/AdImageResult", () => ({
  AdImageResult: () => <div data-testid="ad-image-result-stub" />,
}));

vi.mock("@/components/magic-up/MagicUpVariationComparator", () => ({
  MagicUpVariationComparator: () => <div data-testid="comparator-stub" />,
}));

type StubState = Parameters<typeof MagicUpResultPanel>[0]["m"];

function buildStubState({
  variationsCount = 3,
  activeVariation = 0,
}: { variationsCount?: number; activeVariation?: number } = {}): StubState {
  const variations = Array.from({ length: variationsCount }).map((_, i) => ({
    id: `var-${i + 1}`,
    imageUrl: `https://example.com/img-${i + 1}.png`,
    isFavorite: false,
    qualityScore: 80,
    curationStatus: "draft" as const,
    isWinner: false,
  }));

  return {
    variations,
    activeVariation,
    setActiveVariation: vi.fn(),
    currentVariation: variations[activeVariation],
    generating: false,
    history: [],
    selectedProduct: { name: "Caneta Premium" },
    selectedScene: { title: "Lifestyle" },
    handleDownload: vi.fn(),
    handleShare: vi.fn(),
    handleGenerate: vi.fn(),
    handleToggleFavorite: vi.fn(),
    handleSelectHistory: vi.fn(),
    handleDeleteHistory: vi.fn(),
    handleToggleHistoryFavorite: vi.fn(),
    handleSelectWinningVariation: vi.fn(),
    handleSetCurationStatus: vi.fn(),
    handleRunQualityScore: vi.fn(),
    qualityScore: 80,
    qualityDiagnosis: undefined,
    curationStatus: "draft",
    copyPack: { headline: "", subheadline: "", cta: "", body: "", hashtags: [] },
    creativeControls: { aspectRatio: "1:1" },
  } as unknown as StubState;
}

// ─────── Helpers para escopo isolado dos dois tablists ───────
function getDotsTablist() {
  return screen.getByRole("tablist", { name: "Variações geradas" });
}
function getThumbsTablist() {
  return screen.getByRole("tablist", { name: "Miniaturas das variações" });
}
function getDots() {
  return within(getDotsTablist()).getAllByRole("tab");
}
function getThumbs() {
  return within(getThumbsTablist()).getAllByRole("tab");
}

describe("MagicUpResultPanel — navegação por teclado (WCAG 2.1.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Tab atinge prev → dots → next na ordem do DOM", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });
    const dots = getDots();

    prev.focus();
    expect(document.activeElement).toBe(prev);

    dots[0].focus();
    expect(document.activeElement).toBe(dots[0]);

    dots[1].focus();
    expect(document.activeElement).toBe(dots[1]);

    dots[2].focus();
    expect(document.activeElement).toBe(dots[2]);

    next.focus();
    expect(document.activeElement).toBe(next);

    const all = [prev, ...dots, next];
    for (let i = 0; i < all.length - 1; i++) {
      const pos = all[i].compareDocumentPosition(all[i + 1]);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("Enter no dot ativa setActiveVariation com índice correto", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dot3 = within(getDotsTablist()).getByRole("tab", { name: "Selecionar variação 3" });
    dot3.focus();
    expect(document.activeElement).toBe(dot3);

    fireEvent.keyDown(dot3, { key: "Enter", code: "Enter" });
    fireEvent.click(dot3);

    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });

  it("Space no dot ativa setActiveVariation com índice correto", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dot2 = within(getDotsTablist()).getByRole("tab", { name: "Selecionar variação 2" });
    dot2.focus();

    fireEvent.keyDown(dot2, { key: " ", code: "Space" });
    fireEvent.click(dot2);

    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("Enter no botão Avançar incrementa activeVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" });
    next.focus();
    fireEvent.keyDown(next, { key: "Enter", code: "Enter" });
    fireEvent.click(next);

    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("Enter no botão Voltar decrementa activeVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    prev.focus();
    fireEvent.keyDown(prev, { key: "Enter", code: "Enter" });
    fireEvent.click(prev);

    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("Thumbnail abre variação correta via teclado e mantém ordem de tab", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();

    for (let i = 0; i < thumbs.length - 1; i++) {
      const pos = thumbs[i].compareDocumentPosition(thumbs[i + 1]);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    thumbs[2].focus();
    expect(document.activeElement).toBe(thumbs[2]);
    fireEvent.keyDown(thumbs[2], { key: "Enter", code: "Enter" });
    fireEvent.click(thumbs[2]);

    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });
});

describe("MagicUpResultPanel — hit area dos dots (WCAG 2.5.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Click no botão dot (área expandida 44x44) ativa setActiveVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    fireEvent.click(dots[2]);

    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });

  it("Click no span visual interno borbulha e ativa setActiveVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    const innerSpan = dots[1].querySelector("span[aria-hidden='true']");
    expect(innerSpan).not.toBeNull();

    fireEvent.click(innerSpan!);

    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("Cada botão dot expõe dimensões mínimas WCAG 2.5.5 (w-11 h-11)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    // eslint-disable-next-line no-restricted-syntax
    dots.forEach((dot) => {
      expect(dot.className).toMatch(/\bw-11\b/);
      expect(dot.className).toMatch(/\bh-11\b/);
    });
  });
});

// ───────── WAI-ARIA APG Tabs Pattern: Roving Tabindex + aria-selected ─────────

describe("MagicUpResultPanel — Dots: roving tabindex + aria-selected (APG Tabs)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tablist 'Variações geradas' tem role=tablist, aria-label e N tabs com role=tab", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const tablist = getDotsTablist();
    expect(tablist).toHaveAttribute("aria-label", "Variações geradas");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("apenas o dot do activeVariation tem tabindex=0; demais tabindex=-1 (roving)", () => {
    for (const active of [0, 1, 2]) {
      const m = buildStubState({ variationsCount: 3, activeVariation: active });
      const { unmount } = render(<MagicUpResultPanel m={m} />);
      const dots = getDots();
      // eslint-disable-next-line no-restricted-syntax
      dots.forEach((dot, i) => {
        expect(dot).toHaveAttribute("tabindex", i === active ? "0" : "-1");
      });
      unmount();
    }
  });

  it("aria-selected=true e aria-current=true apenas no dot ativo", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots[0]).toHaveAttribute("aria-selected", "false");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    expect(dots[1]).toHaveAttribute("aria-selected", "true");
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[2]).toHaveAttribute("aria-selected", "false");
    expect(dots[2]).not.toHaveAttribute("aria-current");
  });

  it("clicar em dot inativo dispara setActiveVariation com índice correto", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    fireEvent.click(dots[2]);
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });
});

describe("MagicUpResultPanel — Thumbnails: APG Tabs equivalente aos dots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wrapper das thumbnails é role=tablist com aria-label='Miniaturas das variações'", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const tablist = getThumbsTablist();
    expect(tablist).toHaveAttribute("aria-label", "Miniaturas das variações");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("cada thumbnail tem role=tab, aria-selected sincronizado e tabindex roving", () => {
    for (const active of [0, 1, 2]) {
      const m = buildStubState({ variationsCount: 3, activeVariation: active });
      const { unmount } = render(<MagicUpResultPanel m={m} />);
      const thumbs = getThumbs();
      // eslint-disable-next-line no-restricted-syntax
      thumbs.forEach((thumb, i) => {
        expect(thumb).toHaveAttribute("role", "tab");
        expect(thumb).toHaveAttribute("aria-selected", i === active ? "true" : "false");
        expect(thumb).toHaveAttribute("tabindex", i === active ? "0" : "-1");
      });
      unmount();
    }
  });

  it("clicar/Enter em thumbnail inativa dispara setActiveVariation correto", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    thumbs[2].focus();
    fireEvent.keyDown(thumbs[2], { key: "Enter", code: "Enter" });
    fireEvent.click(thumbs[2]);

    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });
});

describe("MagicUpResultPanel — Prev/Next: disabled states + focus ring (WCAG 1.4.3, 2.4.7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no primeiro índice: 'Voltar' disabled com classes token-on-token; 'Avançar' enabled e funcional", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    expect(prev).toBeDisabled();
    expect(prev.className).toContain("disabled:bg-muted");
    expect(prev.className).toContain("disabled:text-muted-foreground");
    expect(prev.className).toContain("disabled:opacity-100");

    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("no último índice: 'Avançar' disabled; 'Voltar' enabled dispara setActiveVariation(prev)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    expect(next).toBeDisabled();
    expect(next.className).toContain("disabled:bg-muted");
    expect(next.className).toContain("disabled:text-muted-foreground");
    expect(next.className).toContain("disabled:opacity-100");

    expect(prev).not.toBeDisabled();
    fireEvent.click(prev);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("prev/next expõem aria-label e classes focus-visible (WCAG 2.4.7)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    // eslint-disable-next-line no-restricted-syntax
    [prev, next].forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label");
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-ring");
      expect(btn.className).toContain("focus-visible:ring-offset-2");
      expect(btn.className).toContain("focus-visible:ring-offset-background");
    });
  });
});

// ───────── Focus-visible em Tab + persistência após Enter/Space (WCAG 2.4.7 + 2.4.3) ─────────

const FOCUS_VISIBLE_CLASSES = [
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
];

function expectFocusVisibleClasses(el: HTMLElement) {
  for (const cls of FOCUS_VISIBLE_CLASSES) {
    expect(el.className).toContain(cls);
  }
}

function expectFocusVisibleOutlineNone(el: HTMLElement) {
  expect(el.className).toContain("focus-visible:outline-none");
}

describe("MagicUpResultPanel — focus-visible em Tab + persistência após Enter/Space", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prev/next recebem foco via Tab e carregam classes focus-visible + outline-none", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    prev.focus();
    expect(prev).toHaveFocus();
    expectFocusVisibleClasses(prev);
    expectFocusVisibleOutlineNone(prev);

    next.focus();
    expect(next).toHaveFocus();
    expectFocusVisibleClasses(next);
    expectFocusVisibleOutlineNone(next);
  });

  it("cada dot do tablist carrega classes focus-visible canônicas + outline-none", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax
    dots.forEach((dot) => {
      expectFocusVisibleClasses(dot);
      expectFocusVisibleOutlineNone(dot);
    });
  });

  it("cada thumbnail carrega classes focus-visible canônicas + outline-none", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    expect(thumbs).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax
    thumbs.forEach((thumb) => {
      expectFocusVisibleClasses(thumb);
      expectFocusVisibleOutlineNone(thumb);
    });
  });

  it("após Enter no dot, foco permanece no dot ativado e classes focus-visible mantidas", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    const target = dots[2];
    target.focus();
    expect(target).toHaveFocus();

    fireEvent.keyDown(target, { key: "Enter", code: "Enter" });
    fireEvent.click(target);

    expect(document.activeElement).toBe(target);
    expectFocusVisibleClasses(target);
    expectFocusVisibleOutlineNone(target);
  });

  it("após Space no botão Avançar, foco permanece no botão e classes focus-visible mantidas", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" });
    next.focus();
    expect(next).toHaveFocus();

    fireEvent.keyDown(next, { key: " ", code: "Space" });
    fireEvent.click(next);

    expect(document.activeElement).toBe(next);
    expectFocusVisibleClasses(next);
    expectFocusVisibleOutlineNone(next);
  });

  it("após Enter na thumbnail, foco permanece e classes focus-visible mantidas", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    const target = thumbs[2];
    target.focus();
    expect(target).toHaveFocus();

    fireEvent.keyDown(target, { key: "Enter", code: "Enter" });
    fireEvent.click(target);

    expect(document.activeElement).toBe(target);
    expectFocusVisibleClasses(target);
    expectFocusVisibleOutlineNone(target);
  });
});

describe("MagicUpResultPanel — Sincronização cross-grupo entre dots e thumbnails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("activeVariation propaga aria-selected/tabindex consistentes nos dois tablists", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    const thumbs = getThumbs();

    // eslint-disable-next-line no-restricted-syntax
    [0, 1, 2].forEach((i) => {
      const expectedSelected = i === 1 ? "true" : "false";
      const expectedTabindex = i === 1 ? "0" : "-1";
      expect(dots[i]).toHaveAttribute("aria-selected", expectedSelected);
      expect(thumbs[i]).toHaveAttribute("aria-selected", expectedSelected);
      expect(dots[i]).toHaveAttribute("tabindex", expectedTabindex);
      expect(thumbs[i]).toHaveAttribute("tabindex", expectedTabindex);
    });
  });
});

// ───── Accessible names + ARIA roles para screen readers (WCAG 4.1.2 / 2.4.6 / 1.3.1) ─────

function expectAccessibleName(el: HTMLElement, expected: string | RegExp) {
  const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
  if (expected instanceof RegExp) {
    expect(name).toMatch(expected);
  } else {
    expect(name).toBe(expected);
  }
}

function expectUniqueNames(elements: HTMLElement[]) {
  const names = elements.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "");
  expect(new Set(names).size).toBe(names.length);
}

describe("MagicUpResultPanel — accessible names e atributos ARIA para screen readers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Prev e Next têm accessible names 'Voltar' e 'Avançar' via aria-label", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    expect(prev).toHaveAttribute("aria-label", "Voltar");
    expect(next).toHaveAttribute("aria-label", "Avançar");
    expectAccessibleName(prev, "Voltar");
    expectAccessibleName(next, "Avançar");
  });

  it("Dots têm accessible names únicos no formato 'Selecionar variação N' (1-based)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax
    dots.forEach((dot, i) => {
      expectAccessibleName(dot, `Selecionar variação ${i + 1}`);
    });
    expectUniqueNames(dots);
  });

  it("Thumbnails têm accessible names únicos no formato 'Abrir miniatura da variação N'", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    expect(thumbs).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax
    thumbs.forEach((thumb, i) => {
      expectAccessibleName(thumb, `Abrir miniatura da variação ${i + 1}`);
    });
    expectUniqueNames(thumbs);

    // Thumbnails devem ter nomes distintos dos dots para evitar duplicação no SR
    const dotNames = getDots().map((d) => d.getAttribute("aria-label"));
    const thumbNames = thumbs.map((t) => t.getAttribute("aria-label"));
    expect(thumbNames).not.toHaveLength(0);
    thumbNames.forEach((name) => {
      expect(dotNames).not.toContain(name);
    });
  });

  it("Tablists têm aria-label distintos ('Variações geradas' vs 'Miniaturas das variações')", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dotsTablist = screen.getByRole("tablist", { name: "Variações geradas" });
    const thumbsTablist = screen.getByRole("tablist", { name: "Miniaturas das variações" });

    expect(dotsTablist).toHaveAttribute("aria-label", "Variações geradas");
    expect(thumbsTablist).toHaveAttribute("aria-label", "Miniaturas das variações");
    expect(dotsTablist).not.toBe(thumbsTablist);
  });

  it("Roles corretos: prev/next=button, dots/thumbnails=tab dentro de tablist", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });
    expect(prev.tagName).toBe("BUTTON");
    expect(next.tagName).toBe("BUTTON");

    expect(getDotsTablist()).toHaveAttribute("role", "tablist");
    expect(getThumbsTablist()).toHaveAttribute("role", "tablist");

    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => expect(dot).toHaveAttribute("role", "tab"));
    // eslint-disable-next-line no-restricted-syntax
    getThumbs().forEach((thumb) => expect(thumb).toHaveAttribute("role", "tab"));
  });

  it("Dot ativo expõe aria-current='true'; demais dots não expõem aria-current", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    expect(dots[2]).not.toHaveAttribute("aria-current");
  });

  it("Prev/Next mantêm accessible name quando disabled (SR anuncia 'Voltar/Avançar, indisponível')", () => {
    const mFirst = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { unmount } = render(<MagicUpResultPanel m={mFirst} />);
    const prevDisabled = screen.getByRole("button", { name: "Voltar" });
    expect(prevDisabled).toBeDisabled();
    expect(prevDisabled).toHaveAttribute("aria-label", "Voltar");
    unmount();

    const mLast = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={mLast} />);
    const nextDisabled = screen.getByRole("button", { name: "Avançar" });
    expect(nextDisabled).toBeDisabled();
    expect(nextDisabled).toHaveAttribute("aria-label", "Avançar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-suíte: comportamento de extremidades (no-wrap) em Tab/Enter/Space
// WCAG 2.1.1 (Keyboard) + 2.1.2 (No Keyboard Trap) + 2.4.3 (Focus Order)
// ─────────────────────────────────────────────────────────────────────────────
describe("MagicUpResultPanel — comportamento de extremidades (no-wrap) em Tab/Enter/Space", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function pressKey(el: HTMLElement, key: "Enter" | " ") {
    fireEvent.keyDown(el, { key });
    // Browsers disparam click sintético em Enter/Space em <button>; replicamos
    if (!(el as HTMLButtonElement).disabled) {
      fireEvent.click(el);
    }
  }

  it("Prev disabled no primeiro índice; click/Enter/Space não disparam setActiveVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    expect(prev).toBeDisabled();

    fireEvent.click(prev);
    pressKey(prev, "Enter");
    pressKey(prev, " ");

    expect(m.setActiveVariation).not.toHaveBeenCalled();
  });

  it("Next disabled no último índice; click/Enter/Space não disparam setActiveVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" });
    expect(next).toBeDisabled();

    fireEvent.click(next);
    pressKey(next, "Enter");
    pressKey(next, " ");

    expect(m.setActiveVariation).not.toHaveBeenCalled();
  });

  it("Prev funciona normalmente em índice intermediário (chama setActiveVariation com índice-1)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    expect(prev).not.toBeDisabled();

    fireEvent.click(prev);
    expect(m.setActiveVariation).toHaveBeenCalledWith(0);
  });

  it("Next funciona normalmente em índice intermediário (chama setActiveVariation com índice+1)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" });
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });

  it("Roving tabindex no primeiro índice: apenas dot[0]/thumb[0] com tabindex=0 (sem wrap)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots[0]).toHaveAttribute("tabindex", "0");
    expect(dots[1]).toHaveAttribute("tabindex", "-1");
    expect(dots[2]).toHaveAttribute("tabindex", "-1");

    const thumbs = getThumbs();
    expect(thumbs[0]).toHaveAttribute("tabindex", "0");
    expect(thumbs[1]).toHaveAttribute("tabindex", "-1");
    expect(thumbs[2]).toHaveAttribute("tabindex", "-1");
  });

  it("Roving tabindex no último índice: apenas dot[last]/thumb[last] com tabindex=0 (sem wrap)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots[2]).toHaveAttribute("tabindex", "0");
    expect(dots[0]).toHaveAttribute("tabindex", "-1");
    expect(dots[1]).toHaveAttribute("tabindex", "-1");

    const thumbs = getThumbs();
    expect(thumbs[2]).toHaveAttribute("tabindex", "0");
    expect(thumbs[0]).toHaveAttribute("tabindex", "-1");
    expect(thumbs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("Enter/Space em dot/thumb já ativo é idempotente (chama com mesmo índice; foco permanece)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    dots[1].focus();
    expect(document.activeElement).toBe(dots[1]);
    pressKey(dots[1], "Enter");
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(dots[1]);

    const thumbs = getThumbs();
    thumbs[1].focus();
    expect(document.activeElement).toBe(thumbs[1]);
    pressKey(thumbs[1], " ");
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(thumbs[1]);
  });

  it("Foco em next não retorna ao prev (sem wrap/trap de foco)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    next.focus();
    expect(document.activeElement).toBe(next);
    // Após focar next, o foco não deve estar (nem ciclar) para prev — Tab é linear,
    // não há trap/wrap forçado pelo painel.
    expect(document.activeElement).not.toBe(prev);
  });
});

// ───────── Retorno de foco após troca de variação ativa (WCAG 2.4.3, 2.4.7, 3.2.1) ─────────

describe("MagicUpResultPanel — retorno de foco após troca de variação ativa", () => {
  beforeEach(() => vi.clearAllMocks());

  function activate(el: HTMLElement, key: "click" | "Enter" | " " = "click") {
    el.focus();
    if (key === "click") {
      fireEvent.click(el);
    } else {
      fireEvent.keyDown(el, { key });
      fireEvent.click(el);
    }
  }

  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  it("Click em dot[2] mantém foco em dot[2] após re-render com active=2", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getDots()[2], "click");
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);

    rerenderWithActive(rerender, m, 2);

    const dotsAfter = getDots();
    expect(document.activeElement).toBe(dotsAfter[2]);
    expect(dotsAfter[0]).toHaveAttribute("tabindex", "-1");
    expect(dotsAfter[1]).toHaveAttribute("tabindex", "-1");
    expect(dotsAfter[2]).toHaveAttribute("tabindex", "0");
  });

  it("Enter em dot[1] mantém foco em dot[1] após re-render com active=1", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getDots()[1], "Enter");
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);

    rerenderWithActive(rerender, m, 1);

    const dotsAfter = getDots();
    expect(document.activeElement).toBe(dotsAfter[1]);
    expect(dotsAfter[0]).toHaveAttribute("tabindex", "-1");
    expect(dotsAfter[1]).toHaveAttribute("tabindex", "0");
    expect(dotsAfter[2]).toHaveAttribute("tabindex", "-1");
  });

  it("Click em thumb[2] mantém foco em thumb[2] após re-render com active=2", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getThumbs()[2], "click");
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);

    rerenderWithActive(rerender, m, 2);

    const thumbsAfter = getThumbs();
    expect(document.activeElement).toBe(thumbsAfter[2]);
    expect(thumbsAfter[2]).toHaveAttribute("tabindex", "0");
  });

  it("Space em thumb[1] mantém foco em thumb[1] após re-render com active=1", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getThumbs()[1], " ");
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);

    rerenderWithActive(rerender, m, 1);

    const thumbsAfter = getThumbs();
    expect(document.activeElement).toBe(thumbsAfter[1]);
    expect(thumbsAfter[0]).toHaveAttribute("tabindex", "-1");
    expect(thumbsAfter[1]).toHaveAttribute("tabindex", "0");
    expect(thumbsAfter[2]).toHaveAttribute("tabindex", "-1");
  });

  it("Ativar dot[N] NÃO desloca foco para thumb[N] (grupos independentes)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getDots()[2], "Enter");
    rerenderWithActive(rerender, m, 2);

    const dotsAfter = getDots();
    const thumbsAfter = getThumbs();
    expect(document.activeElement).toBe(dotsAfter[2]);
    expect(document.activeElement).not.toBe(thumbsAfter[2]);
    // Roving da thumbnail também atualizou, mas foco DOM permanece no dot
    expect(thumbsAfter[2]).toHaveAttribute("tabindex", "0");
  });

  it("Ativar thumb[N] NÃO desloca foco para dot[N] (espelho do anterior)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getThumbs()[1], "click");
    rerenderWithActive(rerender, m, 1);

    const dotsAfter = getDots();
    const thumbsAfter = getThumbs();
    expect(document.activeElement).toBe(thumbsAfter[1]);
    expect(document.activeElement).not.toBe(dotsAfter[1]);
    expect(dotsAfter[1]).toHaveAttribute("tabindex", "0");
  });

  it("Após ativar dot[2], roving tabindex está totalmente re-sincronizado nos dois grupos", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    activate(getDots()[2], "Enter");
    rerenderWithActive(rerender, m, 2);

    const dotsAfter = getDots();
    const thumbsAfter = getThumbs();

    expect(dotsAfter[0]).toHaveAttribute("tabindex", "-1");
    expect(dotsAfter[1]).toHaveAttribute("tabindex", "-1");
    expect(dotsAfter[2]).toHaveAttribute("tabindex", "0");
    expect(thumbsAfter[0]).toHaveAttribute("tabindex", "-1");
    expect(thumbsAfter[1]).toHaveAttribute("tabindex", "-1");
    expect(thumbsAfter[2]).toHaveAttribute("tabindex", "0");

    // Boundary correto pós-ativação: active=2 (último) → next disabled, prev enabled
    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });
    expect(prev).not.toBeDisabled();
    expect(next).toBeDisabled();
  });
});

// ───────────────────────────────────────────────────────────────────
// Sub-suíte: navegação por setas (APG Tabs Pattern) nos dots e thumbnails
// ───────────────────────────────────────────────────────────────────
describe("MagicUpResultPanel — navegação por setas nos dots e thumbnails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ArrowRight em dot[0] move foco para dot[1] e chama setActiveVariation(1)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[0].focus();
    fireEvent.keyDown(dots[0], { key: "ArrowRight" });
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(getDots()[1]);
  });

  it("ArrowLeft em dot[1] move foco para dot[0] e chama setActiveVariation(0)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[1].focus();
    fireEvent.keyDown(dots[1], { key: "ArrowLeft" });
    expect(m.setActiveVariation).toHaveBeenCalledWith(0);
    expect(document.activeElement).toBe(getDots()[0]);
  });

  it("ArrowRight em dot[last] NÃO faz wrap (não-wrap APG): foco e estado intactos", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[2].focus();
    fireEvent.keyDown(dots[2], { key: "ArrowRight" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getDots()[2]);
  });

  it("ArrowLeft em dot[0] NÃO faz wrap (não-wrap APG): foco e estado intactos", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[0].focus();
    fireEvent.keyDown(dots[0], { key: "ArrowLeft" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getDots()[0]);
  });

  it("Home em dot[2] move foco para dot[0]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[2].focus();
    fireEvent.keyDown(dots[2], { key: "Home" });
    expect(m.setActiveVariation).toHaveBeenCalledWith(0);
    expect(document.activeElement).toBe(getDots()[0]);
  });

  it("End em dot[0] move foco para dot[last]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[0].focus();
    fireEvent.keyDown(dots[0], { key: "End" });
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
    expect(document.activeElement).toBe(getDots()[2]);
  });

  it("ArrowDown e ArrowUp funcionam idênticos a ArrowRight/Left (suporte vertical)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[1].focus();
    fireEvent.keyDown(dots[1], { key: "ArrowDown" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(getDots()[2]);

    getDots()[1].focus();
    fireEvent.keyDown(getDots()[1], { key: "ArrowUp" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(getDots()[0]);
  });

  it("preventDefault é chamado para setas — não causa scroll da página", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dot = getDots()[0];
    dot.focus();
    const event = createEvent.keyDown(dot, { key: "ArrowRight" });
    fireEvent(dot, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Mesma navegação por setas funciona em thumbnails (ArrowRight/Left/Home/End)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    thumbs[0].focus();
    fireEvent.keyDown(thumbs[0], { key: "ArrowRight" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(1);
    expect(document.activeElement).toBe(getThumbs()[1]);

    getThumbs()[1].focus();
    fireEvent.keyDown(getThumbs()[1], { key: "ArrowLeft" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(getThumbs()[0]);

    getThumbs()[0].focus();
    fireEvent.keyDown(getThumbs()[0], { key: "End" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(getThumbs()[2]);
  });

  it("Atributo aria-keyshortcuts presente em todos os dots e thumbnails", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const expected = "ArrowLeft ArrowRight ArrowUp ArrowDown Home End";
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => {
      expect(dot).toHaveAttribute("aria-keyshortcuts", expected);
    });
    // eslint-disable-next-line no-restricted-syntax
    getThumbs().forEach((thumb) => {
      expect(thumb).toHaveAttribute("aria-keyshortcuts", expected);
    });
  });
});

// ───────── APG Tabs — gaps de cobertura: N=2/N=1, thumbnails verticais, teclas ignoradas, sincronia com tabindex ─────────
describe("MagicUpResultPanel — setas APG (cobertura adicional de bordas e thumbnails)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Bordas N=2 (menor caso com wrap) e N=1 (no-op) ──

  it("N=2: ArrowRight em dot[1] NÃO faz wrap (não-wrap APG)", () => {
    const m = buildStubState({ variationsCount: 2, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    expect(dots).toHaveLength(2);
    dots[1].focus();
    fireEvent.keyDown(dots[1], { key: "ArrowRight" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getDots()[1]);
  });

  it("N=2: ArrowLeft em dot[0] NÃO faz wrap (não-wrap APG)", () => {
    const m = buildStubState({ variationsCount: 2, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    dots[0].focus();
    fireEvent.keyDown(dots[0], { key: "ArrowLeft" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getDots()[0]);
  });

  it("N=1: dots/thumbs não são renderizados; setActiveVariation não é chamado", () => {
    // Com N=1 o painel não renderiza prev/next/dots/thumbs (gating `variations.length > 1`).
    const m = buildStubState({ variationsCount: 1, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    expect(screen.queryByRole("tablist", { name: "Variações geradas" })).toBeNull();
    expect(screen.queryByRole("tablist", { name: "Miniaturas das variações" })).toBeNull();
    expect(m.setActiveVariation).not.toHaveBeenCalled();
  });

  // ── Thumbnails: paridade completa com dots em ArrowUp/Down + wrap + Home + preventDefault ──

  it("Thumbnails: ArrowDown em thumb[0] move para thumb[1] (suporte vertical)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const thumbs = getThumbs();
    thumbs[0].focus();
    fireEvent.keyDown(thumbs[0], { key: "ArrowDown" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(1);
    expect(document.activeElement).toBe(getThumbs()[1]);
  });

  it("Thumbnails: ArrowUp em thumb[1] move para thumb[0] (suporte vertical)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const thumbs = getThumbs();
    thumbs[1].focus();
    fireEvent.keyDown(thumbs[1], { key: "ArrowUp" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(getThumbs()[0]);
  });

  it("Thumbnails: ArrowRight em thumb[last] NÃO faz wrap (não-wrap APG)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);
    const thumbs = getThumbs();
    thumbs[2].focus();
    fireEvent.keyDown(thumbs[2], { key: "ArrowRight" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getThumbs()[2]);
  });

  it("Thumbnails: ArrowLeft em thumb[0] NÃO faz wrap (não-wrap APG)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const thumbs = getThumbs();
    thumbs[0].focus();
    fireEvent.keyDown(thumbs[0], { key: "ArrowLeft" });
    expect(m.setActiveVariation).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getThumbs()[0]);
  });

  it("Thumbnails: Home em thumb[2] move para thumb[0]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);
    const thumbs = getThumbs();
    thumbs[2].focus();
    fireEvent.keyDown(thumbs[2], { key: "Home" });
    expect(m.setActiveVariation).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(getThumbs()[0]);
  });

  it("Thumbnails: preventDefault chamado para setas (consistente com dots)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const thumb = getThumbs()[0];
    thumb.focus();
    const event = createEvent.keyDown(thumb, { key: "ArrowRight" });
    fireEvent(thumb, event);
    expect(event.defaultPrevented).toBe(true);
  });

  // ── Teclas ignoradas: não causam side-effects (handler retorna sem preventDefault) ──

  it.each(["a", "Tab", "Shift", "Escape", "Backspace"])(
    "Tecla '%s' em dot é ignorada — não chama setActiveVariation e não previne default",
    (key) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      render(<MagicUpResultPanel m={m} />);
      const dot = getDots()[0];
      dot.focus();
      const event = createEvent.keyDown(dot, { key });
      fireEvent(dot, event);
      expect(event.defaultPrevented).toBe(false);
      expect(m.setActiveVariation).not.toHaveBeenCalled();
    }
  );

  it.each(["a", "Tab", "Escape"])(
    "Tecla '%s' em thumbnail é ignorada — não chama setActiveVariation e não previne default",
    (key) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      render(<MagicUpResultPanel m={m} />);
      const thumb = getThumbs()[0];
      thumb.focus();
      const event = createEvent.keyDown(thumb, { key });
      fireEvent(thumb, event);
      expect(event.defaultPrevented).toBe(false);
      expect(m.setActiveVariation).not.toHaveBeenCalled();
    }
  );
});

describe("MagicUpResultPanel — retenção de foco em click no dot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function clickAndCheckFocus(el: HTMLButtonElement) {
    el.focus();
    expect(document.activeElement).toBe(el);
    fireEvent.click(el);
    return document.activeElement;
  }

  it("Click em dot[0] mantém foco em dot[0] e chama setActiveVariation(0)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    const after = clickAndCheckFocus(dots[0]);
    expect(after).toBe(getDots()[0]);
    expect(m.setActiveVariation).toHaveBeenCalledWith(0);
  });

  it("Click em dot[meio] mantém foco em dot[meio]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    const after = clickAndCheckFocus(dots[1]);
    expect(after).toBe(getDots()[1]);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  it("Click em dot[last] mantém foco em dot[last]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    const after = clickAndCheckFocus(dots[2]);
    expect(after).toBe(getDots()[2]);
    expect(m.setActiveVariation).toHaveBeenCalledWith(2);
  });

  it("Click em dot NÃO move foco para o thumbnail correspondente", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    clickAndCheckFocus(dots[2]);
    expect(document.activeElement).not.toBe(getThumbs()[2]);
    expect(document.activeElement).toBe(getDots()[2]);
  });

  it("Click em dot NÃO move foco para prev/next", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    clickAndCheckFocus(dots[2]);
    const prev = screen.getByLabelText("Voltar");
    const next = screen.getByLabelText("Avançar");
    expect(document.activeElement).not.toBe(prev);
    expect(document.activeElement).not.toBe(next);
    expect(document.activeElement).toBe(getDots()[2]);
  });

  it("Click em dot NÃO perde foco para document.body em todas as posições", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    // eslint-disable-next-line no-restricted-syntax
    [0, 1, 2].forEach((i) => {
      const dot = getDots()[i];
      clickAndCheckFocus(dot);
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(getDots()[i]);
    });
  });
});

// ───────── Atributos ARIA dinâmicos refletem variação ativa (WCAG 4.1.2) ─────────

describe("MagicUpResultPanel — atributos ARIA dinâmicos refletem variação ativa", () => {
  beforeEach(() => vi.clearAllMocks());

  function expectAriaSelectedState(elements: HTMLElement[], activeIndex: number) {
    expect(elements).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    elements.forEach((el, i) => {
      const expected = i === activeIndex ? "true" : "false";
      expect(el.getAttribute("aria-selected")).toBe(expected);
    });
  }

  function expectTabIndexState(elements: HTMLElement[], activeIndex: number) {
    expect(elements).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    elements.forEach((el, i) => {
      expect(el.tabIndex).toBe(i === activeIndex ? 0 : -1);
    });
  }

  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  it("aria-selected inicial reflete activeVariation=0 nos dots", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    expectAriaSelectedState(getDots(), 0);
  });

  it("aria-selected migra após re-render com novo active (0 → 2)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);
    expectAriaSelectedState(getDots(), 0);

    rerenderWithActive(rerender, m, 2);
    expectAriaSelectedState(getDots(), 2);
  });

  it("aria-selected em thumbnails segue mesmo contrato após re-render (1 → 0)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);
    expectAriaSelectedState(getThumbs(), 1);

    rerenderWithActive(rerender, m, 0);
    expectAriaSelectedState(getThumbs(), 0);
  });

  it("tabIndex sincronizado com aria-selected nos dots após re-render (1 → 2)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);
    expectTabIndexState(getDots(), 1);
    expectAriaSelectedState(getDots(), 1);

    rerenderWithActive(rerender, m, 2);
    expectTabIndexState(getDots(), 2);
    expectAriaSelectedState(getDots(), 2);
  });

  it("aria-current='true' reflete o ativo apenas no dot ativo após re-render", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);
    rerenderWithActive(rerender, m, 2);

    const dots = getDots();
    expect(dots[0]).not.toHaveAttribute("aria-current");
    expect(dots[1]).not.toHaveAttribute("aria-current");
    expect(dots[2]).toHaveAttribute("aria-current", "true");
  });

  it("múltiplas trocas sequenciais (0 → 2 → 1 → 0) atualizam ARIA sem estado fantasma", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);
    expectAriaSelectedState(getDots(), 0);
    expectTabIndexState(getDots(), 0);

    rerenderWithActive(rerender, m, 2);
    expectAriaSelectedState(getDots(), 2);
    expectTabIndexState(getDots(), 2);

    rerenderWithActive(rerender, m, 1);
    expectAriaSelectedState(getDots(), 1);
    expectTabIndexState(getDots(), 1);

    rerenderWithActive(rerender, m, 0);
    expectAriaSelectedState(getDots(), 0);
    expectTabIndexState(getDots(), 0);

    // Também valida thumbnails no estado final
    expectAriaSelectedState(getThumbs(), 0);
    expectTabIndexState(getThumbs(), 0);
  });

  it("após ArrowRight + re-render, ARIA reflete novo ativo nos dots", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    dots[0].focus();
    fireEvent.keyDown(dots[0], { key: "ArrowRight" });
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);

    rerenderWithActive(rerender, m, 1);
    expectAriaSelectedState(getDots(), 1);
    expectTabIndexState(getDots(), 1);
  });
});

describe("MagicUpResultPanel — tooltip acessível nos dots (WCAG 1.4.13, 4.1.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cada dot tem aria-describedby apontando para id único 'magic-up-dot-tooltip-{i}'", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();

    expect(dots[0]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-0");
    expect(dots[1]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-1");
    expect(dots[2]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-2");

    const ids = dots.map((d) => d.getAttribute("aria-describedby"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tooltip aparece no hover (mouse) com texto 'Variação N'", async () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();

    fireEvent.pointerMove(dots[1], { pointerType: "mouse" });
    fireEvent.pointerEnter(dots[1], { pointerType: "mouse" });
    fireEvent.mouseEnter(dots[1]);
    fireEvent.mouseMove(dots[1]);

    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 1500 });
    expect(tooltip).toHaveTextContent("Variação 2");
  });

  it("tooltip aparece no foco do teclado (WCAG 1.4.13 — equivalência hover/foco)", async () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();

    fireEvent.focus(dots[2]);

    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 1500 });
    expect(tooltip).toHaveTextContent("Variação 3");
  });

  it("tooltip desaparece após blur do dot", async () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();

    fireEvent.focus(dots[1]);
    await screen.findByRole("tooltip", {}, { timeout: 1500 });

    fireEvent.blur(dots[1]);
    // Radix marca data-state="closed" ou remove do DOM — ambos contam como fechado
    await new Promise((r) => setTimeout(r, 50));
    const tooltip = screen.queryByRole("tooltip");
    if (tooltip) {
      expect(tooltip.getAttribute("data-state")).toBe("closed");
    } else {
      expect(tooltip).toBeNull();
    }
  });

  it.each([0, 1, 2])("tooltip do dot[%i] mostra texto correspondente 'Variação N'", async (i) => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();

    fireEvent.focus(dots[i]);
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 1500 });
    expect(tooltip).toHaveTextContent(`Variação ${i + 1}`);
  });

  it("aria-describedby permanece estável após re-render com novo activeVariation", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getDots()[0]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-0");
    expect(getDots()[2]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-2");

    const updated = {
      ...m,
      activeVariation: 2,
      currentVariation: m.variations[2],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);

    // ids NÃO dependem de active — devem permanecer idênticos
    expect(getDots()[0]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-0");
    expect(getDots()[1]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-1");
    expect(getDots()[2]).toHaveAttribute("aria-describedby", "magic-up-dot-tooltip-2");
  });
});

// ───────── Hit area 44×44 responsiva (WCAG 2.5.5 AAA, 2.5.8 AA, 1.4.10 Reflow) ─────────

describe("MagicUpResultPanel — hit area 44×44 responsiva (WCAG 2.5.5 AAA, 2.5.8 AA)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cada dot tem classes w-11 e h-11 (44×44 base)", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => {
      expect(dot.className).toMatch(/\bw-11\b/);
      expect(dot.className).toMatch(/\bh-11\b/);
    });
  });

  it("cada dot tem min-w-11 e min-h-11 (defesa contra colapso flex)", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => {
      expect(dot.className).toMatch(/\bmin-w-11\b/);
      expect(dot.className).toMatch(/\bmin-h-11\b/);
    });
  });

  it("cada dot tem margens negativas -mx-[18px] e -my-[18px] (visual 8px sem alterar)", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => {
      expect(dot.className).toContain("-mx-[18px]");
      expect(dot.className).toContain("-my-[18px]");
    });
  });

  it("container dos dots tem flex-wrap (previne overflow horizontal em mobile)", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    const container = screen.getByTestId("magic-up-dots-container");
    expect(container.className).toMatch(/\bflex-wrap\b/);
  });

  it("container dos dots tem gap-3 mínimo (isola hit areas adjacentes)", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    const container = screen.getByTestId("magic-up-dots-container");
    expect(container.className).toMatch(/\bgap-(3|4|5|6)\b/);
  });

  it("dots NÃO usam classes responsivas que reduzem o tamanho abaixo de 44px", () => {
    const m = buildStubState({ variationsCount: 3 });
    render(<MagicUpResultPanel m={m} />);
    // qualquer prefixo de breakpoint que reduza w/h/min-w/min-h para <11 é proibido
    const shrinkRegex = /\b(sm|md|lg|xl|2xl|max-sm|max-md|max-lg):(w|h|min-w|min-h)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10)\b/;
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot) => {
      expect(dot.className).not.toMatch(shrinkRegex);
    });
  });

  it("com 5 variações (carga), todos os dots mantêm 44×44 e container mantém flex-wrap", () => {
    const m = buildStubState({ variationsCount: 5 });
    render(<MagicUpResultPanel m={m} />);
    const dots = getDots();
    expect(dots).toHaveLength(5);
    // eslint-disable-next-line no-restricted-syntax
    dots.forEach((dot) => {
      expect(dot.className).toMatch(/\bw-11\b/);
      expect(dot.className).toMatch(/\bh-11\b/);
      expect(dot.className).toMatch(/\bmin-w-11\b/);
      expect(dot.className).toMatch(/\bmin-h-11\b/);
    });
    const container = screen.getByTestId("magic-up-dots-container");
    expect(container.className).toMatch(/\bflex-wrap\b/);
  });
});

// ───────── Foco + roving tabindex após click em controle INATIVO ─────────
// WCAG 2.4.3 (Focus Order) + APG Tabs (roving tabindex sincronizado pós-ativação)

describe("MagicUpResultPanel — foco e roving após click em dot/thumbnail inativo", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Simula o ciclo real: usuário clica num controle INATIVO →
   * componente chama setActiveVariation(i) → estado sobe → re-render
   * com novo activeVariation. Validamos que:
   *   1) setActiveVariation foi chamado com o índice correto
   *   2) o foco permanece/migra para o novo controle ativo
   *   3) roving tabindex está 100% sincronizado nos DOIS grupos (dots + thumbs)
   *   4) aria-selected acompanha o tabindex
   */
  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  function expectRovingState(elements: HTMLElement[], activeIndex: number) {
    expect(elements).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    elements.forEach((el, i) => {
      expect(el.tabIndex).toBe(i === activeIndex ? 0 : -1);
      expect(el.getAttribute("aria-selected")).toBe(i === activeIndex ? "true" : "false");
    });
    expectSingleTabStop(elements, activeIndex);
  }

  /**
   * Garante que apenas UM elemento da coleção tem tabindex=0
   * (contrato APG: roving tabindex == single tab stop por tablist).
   */
  function expectSingleTabStop(elements: HTMLElement[], expectedIndex: number) {
    const zeros = elements
      .map((el, i) => (el.tabIndex === 0 ? i : -1))
      .filter((i) => i !== -1);
    expect(zeros).toEqual([expectedIndex]);
  }

  function clickInactiveAndSyncState(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    el: HTMLButtonElement,
    targetIndex: number
  ) {
    expect(el.tabIndex).toBe(-1); // sanity: precisa estar inativo no início
    el.focus();
    expect(document.activeElement).toBe(el);
    fireEvent.click(el);
    expect(m.setActiveVariation).toHaveBeenCalledWith(targetIndex);
    rerenderWithActive(rerender, m, targetIndex);
  }

  // ── Dots ────────────────────────────────────────────────────────────

  it.each([
    { from: 0, to: 2 },
    { from: 0, to: 1 },
    { from: 1, to: 0 },
    { from: 2, to: 0 },
  ])(
    "Click em dot[$to] inativo (active=$from): foco fica em dot[$to] e roving migra",
    ({ from, to }) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: from });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      clickInactiveAndSyncState(rerender, m, getDots()[to] as HTMLButtonElement, to);

      // Após re-render: foco no novo controle ativo (mesmo índice, novo nó React)
      const dotsAfter = getDots();
      expect(document.activeElement).toBe(dotsAfter[to]);
      expectRovingState(dotsAfter, to);
      // Roving deve estar sincronizado também no grupo paralelo de thumbnails
      expectRovingState(getThumbs(), to);
    }
  );

  it("Click em dot inativo: dot anterior perde tabindex=0 e ganha tabindex=-1", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getDots()[0].tabIndex).toBe(0);
    expect(getDots()[2].tabIndex).toBe(-1);

    clickInactiveAndSyncState(rerender, m, getDots()[2] as HTMLButtonElement, 2);

    const dotsAfter = getDots();
    expect(dotsAfter[0].tabIndex).toBe(-1);
    expect(dotsAfter[2].tabIndex).toBe(0);
  });

  // ── Thumbnails ──────────────────────────────────────────────────────

  it.each([
    { from: 0, to: 2 },
    { from: 0, to: 1 },
    { from: 1, to: 0 },
    { from: 2, to: 0 },
  ])(
    "Click em thumbnail[$to] inativo (active=$from): foco fica em thumb[$to] e roving migra",
    ({ from, to }) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: from });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      clickInactiveAndSyncState(rerender, m, getThumbs()[to] as HTMLButtonElement, to);

      const thumbsAfter = getThumbs();
      expect(document.activeElement).toBe(thumbsAfter[to]);
      expectRovingState(thumbsAfter, to);
      // Grupo paralelo de dots também recebe roving sincronizado
      expectRovingState(getDots(), to);
    }
  );

  it("Click em thumbnail inativo: thumb anterior perde tabindex=0 e ganha tabindex=-1", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getThumbs()[1].tabIndex).toBe(0);
    expect(getThumbs()[0].tabIndex).toBe(-1);

    clickInactiveAndSyncState(rerender, m, getThumbs()[0] as HTMLButtonElement, 0);

    const thumbsAfter = getThumbs();
    expect(thumbsAfter[1].tabIndex).toBe(-1);
    expect(thumbsAfter[0].tabIndex).toBe(0);
  });

  // ── Cliques sequenciais em controles inativos ───────────────────────

  it("Cliques sequenciais em dots inativos (0 → 2 → 1) mantêm foco e roving sincronizados a cada passo", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    // Passo 1: 0 → 2
    clickInactiveAndSyncState(rerender, m, getDots()[2] as HTMLButtonElement, 2);
    expect(document.activeElement).toBe(getDots()[2]);
    expectRovingState(getDots(), 2);
    expectRovingState(getThumbs(), 2);

    // Passo 2: 2 → 1 (novo dot inativo)
    clickInactiveAndSyncState(rerender, m, getDots()[1] as HTMLButtonElement, 1);
    expect(document.activeElement).toBe(getDots()[1]);
    expectRovingState(getDots(), 1);
    expectRovingState(getThumbs(), 1);
  });

  it("Click em thumbnail inativo NÃO desloca foco para o dot correspondente", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    clickInactiveAndSyncState(rerender, m, getThumbs()[2] as HTMLButtonElement, 2);

    expect(document.activeElement).toBe(getThumbs()[2]);
    expect(document.activeElement).not.toBe(getDots()[2]);
    // mas o dot correspondente também recebeu roving=0 (sincronia entre grupos)
    expect(getDots()[2].tabIndex).toBe(0);
  });

  it("Click em dot inativo NÃO desloca foco para o thumbnail correspondente", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    clickInactiveAndSyncState(rerender, m, getDots()[1] as HTMLButtonElement, 1);

    expect(document.activeElement).toBe(getDots()[1]);
    expect(document.activeElement).not.toBe(getThumbs()[1]);
    expect(getThumbs()[1].tabIndex).toBe(0);
  });
});

// ───────── Identidade acessível: id/role/aria-label + single tab stop global ─────────
// WCAG 4.1.2 (Name, Role, Value) + WAI-ARIA APG Tabs (1 único tabindex=0 por widget)

describe("MagicUpResultPanel — identidade acessível e single tab stop", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Helpers locais ──────────────────────────────────────────────────

  /** Coleta todos os tab stops do widget de variações (dots + thumbs + prev/next). */
  function collectVariationTabStops() {
    const dots = getDots();
    const thumbs = getThumbs();
    const prev = screen.queryByRole("button", { name: "Voltar" });
    const next = screen.queryByRole("button", { name: "Avançar" });
    return { dots, thumbs, prev, next, all: [...dots, ...thumbs, ...(prev ? [prev] : []), ...(next ? [next] : [])] };
  }

  /** Conta quantos elementos da lista têm tabindex=0 explicitamente. */
  function countTabIndexZero(elements: HTMLElement[]) {
    return elements.filter((el) => el.tabIndex === 0).length;
  }

  /** Asserta presença de aria-label não vazio. */
  function expectAriaLabel(el: HTMLElement, pattern: RegExp | string) {
    const label = el.getAttribute("aria-label");
    expect(label).toBeTruthy();
    if (typeof pattern === "string") expect(label).toBe(pattern);
    else expect(label).toMatch(pattern);
  }

  // ── role nos containers e nos itens ─────────────────────────────────

  it("Cada tablist tem role='tablist' com aria-label único e descritivo", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dotsList = getDotsTablist();
    const thumbsList = getThumbsTablist();

    expect(dotsList).toHaveAttribute("role", "tablist");
    expect(thumbsList).toHaveAttribute("role", "tablist");
    expectAriaLabel(dotsList, "Variações geradas");
    expectAriaLabel(thumbsList, "Miniaturas das variações");

    // labels distintos (não pode haver dois tablists com mesmo nome acessível)
    expect(dotsList.getAttribute("aria-label")).not.toBe(thumbsList.getAttribute("aria-label"));
  });

  it("Todos os dots têm role='tab' e aria-label 'Selecionar variação N'", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dots = getDots();
    expect(dots).toHaveLength(4);
    // eslint-disable-next-line no-restricted-syntax
    dots.forEach((dot, i) => {
      expect(dot).toHaveAttribute("role", "tab");
      expectAriaLabel(dot, `Selecionar variação ${i + 1}`);
    });
  });

  it("Todos os thumbnails têm role='tab' e aria-label começando com 'Variação N'", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumbs = getThumbs();
    expect(thumbs).toHaveLength(4);
    // eslint-disable-next-line no-restricted-syntax
    thumbs.forEach((thumb, i) => {
      expect(thumb).toHaveAttribute("role", "tab");
      expectAriaLabel(thumb, new RegExp(`varia[cç][aã]o\\s+${i + 1}\\b`, "i"));
    });
  });

  it("Botões prev/next têm role implícito de button e aria-label 'Voltar'/'Avançar'", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" });
    const next = screen.getByRole("button", { name: "Avançar" });

    expect(prev.tagName).toBe("BUTTON");
    expect(next.tagName).toBe("BUTTON");
    expectAriaLabel(prev, "Voltar");
    expectAriaLabel(next, "Avançar");
  });

  // ── ids únicos (aria-describedby tooltip) ──────────────────────────

  it("Cada dot tem id implícito via aria-describedby único — sem colisão", () => {
    const m = buildStubState({ variationsCount: 5, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const ids = getDots().map((d) => d.getAttribute("aria-describedby"));
    expect(ids).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    ids.forEach((id) => expect(id).toMatch(/^magic-up-dot-tooltip-\d+$/));
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── Single tab stop por tablist ─────────────────────────────────────

  it.each([0, 1, 2])(
    "Apenas UM dot com tabindex=0 (active=%i) — nenhuma duplicidade",
    (active) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: active });
      render(<MagicUpResultPanel m={m} />);
      expect(countTabIndexZero(getDots())).toBe(1);
      expect(getDots()[active].tabIndex).toBe(0);
    }
  );

  it.each([0, 1, 2])(
    "Apenas UM thumbnail com tabindex=0 (active=%i) — nenhuma duplicidade",
    (active) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: active });
      render(<MagicUpResultPanel m={m} />);
      expect(countTabIndexZero(getThumbs())).toBe(1);
      expect(getThumbs()[active].tabIndex).toBe(0);
    }
  );

  // ── Single tab stop por tablist mantido após troca de active ───────

  it("Após re-render para novo active, ainda há exatamente 1 tabindex=0 em cada tablist", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(countTabIndexZero(getDots())).toBe(1);
    expect(countTabIndexZero(getThumbs())).toBe(1);

    for (const next of [3, 1, 2, 0]) {
      const updated = {
        ...m,
        activeVariation: next,
        currentVariation: m.variations[next],
      } as StubState;
      rerender(<MagicUpResultPanel m={updated} />);

      expect(countTabIndexZero(getDots())).toBe(1);
      expect(countTabIndexZero(getThumbs())).toBe(1);
      expect(getDots()[next].tabIndex).toBe(0);
      expect(getThumbs()[next].tabIndex).toBe(0);
    }
  });

  // ── Garante que dots e thumbs NÃO contam como duplicidade indevida ─

  it("Dots e thumbnails do MESMO índice ativo coexistem com tabindex=0 (são tablists separados)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dotZero = getDots()[1];
    const thumbZero = getThumbs()[1];
    expect(dotZero.tabIndex).toBe(0);
    expect(thumbZero.tabIndex).toBe(0);

    // mas pertencem a tablists distintos com aria-label diferente
    const dotsList = getDotsTablist();
    const thumbsList = getThumbsTablist();
    expect(dotsList.contains(dotZero)).toBe(true);
    expect(thumbsList.contains(thumbZero)).toBe(true);
    expect(dotsList).not.toBe(thumbsList);
  });

  // ── Verifica que itens INATIVOS nunca regridem para tabindex=0 ─────

  it("Nenhum item inativo (não-active) tem tabindex=0 em qualquer momento", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((dot, i) => {
      if (i !== 2) expect(dot.tabIndex).toBe(-1);
    });
    // eslint-disable-next-line no-restricted-syntax
    getThumbs().forEach((thumb, i) => {
      if (i !== 2) expect(thumb.tabIndex).toBe(-1);
    });
  });

  // ── Sanity check: tabStops globais coletados batem com expectativa ─

  it("Snapshot semântico de tab stops: prev/next + 1 dot + 1 thumb = 4 elementos focáveis via Tab", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const { all, prev, next } = collectVariationTabStops();
    const tabbable = all.filter((el) => el.tabIndex === 0);

    // prev e next são sempre focáveis (tabindex padrão = 0 em <button>)
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(tabbable).toContain(prev!);
    expect(tabbable).toContain(next!);

    // exatamente 1 dot ativo + 1 thumb ativo + prev + next
    expect(tabbable).toHaveLength(4);
  });
});

// ───────── Live region: anúncio de variação para leitores de tela ─────────
// WCAG 4.1.3 Status Messages: trocar de variação via prev/next, dot ou thumb
// deve atualizar um live region (role="status" + aria-live="polite") com texto
// "Variação N de TOTAL selecionada".

describe("MagicUpResultPanel — live region anuncia variação ativa (WCAG 4.1.3)", () => {
  beforeEach(() => vi.clearAllMocks());

  function getLiveRegion(): HTMLElement {
    const el = screen.getByTestId("magic-up-variation-live-region");
    return el;
  }

  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  // ── Contrato base do live region ────────────────────────────────────

  it("expõe role='status', aria-live='polite' e aria-atomic='true' (sr-only)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    const live = getLiveRegion();
    expect(live.getAttribute("role")).toBe("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(live.className).toContain("sr-only");
  });

  it("anuncio inicial reflete a variação ativa do estado inicial", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);
    expect(getLiveRegion().textContent).toBe("Variação 2 de 3 selecionada");
  });

  it("não anuncia quando há apenas 1 variação (sem prev/next/dots)", () => {
    const m = buildStubState({ variationsCount: 1, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);
    expect(getLiveRegion().textContent).toBe("");
  });

  // ── Prev / Next ─────────────────────────────────────────────────────

  it("clicar em 'Avançar' atualiza o anúncio para a próxima variação", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getLiveRegion().textContent).toBe("Variação 1 de 3 selecionada");

    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    rerenderWithActive(rerender, m, 1);

    expect(getLiveRegion().textContent).toBe("Variação 2 de 3 selecionada");
  });

  it("clicar em 'Voltar' atualiza o anúncio para a variação anterior", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getLiveRegion().textContent).toBe("Variação 3 de 3 selecionada");

    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    rerenderWithActive(rerender, m, 1);

    expect(getLiveRegion().textContent).toBe("Variação 2 de 3 selecionada");
  });

  // ── Dots ────────────────────────────────────────────────────────────

  it.each([0, 1, 2])(
    "selecionar dot[%i] atualiza o anúncio para 'Variação %s de 3 selecionada'",
    (target) => {
      const initialActive = target === 0 ? 2 : 0;
      const m = buildStubState({ variationsCount: 3, activeVariation: initialActive });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expect(getLiveRegion().textContent).toBe(`Variação ${initialActive + 1} de 3 selecionada`);

      fireEvent.click(getDots()[target]);
      expect(m.setActiveVariation).toHaveBeenCalledWith(target);
      rerenderWithActive(rerender, m, target);

      expect(getLiveRegion().textContent).toBe(`Variação ${target + 1} de 3 selecionada`);
    }
  );

  // ── Thumbnails ──────────────────────────────────────────────────────

  it.each([0, 1, 2])(
    "selecionar thumb[%i] atualiza o anúncio para 'Variação %s de 3 selecionada'",
    (target) => {
      const initialActive = target === 0 ? 2 : 0;
      const m = buildStubState({ variationsCount: 3, activeVariation: initialActive });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expect(getLiveRegion().textContent).toBe(`Variação ${initialActive + 1} de 3 selecionada`);

      fireEvent.click(getThumbs()[target]);
      expect(m.setActiveVariation).toHaveBeenCalledWith(target);
      rerenderWithActive(rerender, m, target);

      expect(getLiveRegion().textContent).toBe(`Variação ${target + 1} de 3 selecionada`);
    }
  );

  // ── Sequência intercalada prev/next + dot/thumb ─────────────────────

  it("sequência prev/next + dot + thumb: anúncio sempre reflete a variação ativa", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    expect(getLiveRegion().textContent).toBe("Variação 1 de 4 selecionada");

    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    rerenderWithActive(rerender, m, 1);
    expect(getLiveRegion().textContent).toBe("Variação 2 de 4 selecionada");

    fireEvent.click(getDots()[3]);
    rerenderWithActive(rerender, m, 3);
    expect(getLiveRegion().textContent).toBe("Variação 4 de 4 selecionada");

    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));
    rerenderWithActive(rerender, m, 2);
    expect(getLiveRegion().textContent).toBe("Variação 3 de 4 selecionada");

    fireEvent.click(getThumbs()[0]);
    rerenderWithActive(rerender, m, 0);
    expect(getLiveRegion().textContent).toBe("Variação 1 de 4 selecionada");
  });
});

// ───────── Regressão: Enter/Space NÃO faz wrap entre dot[last] ↔ dot[0] ─────────
// Diferente das setas (ArrowLeft/Right/Home/End — que navegam por roving),
// Enter e Space APENAS ativam o item já focado. Eles NUNCA podem mover o
// foco/ativação para o extremo oposto da lista (sem wrap acidental).

describe("MagicUpResultPanel — Enter/Space não wrap entre extremos (dot[last] ↔ dot[0])", () => {
  beforeEach(() => vi.clearAllMocks());

  /** Asserta: tabindex=0 SOMENTE no índice esperado; demais = -1. */
  function expectExactlyOneTabbable(elements: HTMLElement[], expectedIndex: number) {
    const tabbable = elements
      .map((el, i) => ({ i, value: el.getAttribute("tabindex") }))
      .filter((entry) => entry.value === "0")
      .map((entry) => entry.i);
    expect(tabbable).toEqual([expectedIndex]);
    expect(elements).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    elements.forEach((el, i) => {
      expect(el.getAttribute("tabindex")).toBe(i === expectedIndex ? "0" : "-1");
    });
  }

  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  // ── DOTS: foco no último, Enter/Space NÃO ativa o primeiro ──────────

  it.each([
    { key: "Enter" as const, code: "Enter" },
    { key: " " as const, code: "Space" },
  ])(
    "foco no dot[last] + $code → ativa dot[last] e NUNCA dot[0] (sem wrap)",
    ({ key, code }) => {
      const total = 4;
      const last = total - 1;
      const m = buildStubState({ variationsCount: total, activeVariation: last });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expectExactlyOneTabbable(getDots(), last);

      const lastDot = getDots()[last] as HTMLButtonElement;
      lastDot.focus();
      expect(document.activeElement).toBe(lastDot);

      fireEvent.keyDown(lastDot, { key, code });
      fireEvent.click(lastDot);

      // Anti-wrap: setActiveVariation NUNCA chamado com 0
      expect(m.setActiveVariation).not.toHaveBeenCalledWith(0);
      // Apenas chamadas com `last` são aceitas
      const calls = (m.setActiveVariation as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      calls.forEach(([idx]) => expect(idx).toBe(last));

      rerenderWithActive(rerender, m, last);

      // Estado permanece no último — invariante preservada
      expectExactlyOneTabbable(getDots(), last);
      expectExactlyOneTabbable(getThumbs(), last);

      // aria-selected também não migrou
      expect(getDots()[last].getAttribute("aria-selected")).toBe("true");
      expect(getDots()[0].getAttribute("aria-selected")).toBe("false");
    }
  );

  // ── DOTS: foco no primeiro, Enter/Space NÃO ativa o último ──────────

  it.each([
    { key: "Enter" as const, code: "Enter" },
    { key: " " as const, code: "Space" },
  ])(
    "foco no dot[0] + $code → ativa dot[0] e NUNCA dot[last] (sem wrap reverso)",
    ({ key, code }) => {
      const total = 4;
      const last = total - 1;
      const m = buildStubState({ variationsCount: total, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expectExactlyOneTabbable(getDots(), 0);

      const firstDot = getDots()[0] as HTMLButtonElement;
      firstDot.focus();
      expect(document.activeElement).toBe(firstDot);

      fireEvent.keyDown(firstDot, { key, code });
      fireEvent.click(firstDot);

      expect(m.setActiveVariation).not.toHaveBeenCalledWith(last);
      const calls = (m.setActiveVariation as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      calls.forEach(([idx]) => expect(idx).toBe(0));

      rerenderWithActive(rerender, m, 0);

      expectExactlyOneTabbable(getDots(), 0);
      expectExactlyOneTabbable(getThumbs(), 0);

      expect(getDots()[0].getAttribute("aria-selected")).toBe("true");
      expect(getDots()[last].getAttribute("aria-selected")).toBe("false");
    }
  );

  // ── THUMBS: mesma garantia anti-wrap nos dois extremos ──────────────

  it.each([
    { key: "Enter" as const, code: "Enter" },
    { key: " " as const, code: "Space" },
  ])(
    "foco no thumb[last] + $code → ativa thumb[last] e NUNCA thumb[0]",
    ({ key, code }) => {
      const total = 4;
      const last = total - 1;
      const m = buildStubState({ variationsCount: total, activeVariation: last });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expectExactlyOneTabbable(getThumbs(), last);

      const lastThumb = getThumbs()[last] as HTMLButtonElement;
      lastThumb.focus();
      fireEvent.keyDown(lastThumb, { key, code });
      fireEvent.click(lastThumb);

      expect(m.setActiveVariation).not.toHaveBeenCalledWith(0);
      const calls = (m.setActiveVariation as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      calls.forEach(([idx]) => expect(idx).toBe(last));

      rerenderWithActive(rerender, m, last);
      expectExactlyOneTabbable(getThumbs(), last);
      expectExactlyOneTabbable(getDots(), last);
    }
  );

  it.each([
    { key: "Enter" as const, code: "Enter" },
    { key: " " as const, code: "Space" },
  ])(
    "foco no thumb[0] + $code → ativa thumb[0] e NUNCA thumb[last]",
    ({ key, code }) => {
      const total = 4;
      const last = total - 1;
      const m = buildStubState({ variationsCount: total, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      expectExactlyOneTabbable(getThumbs(), 0);

      const firstThumb = getThumbs()[0] as HTMLButtonElement;
      firstThumb.focus();
      fireEvent.keyDown(firstThumb, { key, code });
      fireEvent.click(firstThumb);

      expect(m.setActiveVariation).not.toHaveBeenCalledWith(last);
      const calls = (m.setActiveVariation as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      calls.forEach(([idx]) => expect(idx).toBe(0));

      rerenderWithActive(rerender, m, 0);
      expectExactlyOneTabbable(getThumbs(), 0);
      expectExactlyOneTabbable(getDots(), 0);
    }
  );

  // ── Sequência: várias ativações nos extremos não acumulam wrap ─────

  it("pressionar Enter repetidas vezes em dot[last] e dot[0] alternadamente: nunca wrap", () => {
    const total = 5;
    const last = total - 1;
    const m = buildStubState({ variationsCount: total, activeVariation: last });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    // Enter no último (3×) → continua no último
    for (let n = 0; n < 3; n++) {
      const dot = getDots()[last] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);
      rerenderWithActive(rerender, m, last);
      expectExactlyOneTabbable(getDots(), last);
    }

    // Enter no primeiro (3×) → continua no primeiro (sem ir para o último)
    rerenderWithActive(rerender, m, 0);
    for (let n = 0; n < 3; n++) {
      const dot = getDots()[0] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);
      rerenderWithActive(rerender, m, 0);
      expectExactlyOneTabbable(getDots(), 0);
    }

    // Em nenhum momento setActiveVariation foi chamado com índice intermediário fora dos extremos
    const calls = (m.setActiveVariation as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    calls.forEach(([idx]) => {
      expect([0, last]).toContain(idx);
    });
  });
});

// ───────── Tab sai do painel sem ciclar de volta ao primeiro controle ─────────
// WAI-ARIA APG Tabs: roving tabindex faz com que SOMENTE a tab ativa esteja
// no Tab order. Após o último controle alcançável (Avançar quando habilitado,
// caso contrário o thumbnail/dot ativo), Tab deve mover o foco para FORA do
// painel — nunca voltar para o primeiro controle interno.
//
// Usamos um sentinela <button data-testid="after-panel"> renderizado APÓS o
// painel para asserir o "saiu para o próximo elemento focável da página".

describe("MagicUpResultPanel — Tab no fim do painel sai sem ciclar de volta ao primeiro", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderWithSentinels(m: StubState) {
    return render(
      <>
        <button data-testid="before-panel">before</button>
        <MagicUpResultPanel m={m} />
        <button data-testid="after-panel">after</button>
      </>
    );
  }

  /**
   * Coleta TODOS os elementos focáveis da árvore na ordem do DOM,
   * respeitando tabindex (>= 0 entra; -1 fica fora) e disabled.
   * Isto reproduz como o navegador resolve a sequência de Tab.
   */
  function getTabOrder(container: HTMLElement): HTMLElement[] {
    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    // Remove disabled buttons explicitamente (defensive, alguns querySelectors variam)
    return candidates.filter((el) => {
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      const ti = el.getAttribute("tabindex");
      if (ti === "-1") return false;
      return true;
    });
  }

  /** Simula Tab: foca o próximo elemento da ordem atual de Tab. */
  function pressTab(current: HTMLElement, container: HTMLElement) {
    const order = getTabOrder(container);
    const idx = order.indexOf(current);
    expect(idx, "elemento atual deve estar na Tab order").toBeGreaterThanOrEqual(0);
    const next = order[idx + 1] ?? null;
    fireEvent.keyDown(current, { key: "Tab", code: "Tab" });
    if (next) next.focus();
    return next;
  }

  // ── Cenário 1: Tab a partir do ÚLTIMO controle do painel sai para 'after' ─────
  // Pelo DOM do MagicUpResultPanel, o último <button> em ordem é o thumbnail ativo
  // (renderizado após o AdImageResult). O thumbnail ativo é o único do grupo com
  // tabindex=0 (roving), então é o real "fim" do painel no Tab order.

  it("Tab a partir do thumbnail ativo (último controle do painel, active=0) sai para 'after'", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container } = renderWithSentinels(m);

    const activeThumb = getThumbs()[0] as HTMLButtonElement;
    expect(activeThumb.getAttribute("tabindex")).toBe("0");

    activeThumb.focus();
    expect(document.activeElement).toBe(activeThumb);

    const after = pressTab(activeThumb, container);

    // Saiu para o sentinela externo — NÃO voltou para Voltar/dot/thumb inativo
    expect(after).toBe(screen.getByTestId("after-panel"));
    expect(document.activeElement).toBe(screen.getByTestId("after-panel"));

    // Confirma que NÃO ciclou para o primeiro controle (Voltar) nem para
    // qualquer dot/thumb que NÃO seja o ativo
    const prev = screen.getByRole("button", { name: /voltar/i });
    expect(document.activeElement).not.toBe(prev);
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((d, i) => {
      if (i !== m.activeVariation) expect(document.activeElement).not.toBe(d);
    });
    // eslint-disable-next-line no-restricted-syntax
    getThumbs().forEach((t, i) => {
      if (i !== m.activeVariation) expect(document.activeElement).not.toBe(t);
    });
  });

  // ── Cenário 2: Avançar desabilitado (active=last). Último alcançável =
  // o thumbnail ativo (último <button> em Tab order do painel) ─────────

  it("Tab a partir do thumbnail ativo (active=last; Avançar disabled) sai para 'after'", () => {
    const total = 3;
    const last = total - 1;
    const m = buildStubState({ variationsCount: total, activeVariation: last });
    const { container } = renderWithSentinels(m);

    expect(screen.getByRole("button", { name: /avançar/i })).toBeDisabled();

    const activeThumb = getThumbs()[last] as HTMLButtonElement;
    expect(activeThumb.getAttribute("tabindex")).toBe("0");

    activeThumb.focus();
    expect(document.activeElement).toBe(activeThumb);

    const after = pressTab(activeThumb, container);

    expect(after).toBe(screen.getByTestId("after-panel"));
    expect(document.activeElement).toBe(screen.getByTestId("after-panel"));

    // Roving tabindex: nenhum thumbnail/dot inativo entrou na ordem de Tab
    // eslint-disable-next-line no-restricted-syntax
    getThumbs().forEach((t, i) => {
      if (i !== last) expect(document.activeElement).not.toBe(t);
    });
    // eslint-disable-next-line no-restricted-syntax
    getDots().forEach((d, i) => {
      if (i !== last) expect(document.activeElement).not.toBe(d);
    });
  });

  // ── Cenário 3: dot/thumb inativos NÃO aparecem em getTabOrder ───────

  it("Tab order do painel inclui SOMENTE 1 dot e 1 thumb (os ativos) — confirma que Tab não cicla por inativos", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 2 });
    const { container } = renderWithSentinels(m);

    const order = getTabOrder(container);

    const dots = getDots();
    const thumbs = getThumbs();

    const dotsInOrder = dots.filter((d) => order.includes(d));
    const thumbsInOrder = thumbs.filter((t) => order.includes(t));

    expect(dotsInOrder).toHaveLength(1);
    expect(thumbsInOrder).toHaveLength(1);
    expect(dotsInOrder[0]).toBe(dots[2]);
    expect(thumbsInOrder[0]).toBe(thumbs[2]);
  });

  // ── Cenário 4: simular caminho completo Avançar → after, depois Tab
  // novamente do 'after' NÃO retorna ao painel (é o navegador quem decide,
  // mas garantimos que o painel não captura/redireciona) ─────────────

  it("Após sair pelo 'after-panel', o foco continua fluindo para fora — painel não recaptura", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container } = renderWithSentinels(m);

    // Último controle do painel = thumbnail ativo (vem após AdImageResult no DOM)
    const activeThumb = getThumbs()[0] as HTMLButtonElement;
    activeThumb.focus();
    pressTab(activeThumb, container);

    const after = screen.getByTestId("after-panel");
    expect(document.activeElement).toBe(after);

    // Próxima Tab a partir do 'after' não tem para onde ir nesta árvore
    const order = getTabOrder(container);
    const idx = order.indexOf(after);
    expect(order[idx + 1]).toBeUndefined();

    // Foco permanece no 'after' — painel NÃO interceptou de volta para Voltar
    fireEvent.keyDown(after, { key: "Tab", code: "Tab" });
    expect(document.activeElement).toBe(after);
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: /voltar/i }));
  });

  // ── Cenário 5: caminho COMPLETO partindo de 'before' atravessa painel
  // exatamente uma vez e termina em 'after' ─────────────────────────

  it("Caminho completo Tab: before → Voltar → dot ativo → thumb ativo → Avançar → after (sem revisitar)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { container } = renderWithSentinels(m);

    const before = screen.getByTestId("before-panel");
    const after = screen.getByTestId("after-panel");
    const prev = screen.getByRole("button", { name: /voltar/i });
    const next = screen.getByRole("button", { name: /avançar/i });
    const activeDot = getDots()[1];
    const activeThumb = getThumbs()[1];

    const order = getTabOrder(container);

    // Sequência esperada (na ordem do DOM do painel):
    // before, prev, dot[1], next, thumb[1], after
    // (next aparece antes de thumb[1] pois está no header; thumb[1] está abaixo do AdImageResult stub)
    const expectedSubset = [before, prev, activeDot, next, activeThumb, after];
    const observedIndices = expectedSubset.map((el) => order.indexOf(el));

    // Todos presentes
    expect(observedIndices).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    observedIndices.forEach((idx, i) => {
      expect(idx, `${expectedSubset[i].tagName}#${i} ausente da Tab order`).toBeGreaterThanOrEqual(0);
    });

    // Estritamente crescentes (nenhum revisitado / nenhum ciclo)
    for (let i = 1; i < observedIndices.length; i++) {
      expect(observedIndices[i]).toBeGreaterThan(observedIndices[i - 1]);
    }

    // E 'after' é o ÚLTIMO da lista filtrada (nada depois dele)
    expect(order[order.length - 1]).toBe(after);
  });
});

// ───────── Enter/Space no item JÁ ATIVO: foco permanece, sem side effect de estado ─────────
// WAI-ARIA APG Tabs: ativar a tab atualmente selecionada é um no-op visual.
//  • o foco permanece no MESMO controle
//  • activeVariation NÃO muda — toda chamada a setActiveVariation é com o
//    mesmo índice (idempotente), nunca com índice diferente
//  • aria-selected="true" e tabindex="0" continuam no elemento
//  • o grupo paralelo (dots ↔ thumbs) permanece sincronizado, sem oscilar
//  • handlers “terminais” (generate/download/share/winner) não disparam

describe("MagicUpResultPanel — Enter/Space no item ativo: foco e estado preservados", () => {
  beforeEach(() => vi.clearAllMocks());

  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  /** Asserta que toda chamada a setActiveVariation foi com o mesmo índice (idempotente). */
  function expectIdempotentOnly(
    setter: ReturnType<typeof vi.fn>,
    activeIndex: number
  ) {
    const calls = setter.mock.calls;
    expect(calls).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    calls.forEach(([idx], n) => {
      expect(idx, `chamada #${n} deve ser idempotente (=${activeIndex})`).toBe(activeIndex);
    });
  }

  // ── DOTS: Enter no já ativo ─────────────────────────────────────────

  it.each([0, 1, 2])(
    "Enter no dot[%i] JÁ ATIVO: foco permanece, sem mudar activeVariation",
    (activeIdx) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: activeIdx });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[activeIdx] as HTMLButtonElement;
      dot.focus();
      expect(document.activeElement).toBe(dot);
      expect(dot.getAttribute("aria-selected")).toBe("true");
      expect(dot.getAttribute("tabindex")).toBe("0");

      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);

      // FOCO: permanece no MESMO dot
      expect(document.activeElement).toBe(dot);

      // ESTADO: idempotente — re-render não muda o índice ativo
      expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, activeIdx);
      rerenderWithActive(rerender, m, activeIdx);

      const dotAfter = getDots()[activeIdx];
      expect(dotAfter.getAttribute("aria-selected")).toBe("true");
      expect(dotAfter.getAttribute("tabindex")).toBe("0");

      // Outros dots intocados
      // eslint-disable-next-line no-restricted-syntax
      getDots().forEach((d, i) => {
        if (i !== activeIdx) {
          expect(d.getAttribute("aria-selected")).toBe("false");
          expect(d.getAttribute("tabindex")).toBe("-1");
        }
      });
      // Grupo paralelo (thumbs) sincronizado, sem oscilar
      // eslint-disable-next-line no-restricted-syntax
      getThumbs().forEach((t, i) => {
        expect(t.getAttribute("aria-selected")).toBe(i === activeIdx ? "true" : "false");
        expect(t.getAttribute("tabindex")).toBe(i === activeIdx ? "0" : "-1");
      });
    }
  );

  // ── DOTS: Space no já ativo ─────────────────────────────────────────

  it.each([0, 1, 2])(
    "Space no dot[%i] JÁ ATIVO: foco permanece, sem mudar activeVariation",
    (activeIdx) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: activeIdx });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[activeIdx] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: " ", code: "Space" });
      fireEvent.click(dot);

      expect(document.activeElement).toBe(dot);
      expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, activeIdx);
      rerenderWithActive(rerender, m, activeIdx);

      expect(getDots()[activeIdx].getAttribute("aria-selected")).toBe("true");
      expect(getDots()[activeIdx].getAttribute("tabindex")).toBe("0");
    }
  );

  // ── THUMBS: Enter no já ativo ───────────────────────────────────────

  it.each([0, 1, 2])(
    "Enter no thumb[%i] JÁ ATIVO: foco permanece, sem mudar activeVariation",
    (activeIdx) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: activeIdx });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[activeIdx] as HTMLButtonElement;
      thumb.focus();
      expect(document.activeElement).toBe(thumb);
      expect(thumb.getAttribute("aria-selected")).toBe("true");
      expect(thumb.getAttribute("tabindex")).toBe("0");

      fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
      fireEvent.click(thumb);

      expect(document.activeElement).toBe(thumb);
      expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, activeIdx);
      rerenderWithActive(rerender, m, activeIdx);

      const thumbAfter = getThumbs()[activeIdx];
      expect(thumbAfter.getAttribute("aria-selected")).toBe("true");
      expect(thumbAfter.getAttribute("tabindex")).toBe("0");

      // eslint-disable-next-line no-restricted-syntax
      getThumbs().forEach((t, i) => {
        if (i !== activeIdx) {
          expect(t.getAttribute("aria-selected")).toBe("false");
          expect(t.getAttribute("tabindex")).toBe("-1");
        }
      });
      // eslint-disable-next-line no-restricted-syntax
      getDots().forEach((d, i) => {
        expect(d.getAttribute("aria-selected")).toBe(i === activeIdx ? "true" : "false");
      });
    }
  );

  // ── THUMBS: Space no já ativo ───────────────────────────────────────

  it.each([0, 1, 2])(
    "Space no thumb[%i] JÁ ATIVO: foco permanece, sem mudar activeVariation",
    (activeIdx) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: activeIdx });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[activeIdx] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);

      expect(document.activeElement).toBe(thumb);
      expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, activeIdx);
      rerenderWithActive(rerender, m, activeIdx);

      expect(getThumbs()[activeIdx].getAttribute("aria-selected")).toBe("true");
      expect(getThumbs()[activeIdx].getAttribute("tabindex")).toBe("0");
    }
  );

  // ── Pressões repetidas no mesmo item ativo: continua estável ───────

  it("5× Enter no dot ativo: foco preso, todas as chamadas idempotentes (mesmo índice)", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 2 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[2] as HTMLButtonElement;
    dot.focus();

    for (let n = 0; n < 5; n++) {
      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);
      expect(document.activeElement).toBe(dot);
    }

    expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, 2);
    rerenderWithActive(rerender, m, 2);

    expect(getDots()[2].getAttribute("aria-selected")).toBe("true");
    expect(getDots()[2].getAttribute("tabindex")).toBe("0");
  });

  it("5× Space no thumb ativo: foco preso, todas as chamadas idempotentes (mesmo índice)", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb = getThumbs()[1] as HTMLButtonElement;
    thumb.focus();

    for (let n = 0; n < 5; n++) {
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);
      expect(document.activeElement).toBe(thumb);
    }

    expectIdempotentOnly(m.setActiveVariation as ReturnType<typeof vi.fn>, 1);
    rerenderWithActive(rerender, m, 1);

    expect(getThumbs()[1].getAttribute("aria-selected")).toBe("true");
    expect(getThumbs()[1].getAttribute("tabindex")).toBe("0");
  });

  // ── Side-effect cross-handler: handlers "terminais" NÃO disparam ───

  it("Enter no dot ativo: handlers de geração/download/share/winner NÃO são acionados", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[1] as HTMLButtonElement;
    dot.focus();
    fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
    fireEvent.click(dot);

    expect(m.handleGenerate).not.toHaveBeenCalled();
    expect(m.handleDownload).not.toHaveBeenCalled();
    expect(m.handleShare).not.toHaveBeenCalled();
    expect(m.handleSelectWinningVariation).not.toHaveBeenCalled();
    expect(m.handleToggleFavorite).not.toHaveBeenCalled();
    expect(m.handleSelectHistory).not.toHaveBeenCalled();
    expect(m.handleDeleteHistory).not.toHaveBeenCalled();
  });

  it("Space no thumb ativo: handlers de geração/download/share/winner NÃO são acionados", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const thumb = getThumbs()[0] as HTMLButtonElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: " ", code: "Space" });
    fireEvent.click(thumb);

    expect(m.handleGenerate).not.toHaveBeenCalled();
    expect(m.handleDownload).not.toHaveBeenCalled();
    expect(m.handleShare).not.toHaveBeenCalled();
    expect(m.handleSelectWinningVariation).not.toHaveBeenCalled();
    expect(m.handleToggleFavorite).not.toHaveBeenCalled();
    expect(m.handleSelectHistory).not.toHaveBeenCalled();
    expect(m.handleDeleteHistory).not.toHaveBeenCalled();
  });
});

// ───────── Consistência de styling/estado disabled de prev/next nos extremos ─────────
// WCAG 1.4.3 (contraste) + 2.4.7 (focus visible) + 4.1.2 (name, role, value):
// Em ambos os extremos (primeiro e último índice), o botão desabilitado precisa expor:
//  • disabled HTML + aria-disabled coerente (sem mismatch entre DOM e ARIA)
//  • par token-on-token (`disabled:bg-muted` + `disabled:text-muted-foreground` + `disabled:opacity-100`)
//    — NUNCA `disabled:opacity-50` sozinho (cai abaixo de 4.5:1 — ver MAGIC_UP_ONDA5_A11Y.md §2)
//  • bloco completo de focus-visible mantido mesmo quando disabled (pode reabilitar e voltar a focar)
//  • aria-label preservado (descobribilidade por SR mesmo desabilitado)
//  • o botão IRMÃO (oposto) permanece enabled, sem herdar classes disabled e funcionalmente ativo
//  • o conjunto de classes disabled deve ser IDÊNTICO entre prev (no índice 0) e next (no último) —
//    sem divergência de design system entre os dois extremos
describe("MagicUpResultPanel — Onda 5: prev/next disabled styling consistente nos extremos", () => {
  beforeEach(() => vi.clearAllMocks());

  // Conjunto canônico exigido pela guideline Onda 5 a11y para botões de navegação por teclado
  const REQUIRED_DISABLED_CLASSES = [
    "disabled:bg-muted",
    "disabled:text-muted-foreground",
    "disabled:opacity-100",
  ] as const;

  // Bloco completo de focus-visible (deve estar presente independentemente do estado disabled)
  const REQUIRED_FOCUS_VISIBLE_CLASSES = [
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-ring",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
  ] as const;

  // Classe PROIBIDA (cai abaixo de 4.5:1 em botão de navegação)
  const FORBIDDEN_DISABLED_CLASS = "disabled:opacity-50";

  /** Asserta o contrato completo de um botão de navegação desabilitado. */
  function expectDisabledNavContract(btn: HTMLButtonElement, label: string) {
    // 1. Estado HTML
    expect(btn, `${label}: deve estar disabled`).toBeDisabled();
    expect(btn.hasAttribute("disabled"), `${label}: atributo disabled presente`).toBe(true);

    // 2. aria coerente com DOM (sem mismatch)
    const ariaDisabled = btn.getAttribute("aria-disabled");
    if (ariaDisabled !== null) {
      expect(ariaDisabled, `${label}: aria-disabled coerente`).toBe("true");
    }

    // 3. aria-label preservado
    expect(btn.getAttribute("aria-label"), `${label}: aria-label presente`).toBeTruthy();

    // 4. Classes disabled token-on-token presentes
    // eslint-disable-next-line no-restricted-syntax
    REQUIRED_DISABLED_CLASSES.forEach((cls) => {
      expect(btn.className, `${label}: deve conter ${cls}`).toContain(cls);
    });

    // 5. Classe proibida ausente
    expect(btn.className, `${label}: NÃO deve usar ${FORBIDDEN_DISABLED_CLASS}`).not.toContain(
      FORBIDDEN_DISABLED_CLASS
    );

    // 6. Bloco focus-visible mantido (não desaparece quando disabled)
    // eslint-disable-next-line no-restricted-syntax
    REQUIRED_FOCUS_VISIBLE_CLASSES.forEach((cls) => {
      expect(btn.className, `${label}: deve manter ${cls} mesmo desabilitado`).toContain(cls);
    });
  }

  /** Asserta o contrato de um botão de navegação habilitado (irmão oposto). */
  function expectEnabledNavContract(btn: HTMLButtonElement, label: string) {
    expect(btn, `${label}: deve estar enabled`).not.toBeDisabled();
    expect(btn.hasAttribute("disabled"), `${label}: sem atributo disabled`).toBe(false);

    // aria-disabled não pode estar "true" se o botão está habilitado
    const ariaDisabled = btn.getAttribute("aria-disabled");
    if (ariaDisabled !== null) {
      expect(ariaDisabled, `${label}: aria-disabled NÃO pode ser "true"`).not.toBe("true");
    }

    // aria-label preservado
    expect(btn.getAttribute("aria-label"), `${label}: aria-label presente`).toBeTruthy();

    // Bloco focus-visible obrigatório
    // eslint-disable-next-line no-restricted-syntax
    REQUIRED_FOCUS_VISIBLE_CLASSES.forEach((cls) => {
      expect(btn.className, `${label}: deve conter ${cls}`).toContain(cls);
    });
  }

  /** Extrai apenas as classes que comecem com `disabled:` (para comparar entre botões). */
  function disabledClassSet(btn: HTMLButtonElement): Set<string> {
    return new Set(btn.className.split(/\s+/).filter((c) => c.startsWith("disabled:")));
  }

  /** Extrai apenas as classes que comecem com `focus-visible:`. */
  function focusVisibleClassSet(btn: HTMLButtonElement): Set<string> {
    return new Set(btn.className.split(/\s+/).filter((c) => c.startsWith("focus-visible:")));
  }

  // ── PRIMEIRO ÍNDICE: Voltar disabled, Avançar enabled ──────────────

  it("primeiro índice (0): 'Voltar' cumpre contrato disabled completo (HTML + ARIA + tokens)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    expectDisabledNavContract(prev, "prev@idx=0");
  });

  it("primeiro índice (0): 'Avançar' (irmão oposto) permanece enabled e acessível", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    expectEnabledNavContract(next, "next@idx=0");

    // Funcionalmente ativo
    fireEvent.click(next);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  // ── ÚLTIMO ÍNDICE: Avançar disabled, Voltar enabled ───────────────

  it("último índice (n-1): 'Avançar' cumpre contrato disabled completo (HTML + ARIA + tokens)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    expectDisabledNavContract(next, "next@idx=last");
  });

  it("último índice (n-1): 'Voltar' (irmão oposto) permanece enabled e acessível", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    expectEnabledNavContract(prev, "prev@idx=last");

    fireEvent.click(prev);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
  });

  // ── Simetria entre extremos: o styling disabled DEVE ser idêntico ──

  it("simetria de extremos: classes `disabled:*` de Voltar@0 == classes `disabled:*` de Avançar@last", () => {
    const mFirst = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { unmount } = render(<MagicUpResultPanel m={mFirst} />);
    const prevAtFirst = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    const prevDisabledClasses = disabledClassSet(prevAtFirst);
    unmount();

    const mLast = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={mLast} />);
    const nextAtLast = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    const nextDisabledClasses = disabledClassSet(nextAtLast);

    // Conjunto idêntico de classes `disabled:*` — sem divergência de design system entre extremos
    expect(prevDisabledClasses, "Voltar@0 e Avançar@last devem compartilhar exatamente as mesmas classes disabled:*").toEqual(
      nextDisabledClasses
    );
  });

  it("simetria de extremos: classes `focus-visible:*` de Voltar@0 == classes `focus-visible:*` de Avançar@last", () => {
    const mFirst = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { unmount } = render(<MagicUpResultPanel m={mFirst} />);
    const prevAtFirst = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    const prevFV = focusVisibleClassSet(prevAtFirst);
    unmount();

    const mLast = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={mLast} />);
    const nextAtLast = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    const nextFV = focusVisibleClassSet(nextAtLast);

    expect(prevFV, "Voltar e Avançar devem expor o mesmo bloco focus-visible:*").toEqual(nextFV);
  });

  // ── Estabilidade entre estados: classes disabled não dependem do índice ─

  it("classes `disabled:*` de prev@0 são idênticas às classes `disabled:*` de next@last", () => {
    // Coleta classes do prev quando ele está disabled (índice 0)
    const m1 = buildStubState({ variationsCount: 4, activeVariation: 0 });
    const { unmount: u1 } = render(<MagicUpResultPanel m={m1} />);
    const prev0 = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    const prev0Disabled = disabledClassSet(prev0);
    u1();

    // Coleta classes do next quando ele está disabled (último índice)
    const m2 = buildStubState({ variationsCount: 4, activeVariation: 3 });
    render(<MagicUpResultPanel m={m2} />);
    const nextLast = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    const nextLastDisabled = disabledClassSet(nextLast);

    // eslint-disable-next-line no-restricted-syntax
    REQUIRED_DISABLED_CLASSES.forEach((cls) => {
      expect(prev0Disabled.has(cls), `prev@0 contém ${cls}`).toBe(true);
      expect(nextLastDisabled.has(cls), `next@last contém ${cls}`).toBe(true);
    });
    expect(prev0Disabled.has(FORBIDDEN_DISABLED_CLASS), `prev@0 NÃO usa ${FORBIDDEN_DISABLED_CLASS}`).toBe(false);
    expect(nextLastDisabled.has(FORBIDDEN_DISABLED_CLASS), `next@last NÃO usa ${FORBIDDEN_DISABLED_CLASS}`).toBe(false);
  });

  // ── Variação de tamanho de lista: contrato vale para qualquer N ────

  it.each([2, 3, 5, 8])(
    "lista com %i variações: prev disabled em idx=0 cumpre contrato completo",
    (count) => {
      const m = buildStubState({ variationsCount: count, activeVariation: 0 });
      render(<MagicUpResultPanel m={m} />);
      const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
      const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
      expectDisabledNavContract(prev, `prev@idx=0 [N=${count}]`);
      expectEnabledNavContract(next, `next@idx=0 [N=${count}]`);
    }
  );

  it.each([2, 3, 5, 8])(
    "lista com %i variações: next disabled em idx=last cumpre contrato completo",
    (count) => {
      const m = buildStubState({ variationsCount: count, activeVariation: count - 1 });
      render(<MagicUpResultPanel m={m} />);
      const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
      const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
      expectDisabledNavContract(next, `next@idx=last [N=${count}]`);
      expectEnabledNavContract(prev, `prev@idx=last [N=${count}]`);
    }
  );

  // ── Índices intermediários: ambos enabled, nenhum carrega "estado disabled visual" ──

  it.each([1, 2, 3])(
    "índice intermediário (%i de 5): NEM prev NEM next aplicam classes disabled (ambos enabled)",
    (mid) => {
      const m = buildStubState({ variationsCount: 5, activeVariation: mid });
      render(<MagicUpResultPanel m={m} />);
      const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
      const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;

      expectEnabledNavContract(prev, `prev@idx=${mid}`);
      expectEnabledNavContract(next, `next@idx=${mid}`);

      // Mesmo enabled, as classes `disabled:*` ficam declaradas no className (Tailwind)
      // mas NÃO devem se aplicar — o atributo `disabled` está ausente, o que é o gate
      // real do CSS (`button:disabled`). Verificamos que o atributo está ausente:
      expect(prev.hasAttribute("disabled")).toBe(false);
      expect(next.hasAttribute("disabled")).toBe(false);
    }
  );

  // ── Garantia anti-regressão: classe proibida nunca aparece em nenhum extremo ────

  it("nem prev@0 nem next@last contêm a classe proibida `disabled:opacity-50`", () => {
    const m1 = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { unmount } = render(<MagicUpResultPanel m={m1} />);
    const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    expect(prev.className).not.toContain(FORBIDDEN_DISABLED_CLASS);
    unmount();

    const m2 = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m2} />);
    const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    expect(next.className).not.toContain(FORBIDDEN_DISABLED_CLASS);
  });

  // ── Coerência entre disabled HTML e role/label expostos ao SR ────

  it("prev@0 disabled mantém role=button + name='Voltar' descobríveis por SR (não some de Acessibility Tree)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    // getByRole busca na Accessibility Tree; se o nome sumisse, isto lançaria
    const prev = screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    expect(prev).toBeDisabled();
    expect(prev.tagName).toBe("BUTTON");
    expect(prev.getAttribute("aria-label")).toBe("Voltar");
  });

  it("next@last disabled mantém role=button + name='Avançar' descobríveis por SR", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const next = screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement;
    expect(next).toBeDisabled();
    expect(next.tagName).toBe("BUTTON");
    expect(next.getAttribute("aria-label")).toBe("Avançar");
  });
});

// ───────── Próximo destino do Tab após trocar de variação ─────────
// WAI-ARIA APG Tabs (roving tabindex): após trocar a variação ativa, somente
// o NOVO dot/thumb correspondente fica com tabindex="0"; os demais voltam a
// tabindex="-1". Logo, o próximo alvo do Tab a partir de qualquer ponto âncora
// (prev / next / dot ativo / thumb ativo) DEVE refletir o novo índice ativo —
// nunca pular para um dot/thumb antigo nem cair fora do painel quando o Tab
// natural ainda tem candidatos válidos.
//
// Cobertura:
//  • Após click em next/prev (que muda activeVariation), simulamos rerender
//    com novo estado e validamos que getTabOrder() expõe APENAS o novo
//    dot/thumb ativo, e que pressTab a partir do prev cai no novo dot ativo.
//  • Após click em dot[i] não-ativo, o thumb correspondente (i) é o que
//    aparece na sequência de Tab — nunca o thumb anterior.
//  • Após click em thumb[i] não-ativo, o dot correspondente (i) é o que
//    aparece — nunca o dot anterior.
//  • Sequência completa: prev → dot ativo → next → thumb ativo → after-panel,
//    aplicada ANTES e DEPOIS de uma troca, mantém invariantes.

describe("MagicUpResultPanel — Onda 5: próximo Tab target após troca de variação", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderWithSentinels(m: StubState) {
    return render(
      <>
        <button data-testid="before-panel">before</button>
        <MagicUpResultPanel m={m} />
        <button data-testid="after-panel">after</button>
      </>
    );
  }

  function getTabOrder(container: HTMLElement): HTMLElement[] {
    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    return candidates.filter((el) => {
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      const ti = el.getAttribute("tabindex");
      if (ti === "-1") return false;
      return true;
    });
  }

  function pressTab(current: HTMLElement, container: HTMLElement) {
    const order = getTabOrder(container);
    const idx = order.indexOf(current);
    expect(idx, "elemento atual deve estar na Tab order").toBeGreaterThanOrEqual(0);
    const next = order[idx + 1] ?? null;
    fireEvent.keyDown(current, { key: "Tab", code: "Tab" });
    if (next) next.focus();
    return next;
  }

  /** Re-renderiza simulando o novo estado após uma mudança de activeVariation. */
  function rerenderWithActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(
      <>
        <button data-testid="before-panel">before</button>
        <MagicUpResultPanel m={updated} />
        <button data-testid="after-panel">after</button>
      </>
    );
  }

  // ── Após Avançar: novo dot/thumb ativo é o próximo Tab target ──────

  it("Avançar (idx 0 → 1): após troca, somente dot[1] e thumb[1] ficam na Tab order", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = renderWithSentinels(m);

    const next = screen.getByRole("button", { name: "Avançar" });
    fireEvent.click(next);
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);

    rerenderWithActive(rerender, m, 1);

    const order = getTabOrder(container);
    const dots = getDots();
    const thumbs = getThumbs();

    // O dot/thumb ativo agora é o índice 1
    expect(order).toContain(dots[1]);
    expect(order).toContain(thumbs[1]);
    expect(order).not.toContain(dots[0]);
    expect(order).not.toContain(thumbs[0]);
    expect(order).not.toContain(dots[2]);
    expect(order).not.toContain(thumbs[2]);

    // Atributos refletem o novo ativo
    expect(dots[1].getAttribute("tabindex")).toBe("0");
    expect(thumbs[1].getAttribute("tabindex")).toBe("0");
    expect(dots[0].getAttribute("tabindex")).toBe("-1");
    expect(thumbs[0].getAttribute("tabindex")).toBe("-1");
  });

  it("Avançar: a partir de 'Voltar' (re-habilitado), pressTab cai no NOVO dot ativo", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = renderWithSentinels(m);

    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    rerenderWithActive(rerender, m, 1);

    const prev = screen.getByRole("button", { name: "Voltar" });
    expect(prev).not.toBeDisabled();
    prev.focus();
    const after = pressTab(prev, container);

    // Próximo Tab target após prev é o NOVO dot ativo (índice 1)
    expect(after).toBe(getDots()[1]);
    expect(document.activeElement).toBe(getDots()[1]);
  });

  // ── Após Voltar: simétrico ─────────────────────────────────────────

  it("Voltar (idx 2 → 1): após troca, dot[1]/thumb[1] são os únicos na Tab order", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    const { container, rerender } = renderWithSentinels(m);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(m.setActiveVariation).toHaveBeenCalledWith(1);
    rerenderWithActive(rerender, m, 1);

    const order = getTabOrder(container);
    const dots = getDots();
    const thumbs = getThumbs();

    expect(order).toContain(dots[1]);
    expect(order).toContain(thumbs[1]);
    expect(order).not.toContain(dots[2]);
    expect(order).not.toContain(thumbs[2]);
  });

  it("Voltar: a partir de 'Voltar' focado, pressTab vai para o NOVO dot ativo (não o antigo)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    const { container, rerender } = renderWithSentinels(m);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    rerenderWithActive(rerender, m, 1);

    const prev = screen.getByRole("button", { name: "Voltar" });
    prev.focus();
    const after = pressTab(prev, container);

    expect(after).toBe(getDots()[1]);
    expect(after).not.toBe(getDots()[2]);
  });

  // ── Após selecionar dot[i] não-ativo: thumb[i] entra na Tab order ──

  it.each([1, 2])(
    "click em dot[%i] (não-ativo): após troca, thumb[%i] é o único thumb na Tab order",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = renderWithSentinels(m);

      const dot = getDots()[target] as HTMLButtonElement;
      fireEvent.click(dot);
      expect(m.setActiveVariation).toHaveBeenCalledWith(target);
      rerenderWithActive(rerender, m, target);

      const order = getTabOrder(container);
      const thumbs = getThumbs();

      expect(order).toContain(thumbs[target]);
      // eslint-disable-next-line no-restricted-syntax
      thumbs.forEach((t, i) => {
        if (i !== target) expect(order).not.toContain(t);
      });

      // Próximo Tab a partir do novo dot ativo deve cair em "Avançar" (se enabled)
      // ou no novo thumb ativo. Verificamos o salto direto:
      const newDot = getDots()[target];
      newDot.focus();
      const after = pressTab(newDot, container);
      // Após o dot ativo, o próximo focável é "Avançar" (se enabled) ou o thumb ativo
      const candidates = [
        screen.queryByRole("button", { name: "Avançar" }),
        thumbs[target],
      ].filter(Boolean);
      expect(candidates).toContain(after);
    }
  );

  // ── Após selecionar thumb[i] não-ativo: dot[i] entra na Tab order ──

  it.each([1, 2])(
    "click em thumb[%i] (não-ativo): após troca, dot[%i] é o único dot na Tab order",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = renderWithSentinels(m);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      fireEvent.click(thumb);
      expect(m.setActiveVariation).toHaveBeenCalledWith(target);
      rerenderWithActive(rerender, m, target);

      const order = getTabOrder(container);
      const dots = getDots();

      expect(order).toContain(dots[target]);
      // eslint-disable-next-line no-restricted-syntax
      dots.forEach((d, i) => {
        if (i !== target) expect(order).not.toContain(d);
      });
    }
  );

  // ── Sequência canônica preservada após troca ──────────────────────

  it("sequência canônica (prev → dotAtivo → next → thumbAtivo → after) reflete o NOVO índice após Avançar", () => {
    const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
    const { container, rerender } = renderWithSentinels(m);

    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    rerenderWithActive(rerender, m, 1);

    const before = screen.getByTestId("before-panel");
    before.focus();

    const stops: HTMLElement[] = [before];
    let cur: HTMLElement | null = before;
    for (let i = 0; i < 6 && cur; i++) {
      const nx = pressTab(cur, container);
      if (!nx) break;
      stops.push(nx);
      cur = nx;
      if (nx.dataset.testid === "after-panel") break;
    }

    // Deve passar pelo NOVO dot ativo (índice 1), não pelo antigo (0)
    expect(stops).toContain(getDots()[1]);
    expect(stops).toContain(getThumbs()[1]);
    expect(stops).not.toContain(getDots()[0]);
    expect(stops).not.toContain(getThumbs()[0]);

    // Deve eventualmente sair pelo after-panel
    expect(stops[stops.length - 1]).toBe(screen.getByTestId("after-panel"));
  });

  // ── Trocas múltiplas em sequência: Tab order acompanha a cada troca ─

  it("trocas sucessivas (0 → 1 → 2): Tab order rastreia o índice atual a cada passo", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = renderWithSentinels(m);

    // Estado inicial: dot[0] e thumb[0] na Tab order
    let order = getTabOrder(container);
    expect(order).toContain(getDots()[0]);
    expect(order).toContain(getThumbs()[0]);

    // Troca 0 → 1
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    rerenderWithActive(rerender, m, 1);
    order = getTabOrder(container);
    expect(order).toContain(getDots()[1]);
    expect(order).toContain(getThumbs()[1]);
    expect(order).not.toContain(getDots()[0]);

    // Troca 1 → 2
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
    rerenderWithActive(rerender, m, 2);
    order = getTabOrder(container);
    expect(order).toContain(getDots()[2]);
    expect(order).toContain(getThumbs()[2]);
    expect(order).not.toContain(getDots()[1]);
    expect(order).not.toContain(getThumbs()[1]);
  });

  // ── Roving tabindex: nunca há mais de UM dot/thumb com tabindex=0 após troca ─

  it.each([0, 1, 2, 3])(
    "após troca para idx=%i: exatamente UM dot e UM thumb com tabindex=\"0\"",
    (target) => {
      const m = buildStubState({ variationsCount: 4, activeVariation: 0 });
      const { rerender } = renderWithSentinels(m);
      rerenderWithActive(rerender, m, target);

      const dotsZero = getDots().filter((d) => d.getAttribute("tabindex") === "0");
      const thumbsZero = getThumbs().filter((t) => t.getAttribute("tabindex") === "0");

      expect(dotsZero).toHaveLength(1);
      expect(thumbsZero).toHaveLength(1);
      expect(dotsZero[0]).toBe(getDots()[target]);
      expect(thumbsZero[0]).toBe(getThumbs()[target]);
    }
  );
});

// ───────── Foco NUNCA migra entre controles paralelos (dot ↔ thumb) ─────────
// WAI-ARIA APG Tabs: dots e thumbs formam dois tablists PARALELOS sincronizados
// por estado (`activeVariation`) — mas independentes em FOCO. Ativar um dot
// jamais pode mover o foco para o thumb correspondente (e vice-versa), mesmo
// que ambos compartilhem `aria-selected="true"` após o re-render.
//
// Esta suíte trava regressões onde:
//  • um efeito (ex.: `useEffect(() => thumbRef.current?.focus())`) sequestraria
//    o foco do dot para o thumb sincronizado
//  • foco "saltaria" para o controle paralelo após re-render
//  • foco se perderia para `<body>` quando o nó é recriado pelo React

describe("MagicUpResultPanel — Onda 5: foco NUNCA migra entre dot ↔ thumb", () => {
  beforeEach(() => vi.clearAllMocks());

  function rerenderActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  // ── Click em dot[i]: foco fica no DOT, NÃO migra para thumb[i] ─────

  it.each([0, 1, 2])(
    "click em dot[%i]: após re-render, foco no DOT — nunca no thumb correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      const dotAfter = getDots()[target];
      const thumbAfter = getThumbs()[target];
      expect(document.activeElement).toBe(dotAfter);
      expect(document.activeElement).not.toBe(thumbAfter);
      // Nem migrou para QUALQUER thumb
      // eslint-disable-next-line no-restricted-syntax
      getThumbs().forEach((t, i) => {
        expect(document.activeElement, `não pode estar no thumb[${i}]`).not.toBe(t);
      });
    }
  );

  it.each([0, 1, 2])(
    "Enter em dot[%i]: foco no DOT — nunca no thumb correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      expect(document.activeElement).toBe(getDots()[target]);
      // eslint-disable-next-line no-restricted-syntax
      getThumbs().forEach((t, i) => {
        expect(document.activeElement, `Enter no dot não pode focar thumb[${i}]`).not.toBe(t);
      });
    }
  );

  it.each([0, 1, 2])(
    "Space em dot[%i]: foco no DOT — nunca no thumb correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: " ", code: "Space" });
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      expect(document.activeElement).toBe(getDots()[target]);
      // eslint-disable-next-line no-restricted-syntax
      getThumbs().forEach((t, i) => {
        expect(document.activeElement, `Space no dot não pode focar thumb[${i}]`).not.toBe(t);
      });
    }
  );

  // ── Click em thumb[i]: foco fica no THUMB, NÃO migra para dot[i] ───

  it.each([0, 1, 2])(
    "click em thumb[%i]: após re-render, foco no THUMB — nunca no dot correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      const thumbAfter = getThumbs()[target];
      expect(document.activeElement).toBe(thumbAfter);
      // eslint-disable-next-line no-restricted-syntax
      getDots().forEach((d, i) => {
        expect(document.activeElement, `click no thumb não pode focar dot[${i}]`).not.toBe(d);
      });
    }
  );

  it.each([0, 1, 2])(
    "Enter em thumb[%i]: foco no THUMB — nunca no dot correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      expect(document.activeElement).toBe(getThumbs()[target]);
      // eslint-disable-next-line no-restricted-syntax
      getDots().forEach((d, i) => {
        expect(document.activeElement, `Enter no thumb não pode focar dot[${i}]`).not.toBe(d);
      });
    }
  );

  it.each([0, 1, 2])(
    "Space em thumb[%i]: foco no THUMB — nunca no dot correspondente",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      expect(document.activeElement).toBe(getThumbs()[target]);
      // eslint-disable-next-line no-restricted-syntax
      getDots().forEach((d, i) => {
        expect(document.activeElement, `Space no thumb não pode focar dot[${i}]`).not.toBe(d);
      });
    }
  );

  // ── Foco NÃO se perde para <body> após re-render ──────────────────

  it("após click em dot[2]: document.activeElement nunca cai em <body> (foco preservado)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[2] as HTMLButtonElement;
    dot.focus();
    fireEvent.click(dot);
    rerenderActive(rerender, m, 2);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });

  it("após Enter em thumb[1]: document.activeElement nunca cai em <body>", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb = getThumbs()[1] as HTMLButtonElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
    fireEvent.click(thumb);
    rerenderActive(rerender, m, 1);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });

  // ── Trocas alternadas dot ↔ thumb: foco migra apenas conforme o controle acionado ─

  it("alternar dot[1] → thumb[2] → dot[0]: foco acompanha SEMPRE o último controle acionado", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    // Passo 1: dot[1]
    let dot = getDots()[1] as HTMLButtonElement;
    dot.focus();
    fireEvent.click(dot);
    rerenderActive(rerender, m, 1);
    expect(document.activeElement).toBe(getDots()[1]);
    expect(document.activeElement).not.toBe(getThumbs()[1]);

    // Passo 2: thumb[2]
    let thumb = getThumbs()[2] as HTMLButtonElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
    fireEvent.click(thumb);
    rerenderActive(rerender, m, 2);
    expect(document.activeElement).toBe(getThumbs()[2]);
    expect(document.activeElement).not.toBe(getDots()[2]);

    // Passo 3: dot[0]
    dot = getDots()[0] as HTMLButtonElement;
    dot.focus();
    fireEvent.keyDown(dot, { key: " ", code: "Space" });
    fireEvent.click(dot);
    rerenderActive(rerender, m, 0);
    expect(document.activeElement).toBe(getDots()[0]);
    expect(document.activeElement).not.toBe(getThumbs()[0]);
  });

  // ── Pressões repetidas no mesmo controle não "vazam" para o paralelo ─

  it("3× click em dot[1] (mesmo dot): foco preso no dot, nunca no thumb[1]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    for (let n = 0; n < 3; n++) {
      const dot = getDots()[1] as HTMLButtonElement;
      dot.focus();
      fireEvent.click(dot);
      rerenderActive(rerender, m, 1);
      expect(document.activeElement).toBe(getDots()[1]);
      expect(document.activeElement).not.toBe(getThumbs()[1]);
    }
  });

  it("3× Space em thumb[2] (mesmo thumb): foco preso no thumb, nunca no dot[2]", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    for (let n = 0; n < 3; n++) {
      const thumb = getThumbs()[2] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, 2);
      expect(document.activeElement).toBe(getThumbs()[2]);
      expect(document.activeElement).not.toBe(getDots()[2]);
    }
  });

  // ── Asserção estrutural: o controle focado pertence ao tablist correto ─

  it("foco em dot acionado: elemento ativo está dentro do tablist DOTS, não THUMBS", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[2] as HTMLButtonElement;
    dot.focus();
    fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
    fireEvent.click(dot);
    rerenderActive(rerender, m, 2);

    const dotsTablist = getDotsTablist();
    const thumbsTablist = getThumbsTablist();
    expect(dotsTablist.contains(document.activeElement as Node)).toBe(true);
    expect(thumbsTablist.contains(document.activeElement as Node)).toBe(false);
  });

  it("foco em thumb acionado: elemento ativo está dentro do tablist THUMBS, não DOTS", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb = getThumbs()[1] as HTMLButtonElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: " ", code: "Space" });
    fireEvent.click(thumb);
    rerenderActive(rerender, m, 1);

    const dotsTablist = getDotsTablist();
    const thumbsTablist = getThumbsTablist();
    expect(thumbsTablist.contains(document.activeElement as Node)).toBe(true);
    expect(dotsTablist.contains(document.activeElement as Node)).toBe(false);
  });
});

// ───────── Foco NUNCA salta para headings/regions/UI vizinha ─────────
// Quando activeVariation muda via dot ou thumbnail, o foco deve permanecer
// EXATAMENTE no controle acionado. Esta suíte trava regressões onde:
//  • um `useEffect` com `headingRef.current?.focus()` sequestraria o foco
//  • `aria-live="polite"` mal configurado moveria o foco para o anúncio
//  • re-render do <h2>/<h3>/<section> "roubaria" o foco via autoFocus
//  • elementos com tabIndex={-1} ganhariam foco programático indevido

describe("MagicUpResultPanel — Onda 5: foco NUNCA salta para headings/regions vizinhas", () => {
  beforeEach(() => vi.clearAllMocks());

  function rerenderActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  // Lista exaustiva de seletores de elementos "perigosos" — qualquer um
  // ganhar foco após troca de variação é regressão.
  function getNonControlFocusables(container: HTMLElement): HTMLElement[] {
    const selectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "[role='heading']",
      "[role='region']",
      "[role='status']",
      "[role='alert']",
      "[role='log']",
      "[aria-live]",
      "section",
      "article",
      "header",
      "footer",
      "main",
      "aside",
      "nav",
      "[role='navigation']",
      "[role='complementary']",
      "[role='contentinfo']",
      "[role='banner']",
      "[role='main']",
    ];
    return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(",")));
  }

  // ── Click em dot: foco não pula para nenhum heading/region ─────────

  it.each([0, 1, 2])(
    "click em dot[%i]: foco NÃO está em nenhum heading, region, status, alert ou landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      const dangerZones = getNonControlFocusables(container);
      expect(dangerZones).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      dangerZones.forEach((el) => {
        expect(
          document.activeElement,
          `foco vazou para <${el.tagName.toLowerCase()}${el.getAttribute("role") ? ` role="${el.getAttribute("role")}"` : ""}>`
        ).not.toBe(el);
      });
      // E confirma que ESTÁ no dot acionado
      expect(document.activeElement).toBe(getDots()[target]);
    }
  );

  it.each([0, 1, 2])(
    "Enter em dot[%i]: foco NÃO está em heading/region/landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: "Enter", code: "Enter" });
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getDots()[target]);
    }
  );

  it.each([0, 1, 2])(
    "Space em dot[%i]: foco NÃO está em heading/region/landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.keyDown(dot, { key: " ", code: "Space" });
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getDots()[target]);
    }
  );

  // ── Mesmas garantias acionando via thumbnail ──────────────────────

  it.each([0, 1, 2])(
    "click em thumb[%i]: foco NÃO está em heading/region/landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getThumbs()[target]);
    }
  );

  it.each([0, 1, 2])(
    "Enter em thumb[%i]: foco NÃO está em heading/region/landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getThumbs()[target]);
    }
  );

  it.each([0, 1, 2])(
    "Space em thumb[%i]: foco NÃO está em heading/region/landmark",
    (target) => {
      const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
      const { container, rerender } = render(<MagicUpResultPanel m={m} />);

      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getThumbs()[target]);
    }
  );

  // ── Asserções estruturais reforçadas ──────────────────────────────

  it("após troca via dot: activeElement é <button> com role='tab' (jamais heading/section/region)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[2] as HTMLButtonElement;
    dot.focus();
    fireEvent.click(dot);
    rerenderActive(rerender, m, 2);

    const active = document.activeElement as HTMLElement;
    expect(active.tagName).toBe("BUTTON");
    expect(active.getAttribute("role")).toBe("tab");
    // Nunca um heading
    expect(active.tagName).not.toMatch(/^H[1-6]$/);
    // Nunca um landmark
    expect(["SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE", "NAV"]).not.toContain(active.tagName);
  });

  it("após troca via thumb: activeElement é <button> com role='tab' (jamais heading/section/region)", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb = getThumbs()[1] as HTMLButtonElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "Enter", code: "Enter" });
    fireEvent.click(thumb);
    rerenderActive(rerender, m, 1);

    const active = document.activeElement as HTMLElement;
    expect(active.tagName).toBe("BUTTON");
    expect(active.getAttribute("role")).toBe("tab");
    expect(active.tagName).not.toMatch(/^H[1-6]$/);
    expect(["SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE", "NAV"]).not.toContain(active.tagName);
  });

  // ── Trocas múltiplas: foco nunca "escorrega" para vizinhança ──────

  it("3 trocas consecutivas via dots: foco NUNCA passou por heading/region em nenhuma iteração", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = render(<MagicUpResultPanel m={m} />);

    // eslint-disable-next-line no-restricted-syntax
    [1, 2, 0].forEach((target) => {
      const dot = getDots()[target] as HTMLButtonElement;
      dot.focus();
      fireEvent.click(dot);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getDots()[target]);
    });
  });

  it("3 trocas consecutivas via thumbs: foco NUNCA passou por heading/region em nenhuma iteração", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = render(<MagicUpResultPanel m={m} />);

    // eslint-disable-next-line no-restricted-syntax
    [2, 0, 1].forEach((target) => {
      const thumb = getThumbs()[target] as HTMLButtonElement;
      thumb.focus();
      fireEvent.keyDown(thumb, { key: " ", code: "Space" });
      fireEvent.click(thumb);
      rerenderActive(rerender, m, target);

      // eslint-disable-next-line no-restricted-syntax
      getNonControlFocusables(container).forEach((el) => {
        expect(document.activeElement).not.toBe(el);
      });
      expect(document.activeElement).toBe(getThumbs()[target]);
    });
  });

  // ── aria-live regions existem mas NUNCA recebem foco ──────────────

  it("regiões aria-live (se existirem) NUNCA recebem foco após troca via dot", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { container, rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[1] as HTMLButtonElement;
    dot.focus();
    fireEvent.click(dot);
    rerenderActive(rerender, m, 1);

    const liveRegions = container.querySelectorAll<HTMLElement>("[aria-live], [role='status'], [role='alert'], [role='log']");
    expect(liveRegions).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    liveRegions.forEach((region) => {
      expect(document.activeElement).not.toBe(region);
      expect(region.contains(document.activeElement as Node) && document.activeElement !== getDots()[1]).toBe(false);
    });
  });
});

// ───────── Roving tabindex EXCLUSIVO após navegação por SETAS ─────────
// APG Tabs (single tab stop): após qualquer ArrowLeft/Right/Up/Down/Home/End,
// EXATAMENTE 1 dot e 1 thumb devem ter tabindex="0" (o novo ativo). Todos
// os demais devem migrar para tabindex="-1". Esta suíte trava regressões
// onde o tabindex antigo permaneceria em "0" ou o novo não se atualizaria.
describe("MagicUpResultPanel — Onda 5: roving tabindex EXCLUSIVO após navegação por setas", () => {
  beforeEach(() => vi.clearAllMocks());

  function rerenderActive(
    rerender: (ui: React.ReactElement) => void,
    m: StubState,
    newActive: number
  ) {
    const updated = {
      ...m,
      activeVariation: newActive,
      currentVariation: m.variations[newActive],
    } as StubState;
    rerender(<MagicUpResultPanel m={updated} />);
  }

  function assertExclusiveZero(elements: HTMLElement[], expectedZeroIdx: number, label: string) {
    const zeros = elements.filter((el) => el.getAttribute("tabindex") === "0");
    const minus = elements.filter((el) => el.getAttribute("tabindex") === "-1");
    expect(zeros.length, `${label}: deve haver EXATAMENTE 1 tabindex=0`).toBe(1);
    expect(elements[expectedZeroIdx].getAttribute("tabindex"), `${label}: índice ${expectedZeroIdx} deve ter tabindex=0`).toBe("0");
    expect(minus.length, `${label}: demais devem ter tabindex=-1`).toBe(elements.length - 1);
    // eslint-disable-next-line no-restricted-syntax
    elements.forEach((el, i) => {
      const v = el.getAttribute("tabindex");
      expect(v, `${label}[${i}]: tabindex deve ser "0" ou "-1"`).toMatch(/^(0|-1)$/);
    });
  }

  it("ArrowRight em dot[0] (active=0) → após re-render, somente dot[1] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot0 = getDots()[0] as HTMLButtonElement;
    dot0.focus();
    fireEvent.keyDown(dot0, { key: "ArrowRight" });
    rerenderActive(rerender, m, 1);

    assertExclusiveZero(getDots(), 1, "dots após ArrowRight");
    assertExclusiveZero(getThumbs(), 1, "thumbs após ArrowRight (sincronizado)");
  });

  it("ArrowRight em dot[1] (active=1) → após re-render, somente dot[2] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot1 = getDots()[1] as HTMLButtonElement;
    dot1.focus();
    fireEvent.keyDown(dot1, { key: "ArrowRight" });
    rerenderActive(rerender, m, 2);

    assertExclusiveZero(getDots(), 2, "dots após ArrowRight");
    assertExclusiveZero(getThumbs(), 2, "thumbs após ArrowRight");
  });

  it("ArrowLeft em dot[2] (active=2) → após re-render, somente dot[1] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot2 = getDots()[2] as HTMLButtonElement;
    dot2.focus();
    fireEvent.keyDown(dot2, { key: "ArrowLeft" });
    rerenderActive(rerender, m, 1);

    assertExclusiveZero(getDots(), 1, "dots após ArrowLeft");
    assertExclusiveZero(getThumbs(), 1, "thumbs após ArrowLeft");
  });

  it("ArrowDown em dot[1] → após re-render, somente dot[2] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot1 = getDots()[1] as HTMLButtonElement;
    dot1.focus();
    fireEvent.keyDown(dot1, { key: "ArrowDown" });
    rerenderActive(rerender, m, 2);

    assertExclusiveZero(getDots(), 2, "dots após ArrowDown");
  });

  it("ArrowUp em dot[1] → após re-render, somente dot[0] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 1 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot1 = getDots()[1] as HTMLButtonElement;
    dot1.focus();
    fireEvent.keyDown(dot1, { key: "ArrowUp" });
    rerenderActive(rerender, m, 0);

    assertExclusiveZero(getDots(), 0, "dots após ArrowUp");
  });

  it("End em dot[0] → após re-render, somente dot[last] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 5, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot0 = getDots()[0] as HTMLButtonElement;
    dot0.focus();
    fireEvent.keyDown(dot0, { key: "End" });
    rerenderActive(rerender, m, 4);

    assertExclusiveZero(getDots(), 4, "dots após End");
    assertExclusiveZero(getThumbs(), 4, "thumbs após End");
  });

  it("Home em dot[last] → após re-render, somente dot[0] tem tabindex=0", () => {
    const m = buildStubState({ variationsCount: 5, activeVariation: 4 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dotLast = getDots()[4] as HTMLButtonElement;
    dotLast.focus();
    fireEvent.keyDown(dotLast, { key: "Home" });
    rerenderActive(rerender, m, 0);

    assertExclusiveZero(getDots(), 0, "dots após Home");
    assertExclusiveZero(getThumbs(), 0, "thumbs após Home");
  });

  // Não-wrap nos extremos: tabindex INALTERADO (sem re-render pois sem state change)
  it("ArrowRight em dot[last] (não-wrap): tabindex permanece exclusivo no last", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    render(<MagicUpResultPanel m={m} />);

    const dotLast = getDots()[2] as HTMLButtonElement;
    dotLast.focus();
    fireEvent.keyDown(dotLast, { key: "ArrowRight" });

    assertExclusiveZero(getDots(), 2, "dots após ArrowRight no extremo (não-wrap)");
    assertExclusiveZero(getThumbs(), 2, "thumbs após ArrowRight no extremo (não-wrap)");
  });

  it("ArrowLeft em dot[0] (não-wrap): tabindex permanece exclusivo no 0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    render(<MagicUpResultPanel m={m} />);

    const dot0 = getDots()[0] as HTMLButtonElement;
    dot0.focus();
    fireEvent.keyDown(dot0, { key: "ArrowLeft" });

    assertExclusiveZero(getDots(), 0, "dots após ArrowLeft no extremo (não-wrap)");
    assertExclusiveZero(getThumbs(), 0, "thumbs após ArrowLeft no extremo (não-wrap)");
  });

  it("ArrowRight em thumb[0] → após re-render, thumb[1] e dot[1] têm tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb0 = getThumbs()[0] as HTMLButtonElement;
    thumb0.focus();
    fireEvent.keyDown(thumb0, { key: "ArrowRight" });
    rerenderActive(rerender, m, 1);

    assertExclusiveZero(getThumbs(), 1, "thumbs após ArrowRight em thumb");
    assertExclusiveZero(getDots(), 1, "dots espelham thumb");
  });

  it("ArrowLeft em thumb[2] → após re-render, thumb[1] e dot[1] têm tabindex=0", () => {
    const m = buildStubState({ variationsCount: 3, activeVariation: 2 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const thumb2 = getThumbs()[2] as HTMLButtonElement;
    thumb2.focus();
    fireEvent.keyDown(thumb2, { key: "ArrowLeft" });
    rerenderActive(rerender, m, 1);

    assertExclusiveZero(getThumbs(), 1, "thumbs após ArrowLeft em thumb");
    assertExclusiveZero(getDots(), 1, "dots espelham thumb");
  });

  it("sequência ArrowRight × 2 → ArrowLeft → Home: tabindex sempre exclusivo no índice correto", () => {
    const m = buildStubState({ variationsCount: 5, activeVariation: 0 });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const sequence: { key: string; expectedNew: number }[] = [
      { key: "ArrowRight", expectedNew: 1 },
      { key: "ArrowRight", expectedNew: 2 },
      { key: "ArrowLeft", expectedNew: 1 },
      { key: "Home", expectedNew: 0 },
    ];

    sequence.forEach(({ key, expectedNew }, step) => {
      const currentDots = getDots();
      const currentActive = currentDots.findIndex((d) => d.getAttribute("tabindex") === "0");
      currentDots[currentActive].focus();
      fireEvent.keyDown(currentDots[currentActive], { key });
      rerenderActive(rerender, m, expectedNew);

      assertExclusiveZero(getDots(), expectedNew, `step ${step + 1} (${key})`);
      assertExclusiveZero(getThumbs(), expectedNew, `step ${step + 1} thumbs (${key})`);
    });
  });

  it.each([
    { from: 0, key: "ArrowRight", to: 1 },
    { from: 1, key: "ArrowRight", to: 2 },
    { from: 2, key: "ArrowRight", to: 3 },
    { from: 3, key: "ArrowRight", to: 4 },
    { from: 4, key: "ArrowLeft", to: 3 },
    { from: 3, key: "ArrowLeft", to: 2 },
    { from: 2, key: "ArrowLeft", to: 1 },
    { from: 1, key: "ArrowLeft", to: 0 },
  ])("N=5: $key em dot[$from] → tabindex=0 exclusivo migra para dot[$to]", ({ from, key, to }) => {
    const m = buildStubState({ variationsCount: 5, activeVariation: from });
    const { rerender } = render(<MagicUpResultPanel m={m} />);

    const dot = getDots()[from] as HTMLButtonElement;
    dot.focus();
    fireEvent.keyDown(dot, { key });
    rerenderActive(rerender, m, to);

    assertExclusiveZero(getDots(), to, `N=5 dots ${key}`);
    assertExclusiveZero(getThumbs(), to, `N=5 thumbs ${key}`);
  });
});
