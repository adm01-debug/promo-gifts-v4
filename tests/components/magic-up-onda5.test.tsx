import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MagicUpQualityScore } from "@/components/magic-up/MagicUpQualityScore";
import { MagicUpQualityChecklist } from "@/components/magic-up/MagicUpQualityChecklist";
import { MagicUpCurationStatus } from "@/components/magic-up/MagicUpCurationStatus";
import { MagicUpVariationComparator } from "@/components/magic-up/MagicUpVariationComparator";
import type { VariationItem } from "@/hooks/useMagicUpState";
import type { MagicUpQualityDiagnosis } from "@/pages/magic-up/magicUpStrategy";

const diagnosis = (total: number, source: "ai" | "heuristic" = "ai"): MagicUpQualityDiagnosis => ({
  total,
  label: total >= 88 ? "Excelente para envio" : total >= 75 ? "Boa peça comercial" : "Precisa revisão",
  summary: "Resumo executivo da avaliação comercial.",
  source,
  strengths: ["Produto claro"],
  risks: total < 75 ? ["Logo disponível"] : [],
  recommendations: total < 75 ? ["Melhorar logo disponível."] : [],
  criteria: [
    { id: "produto-claro", label: "Produto claro", score: 94, passed: true, weight: 5, recommendation: "Critério pronto para envio comercial." },
    { id: "logo-disponivel", label: "Logo disponível", score: total < 75 ? 58 : 91, passed: total >= 75, weight: 5, recommendation: total < 75 ? "Revise este ponto antes de enviar ao cliente." : "Critério pronto para envio comercial." },
    { id: "canal-definido", label: "Canal definido", score: 88, passed: true, weight: 3, recommendation: "Critério pronto para envio comercial." },
    { id: "cliente-contextualizado", label: "Cliente contextualizado", score: 86, passed: true, weight: 3, recommendation: "Critério pronto para envio comercial." },
  ],
});

// ───────── Helpers de teste ─────────

/** Fixture padrão: 3 variações com scores [90, 70, 50] — cobre maioria dos testes de comparator/keyboard/focus */
function buildVariations(overrides: Partial<VariationItem>[] = []): VariationItem[] {
  const base: VariationItem[] = [
    { id: "v1", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 90 },
    { id: "v2", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 70 },
    { id: "v3", imageUrl: "https://example.com/c.png", isFavorite: false, qualityScore: 50 },
  ];
  return base.map((v, i) => ({ ...v, ...(overrides[i] ?? {}) }));
}

/** Render do comparador com defaults vi.fn() para handlers; retorna spies + utilitários */
function renderComparator(props: {
  variations?: VariationItem[];
  activeIndex?: number;
  onSelect?: (i: number) => void;
  onSelectWinner?: (i: number) => void;
} = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  const onSelectWinner = props.onSelectWinner ?? vi.fn();
  const utils = render(
    <MagicUpVariationComparator
      variations={props.variations ?? buildVariations()}
      activeIndex={props.activeIndex ?? 0}
      onSelect={onSelect}
      onSelectWinner={onSelectWinner}
    />
  );
  return { ...utils, onSelect, onSelectWinner, user: userEvent.setup() };
}

// ───────── Helpers de focus-visible / focus ring (WCAG 2.4.7) ─────────

/** Classes obrigatórias do bloco padrão de focus-visible (guideline `docs/MAGIC_UP_ONDA5_A11Y.md` §1). */
const FOCUS_VISIBLE_BASE_CLASSES = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
] as const;

/** Bloco completo: base + offset (cards/dots/thumbnails sobre background). */
const FOCUS_VISIBLE_FULL_CLASSES = [
  ...FOCUS_VISIBLE_BASE_CLASSES,
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
] as const;

/** Regex que casa `focus:ring-*` SEM o prefixo `-visible:` — proibido pelo guideline. */
const FORBIDDEN_FOCUS_RING_RE = /(?<!focus-visible:)focus:ring-/;

/** Asserção fundamental: elemento aplica o bloco de focus-visible esperado. */
function expectFocusVisible(el: HTMLElement, level: "base" | "full" = "base"): void {
  const required = level === "full" ? FOCUS_VISIBLE_FULL_CLASSES : FOCUS_VISIBLE_BASE_CLASSES;
  // eslint-disable-next-line no-restricted-syntax
  required.forEach((cls) => {
    expect(el.className).toContain(cls);
  });
  expect(el.className).not.toMatch(FORBIDDEN_FOCUS_RING_RE);
}

/** Valida focus-visible em todos os cards de variação. */
function expectAllCardsFocusVisible(level: "base" | "full" = "base"): void {
  const cards = select.allCards();
  expect(cards.length).toBeGreaterThan(0);
  cards.forEach((c) => expectFocusVisible(c, level));
}

/** Valida focus-visible em todos os botões "Marcar vencedora". */
function expectAllWinnerButtonsFocusVisible(level: "base" | "full" = "base"): void {
  const btns = select.allMarcar();
  expect(btns.length).toBeGreaterThan(0);
  btns.forEach((b) => expectFocusVisible(b, level));
}

/** Valida que o elemento focado não é body e tem focus-visible. */
function expectActiveElementFocusVisible(level: "base" | "full" = "base"): HTMLElement {
  const active = document.activeElement as HTMLElement | null;
  expect(active).not.toBeNull();
  expect(active).not.toBe(document.body);
  expectFocusVisible(active!, level);
  return active!;
}

// ───────── Builders centralizados de aria-label ─────────
// Fonte única de verdade: qualquer mudança no formato do aria-label do componente
// é refletida aqui e propaga para todos os asserts do arquivo.

/** Monta o aria-label exato de um card de variação. */
function variationCardLabel(n: number, opts: { score?: number; best?: boolean } = {}): string {
  const parts = [`Selecionar variação ${n}`];
  if (opts.score !== undefined) parts.push(`score ${opts.score}`);
  if (opts.best) parts.push("melhor score");
  return parts.join(", ");
}

/** Monta o aria-label exato do botão "marcar como vencedora". */
function winnerButtonLabel(n: number): string {
  return `Marcar variação ${n} como vencedora`;
}

/** Regex reutilizáveis (sem string literal duplicada) para name matchers. */
const labelPatterns = {
  anyCard: /^Selecionar variação \d+/,
  anyWinner: /^Marcar variação \d+ como vencedora$/,
  cardN: (n: number) => new RegExp(`^Selecionar variação ${n}(,|$)`),
  cardNWithBest: (n: number) => new RegExp(`^Selecionar variação ${n}.*melhor score`, "i"),
  /** Padrões tolerantes a alterações futuras de pontuação/sufixos no aria-label. */
  cardNFuzzy: (n: number) => new RegExp(`Selecionar.*varia[cç][aã]o\\s*${n}\\b`, "i"),
  winnerNFuzzy: (n: number) => new RegExp(`Marcar.*varia[cç][aã]o\\s*${n}\\b.*vencedor`, "i"),
};

/** TestIds estáveis expostos pelo componente (resilientes a mudanças de copy/ARIA). */
const testIds = {
  comparator: "magic-up-variation-comparator",
  list: "variation-list",
  card: (n: number) => `variation-card-${n}`,
  item: (n: number) => `variation-item-${n}`,
  winnerButton: (n: number) => `variation-winner-button-${n}`,
};

/**
 * Seletores estáveis para elementos do comparador.
 * Estratégia: helpers `*ByTid` preferem `data-testid` (independem de strings ARIA);
 * helpers legacy permanecem para asserts dedicados a acessibilidade. Mudanças em
 * aria-label só quebram os testes que validam acessibilidade — os demais testes
 * usam testid e continuam estáveis.
 */
const select = {
  card: (n: number) => screen.getByRole("button", { name: labelPatterns.cardN(n) }),
  cardExact: (name: string) => screen.getByRole("button", { name }),
  /** Atalho tipado: `select.cardByScore(2, 80)` ou `select.cardByScore(1, 90, { best: true })`. */
  cardByScore: (n: number, score: number, opts: { best?: boolean } = {}) =>
    screen.getByRole("button", { name: variationCardLabel(n, { score, best: opts.best }) }),
  marcar: (n: number) => screen.getByRole("button", { name: winnerButtonLabel(n) }),
  allCards: () => screen.getAllByRole("button", { name: labelPatterns.anyCard }),
  allMarcar: () => screen.getAllByRole("button", { name: labelPatterns.anyWinner }),
  /** Query (não throw) para asserções de ausência de "melhor score" em um card. */
  queryCardWithBest: (n: number) =>
    screen.queryByRole("button", { name: labelPatterns.cardNWithBest(n) }),

  // ───── Variantes resilientes baseadas em data-testid ─────
  /** Card N via testid. Não depende de aria-label/score/winner suffix. */
  cardByTid: (n: number) => screen.getByTestId(testIds.card(n)) as HTMLButtonElement,
  queryCardByTid: (n: number) => screen.queryByTestId(testIds.card(n)) as HTMLButtonElement | null,
  /** Botão "marcar vencedora" N via testid. */
  marcarByTid: (n: number) => screen.getByTestId(testIds.winnerButton(n)) as HTMLButtonElement,
  queryMarcarByTid: (n: number) =>
    screen.queryByTestId(testIds.winnerButton(n)) as HTMLButtonElement | null,
  /** Lista (role + testid). */
  listByTid: () => screen.getByTestId(testIds.list),
  /** Todos os cards via padrão de testid (resiliente a mudanças no aria-label). */
  allCardsByTid: () => screen.getAllByTestId(/^variation-card-\d+$/) as HTMLButtonElement[],
  allMarcarByTid: () =>
    screen.getAllByTestId(/^variation-winner-button-\d+$/) as HTMLButtonElement[],

  // ───── Asserts de estado via data-attributes (sem acoplar a aria-pressed) ─────
  /** Indica se o card N está marcado como ativo via `data-active="true"`. */
  isCardActiveByTid: (n: number) => select.cardByTid(n).getAttribute("data-active") === "true",
  /** Indica se o card N está marcado como vencedor via `data-winner="true"`. */
  isCardWinnerByTid: (n: number) => select.cardByTid(n).getAttribute("data-winner") === "true",
};

// ───────── Asserts de alto nível para aria-labels ─────────

/** Garante que o card N existe com o score informado e (não) é o "melhor score". */
function expectVariationCard(n: number, score: number, opts: { best?: boolean } = {}): HTMLElement {
  const card = select.cardByScore(n, score, { best: opts.best });
  expect(card).toBeInTheDocument();
  if (opts.best) {
    expect(select.queryCardWithBest(n)).toBe(card);
  } else {
    expect(select.queryCardWithBest(n)).not.toBe(card);
  }
  return card;
}

/** Garante que o card N NÃO carrega o sufixo "melhor score". */
function expectNotBestScore(n: number): void {
  expect(select.queryCardWithBest(n)).not.toBeInTheDocument();
}

/** Garante que apenas UM card carrega "melhor score" (invariante de exclusividade). */
function expectExactlyOneBestScore(): HTMLElement {
  const best = select
    .allCards()
    .filter((c) => /melhor score/.test(c.getAttribute("aria-label") ?? ""));
  expect(best).toHaveLength(1);
  return best[0];
}

/** Garante que o botão "Marcar variação N como vencedora" existe e está habilitado/desabilitado. */
function expectWinnerButton(n: number, opts: { disabled?: boolean } = {}): HTMLElement {
  const btn = select.marcar(n);
  expect(btn).toBeInTheDocument();
  if (opts.disabled !== undefined) {
    if (opts.disabled) expect(btn).toBeDisabled();
    else expect(btn).toBeEnabled();
  }
  return btn;
}

describe("Magic Up Onda 5 components", () => {
  it("renderiza Magic Score excelente, origem IA e formato", () => {
    render(<MagicUpQualityScore diagnosis={diagnosis(95, "ai")} aspectRatio="4:5" />);
    expect(screen.getByLabelText("Diagnóstico Magic Score")).toBeInTheDocument();
    expect(screen.getByText("95/100")).toBeInTheDocument();
    expect(screen.getByText("IA")).toBeInTheDocument();
    expect(screen.getByText("4:5")).toBeInTheDocument();
  });

  it("renderiza Magic Score heurístico crítico sem quebrar recomendações vazias", () => {
    const low = { ...diagnosis(58, "heuristic"), recommendations: [] };
    render(<MagicUpQualityScore diagnosis={low} />);
    expect(screen.getByText("58/100")).toBeInTheDocument();
    expect(screen.getByText("Heurístico")).toBeInTheDocument();
    expect(screen.getByText("Precisa revisão")).toBeInTheDocument();
  });

  it("renderiza checklist com critérios aprovados, reprovados, scores e recomendações", () => {
    render(<MagicUpQualityChecklist diagnosis={diagnosis(64, "heuristic")} />);
    expect(screen.getByLabelText("Checklist de curadoria")).toBeInTheDocument();
    expect(screen.getByText("Produto claro")).toBeInTheDocument();
    expect(screen.getByText("Logo disponível")).toBeInTheDocument();
    expect(screen.getByText("94")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText("Revise este ponto antes de enviar ao cliente.")).toBeInTheDocument();
  });

  it("permite alterar todos os status de curadoria com aria-checked e respeita disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(<MagicUpCurationStatus value="draft" onChange={onChange} />);
    const boa = screen.getByRole("radio", { name: "Definir curadoria como Boa" });
    expect(boa).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Definir curadoria como Rascunho" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(boa);
    expect(onChange).toHaveBeenCalledWith("good");

    rerender(<MagicUpCurationStatus value="good" disabled onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Definir curadoria como Boa" })).toBeDisabled();
  });

  it("checklist usa role list e expõe scores com aria-label", () => {
    render(<MagicUpQualityChecklist diagnosis={diagnosis(64, "heuristic")} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(4);
    expect(screen.getByLabelText("Score 94 de 100")).toBeInTheDocument();
    expect(screen.getByLabelText("Score 58 de 100")).toBeInTheDocument();
  });

  it("compara variações com aria-pressed e botão vencedora único por variação", async () => {
    const variations = buildVariations([
      { qualityScore: 70 },
      { qualityScore: undefined, qualityDiagnosis: diagnosis(92) },
      { qualityScore: undefined },
    ]);
    const { onSelect, onSelectWinner, user } = renderComparator({ variations });

    expect(screen.getByLabelText("Comparador de variações")).toBeInTheDocument();
    const firstBtn = select.card(1);
    expect(firstBtn).toHaveAttribute("aria-pressed", "true");
    expect(firstBtn).toHaveAttribute("aria-current", "true");
    await user.click(select.card(2));
    expect(onSelect).toHaveBeenCalledWith(1);
    await user.click(select.marcar(2));
    expect(onSelectWinner).toHaveBeenCalledWith(1);
  });

  it("não renderiza comparador com menos de duas variações", () => {
    const { container } = render(<MagicUpVariationComparator variations={[]} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lida com todas as variações sem score exibindo placeholder e SEM badge de vencedor", () => {
    const variations: VariationItem[] = [
      { id: "a", imageUrl: "https://example.com/a.png", isFavorite: false },
      { id: "b", imageUrl: "https://example.com/b.png", isFavorite: false },
      { id: "c", imageUrl: "https://example.com/c.png", isFavorite: false },
    ];
    renderComparator({ variations });
    expect(screen.getByLabelText("Melhor score entre variações: indisponível")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    // Sem score válido → nenhuma badge "Melhor score" e nenhum aria-label de vencedor
    expect(screen.queryAllByLabelText("Melhor score")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /melhor score/i })).not.toBeInTheDocument();
  });

  it("identifica vencedor único quando há scores parciais sem confundir 0 com ausente", () => {
    const variations: VariationItem[] = [
      { id: "a", imageUrl: "https://example.com/a.png", isFavorite: false },
      { id: "b", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 80 },
      { id: "c", imageUrl: "https://example.com/c.png", isFavorite: false },
    ];
    renderComparator({ variations });
    expect(screen.getByLabelText("Melhor score entre variações: 80")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(select.cardExact("Selecionar variação 2, score 80, melhor score")).toBeInTheDocument();
    expect(screen.getByLabelText("Score 80 de 100")).toBeInTheDocument();
  });

  it("renderiza lista longa com 8 variações expondo 1 vencedor e botões únicos", () => {
    const scores = [55, 62, 70, 78, 81, 88, 92, 74];
    const variations: VariationItem[] = scores.map((score, index) => ({
      id: `v${index}`,
      imageUrl: `https://example.com/${index}.png`,
      isFavorite: false,
      qualityScore: score,
    }));
    renderComparator({ variations });
    expect(screen.getAllByRole("listitem").length).toBe(8);
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(screen.getByLabelText("Melhor score entre variações: 92")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 7, score 92, melhor score")).toBeInTheDocument();
    for (let i = 1; i <= 8; i++) {
      expect(select.marcar(i)).toBeInTheDocument();
    }
  });

  it("mantém aria-pressed alinhado com activeIndex e isola clique de marcar vencedora", async () => {
    const variations = buildVariations([
      { qualityScore: 60 },
      { qualityScore: 70, isWinner: true },
      { qualityScore: 65 },
    ]);
    const { onSelect, onSelectWinner, user } = renderComparator({ variations });

    const winnerCard = select.card(2);
    expect(winnerCard).toHaveAttribute("aria-pressed", "false");
    expect(select.card(1)).toHaveAttribute("aria-pressed", "true");

    await user.click(winnerCard);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onSelectWinner).not.toHaveBeenCalled();

    await user.click(select.marcar(3));
    expect(onSelectWinner).toHaveBeenCalledWith(2);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("aplica focus-visible:ring e contraste de disabled nos botões críticos da Onda 5", () => {
    const variations = buildVariations([{ qualityScore: 70 }, { qualityScore: 80 }]).slice(0, 2);
    const { unmount } = renderComparator({ variations });
    const winnerBtn = select.marcar(1);
    const cls = winnerBtn.getAttribute("class") || "";
    expect(cls).toContain("focus-visible:ring");
    expect(cls).toContain("disabled:bg-muted");
    expect(cls).toContain("disabled:text-muted-foreground");
    unmount();

    render(<MagicUpCurationStatus value="draft" disabled onChange={vi.fn()} />);
    const radio = screen.getByRole("radio", { name: "Definir curadoria como Boa" });
    const radioCls = radio.getAttribute("class") || "";
    expect(radioCls).toContain("focus-visible:ring");
    expect(radioCls).toContain("disabled:bg-muted");
    expect(radioCls).toContain("disabled:text-muted-foreground");
    expect(radio).toBeDisabled();
  });

  it("resolve empate de scores de forma determinística e respeita prioridade de isWinner", () => {
    const tied: VariationItem[] = [
      { id: "a", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 70 },
      { id: "b", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 90 },
      { id: "c", imageUrl: "https://example.com/c.png", isFavorite: false, qualityScore: 90 },
    ];
    const { rerender, unmount } = render(
      <MagicUpVariationComparator variations={tied} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />
    );

    expect(screen.getByLabelText("Melhor score entre variações: 90")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(select.cardExact("Selecionar variação 2, score 90, melhor score")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 3, score 90")).toBeInTheDocument();

    // Determinismo: re-render mantém winner no índice 1
    rerender(<MagicUpVariationComparator variations={tied} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />);
    expect(select.cardExact("Selecionar variação 2, score 90, melhor score")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Selecionar variação 3, score 90, melhor score" })).not.toBeInTheDocument();
    unmount();

    // isWinner explícito num item de score baixo ainda vence se aparecer antes do bestScore
    const winnerFirst: VariationItem[] = [
      { id: "a", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 70, isWinner: true },
      { id: "b", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 90 },
      { id: "c", imageUrl: "https://example.com/c.png", isFavorite: false, qualityScore: 90 },
    ];
    renderComparator({ variations: winnerFirst });
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(select.cardExact("Selecionar variação 1, score 70, melhor score")).toBeInTheDocument();
  });

  it("empate total: exibe exatamente 1 badge 'Melhor score' no primeiro índice (winner determinístico)", () => {
    const variations = buildVariations([
      { qualityScore: 80 },
      { qualityScore: 80 },
      { qualityScore: 80 },
    ]);
    renderComparator({ variations });
    // Exatamente 1 badge "Melhor score" entre todas as variações empatadas
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    // Winner determinístico: primeiro índice (findIndex retorna o primeiro match)
    expect(select.cardExact("Selecionar variação 1, score 80, melhor score")).toBeInTheDocument();
    // Variações 2 e 3 NÃO têm sufixo "melhor score" no aria-label
    expect(select.cardExact("Selecionar variação 2, score 80")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 3, score 80")).toBeInTheDocument();
    // Badge isolada tem aria-label exato e texto visível sincronizado
    const badge = screen.getByLabelText("Melhor score");
    expect(badge).toHaveTextContent("Melhor score");
    // Contagem global: badge + botão + listitem aninhado = 3 nodes acessíveis com "melhor score"
    expect(screen.getAllByLabelText(/melhor score/i)).toHaveLength(3);
    // Ausência explícita do sufixo de winner nas variações 2 e 3
    expect(screen.queryByRole("button", { name: /Selecionar variação 2.*melhor score/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar variação 3.*melhor score/i })).not.toBeInTheDocument();
  });

  it("empate triplo com isWinner explícito: badge vai para o índice marcado (prioridade absoluta de isWinner)", () => {
    const variations = buildVariations([
      { qualityScore: 85 },
      { qualityScore: 85, isWinner: true },
      { qualityScore: 85 },
    ]);
    renderComparator({ variations });
    // Apenas 1 badge no total
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    // isWinner=true tem prioridade absoluta sobre o cálculo automático por bestScore
    expect(select.cardExact("Selecionar variação 1, score 85")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 2, score 85, melhor score")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 3, score 85")).toBeInTheDocument();
  });

  it("empate em score 0: trata 0 como avaliação real (ruim) — badge 'Melhor score' vai para o primeiro índice", () => {
    const variations: VariationItem[] = [
      { id: "v1", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 0 },
      { id: "v2", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 0 },
    ];
    renderComparator({ variations });
    // bestScore = 0 (avaliação real) → winnerIndex = 0 → 1 badge no primeiro card
    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    expect(select.cardExact("Selecionar variação 1, score 0, melhor score")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 2, score 0")).toBeInTheDocument();
    // Badge global mostra "0" explícito (não "—")
    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: 0");
  });

  it("dois isWinner: true simultâneos: badge vai para o primeiro índice marcado, ignorando o segundo", () => {
    const variations = buildVariations([
      { qualityScore: 60, isWinner: true },
      { qualityScore: 70 },
      { qualityScore: 50, isWinner: true },
    ]);
    renderComparator({ variations });
    // Apenas 1 badge mesmo com 2 isWinner: true
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    // Variação 1 (índice 0, primeiro isWinner) recebe sufixo
    expect(select.cardExact("Selecionar variação 1, score 60, melhor score")).toBeInTheDocument();
    // Variação 2 (score 70, sem isWinner) não recebe badge — score mais alto é ignorado
    expect(select.cardExact("Selecionar variação 2, score 70")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar variação 2.*melhor score/i })).not.toBeInTheDocument();
    // Variação 3 (segundo isWinner) NÃO recebe badge — findIndex já parou no índice 0
    expect(select.cardExact("Selecionar variação 3, score 50")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar variação 3.*melhor score/i })).not.toBeInTheDocument();
  });

  it("clicar em card empatado não-vencedor: chama onSelect mas não move a badge 'Melhor score'", async () => {
    const variations = buildVariations([
      { qualityScore: 80 },
      { qualityScore: 80 },
      { qualityScore: 80 },
    ]);
    const onSelect = vi.fn();
    const { rerender, user } = renderComparator({ variations, onSelect });
    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(select.cardExact("Selecionar variação 1, score 80, melhor score")).toBeInTheDocument();

    await user.click(select.cardExact("Selecionar variação 2, score 80"));
    expect(onSelect).toHaveBeenCalledWith(1);

    rerender(
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={1}
        onSelect={onSelect}
        onSelectWinner={vi.fn()}
      />
    );

    expect(screen.getAllByLabelText("Melhor score").length).toBe(1);
    expect(select.cardExact("Selecionar variação 1, score 80, melhor score")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar variação 2.*melhor score/i })).not.toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 2, score 80")).toHaveAttribute("aria-pressed", "true");
  });

  // ───────── Smoke tests dos helpers de aria-label ─────────
  describe("helpers de aria-label (builders + asserts compartilhados)", () => {
    it("variationCardLabel monta string exata com e sem score/best", () => {
      expect(variationCardLabel(1)).toBe("Selecionar variação 1");
      expect(variationCardLabel(2, { score: 80 })).toBe("Selecionar variação 2, score 80");
      expect(variationCardLabel(3, { score: 90, best: true })).toBe(
        "Selecionar variação 3, score 90, melhor score"
      );
      expect(variationCardLabel(4, { best: true })).toBe(
        "Selecionar variação 4, melhor score"
      );
    });

    it("winnerButtonLabel monta string exata", () => {
      expect(winnerButtonLabel(1)).toBe("Marcar variação 1 como vencedora");
      expect(winnerButtonLabel(7)).toBe("Marcar variação 7 como vencedora");
    });

    it("expectVariationCard + expectNotBestScore + expectExactlyOneBestScore validam estado real", () => {
      const variations = buildVariations([
        { qualityScore: 90 },
        { qualityScore: 70 },
        { qualityScore: 50 },
      ]);
      renderComparator({ variations });

      expectVariationCard(1, 90, { best: true });
      expectVariationCard(2, 70);
      expectVariationCard(3, 50);
      expectNotBestScore(2);
      expectNotBestScore(3);

      const bestCard = expectExactlyOneBestScore();
      expect(bestCard.getAttribute("aria-label")).toBe(
        variationCardLabel(1, { score: 90, best: true })
      );
    });

    it("expectWinnerButton localiza botão para cada variação (com e sem isWinner)", () => {
      const variations = buildVariations([
        { qualityScore: 90 },
        { qualityScore: 70, isWinner: true },
        { qualityScore: 50 },
      ]);
      renderComparator({ variations });

      // Em todas as variações, o botão "Marcar vencedora" existe e seu aria-label
      // bate exatamente com o produzido por winnerButtonLabel(n).
      // eslint-disable-next-line no-restricted-syntax
      [1, 2, 3].forEach((n) => {
        const btn = expectWinnerButton(n);
        expect(btn.getAttribute("aria-label")).toBe(winnerButtonLabel(n));
      });
    });

    it("labelPatterns.anyCard / anyWinner casam com todos os botões esperados", () => {
      renderComparator({ variations: buildVariations() });
      expect(select.allCards()).toHaveLength(3);
      expect(select.allMarcar()).toHaveLength(3);
      // eslint-disable-next-line no-restricted-syntax
      select.allCards().forEach((c) => {
        expect(c.getAttribute("aria-label")).toMatch(labelPatterns.anyCard);
      });
      // eslint-disable-next-line no-restricted-syntax
      select.allMarcar().forEach((b) => {
        expect(b.getAttribute("aria-label")).toMatch(labelPatterns.anyWinner);
      });
    });

    it("select.cardByScore é equivalente a select.cardExact com label montado", () => {
      renderComparator({ variations: buildVariations() });
      expect(select.cardByScore(1, 90, { best: true })).toBe(
        select.cardExact(variationCardLabel(1, { score: 90, best: true }))
      );
      expect(select.cardByScore(2, 70)).toBe(
        select.cardExact(variationCardLabel(2, { score: 70 }))
      );
    });

    it("expectFocusVisible aceita níveis 'base' e 'full' e detecta classes ausentes", () => {
      const ok = document.createElement("button");
      ok.className = FOCUS_VISIBLE_FULL_CLASSES.join(" ");
      expectFocusVisible(ok, "base");
      expectFocusVisible(ok, "full");

      const partial = document.createElement("button");
      partial.className = FOCUS_VISIBLE_BASE_CLASSES.join(" ");
      expectFocusVisible(partial, "base");
      expect(() => expectFocusVisible(partial, "full")).toThrow();

      const broken = document.createElement("button");
      broken.className = "focus:ring-2 focus:ring-primary"; // sem -visible: → proibido
      expect(() => expectFocusVisible(broken, "base")).toThrow();
    });

    it("expectAllCardsFocusVisible valida o bloco padrão em todos os cards renderizados", () => {
      renderComparator({ variations: buildVariations() });
      expectAllCardsFocusVisible("base");
    });

    it("expectAllWinnerButtonsFocusVisible valida o bloco padrão em todos os botões 'Marcar vencedora'", () => {
      renderComparator({ variations: buildVariations() });
      expectAllWinnerButtonsFocusVisible("base");
    });

    it("expectActiveElementFocusVisible falha quando foco está no body e passa após focar elemento válido", async () => {
      const { user } = renderComparator({ variations: buildVariations() });

      // Foco inicial no body → deve falhar
      (document.activeElement as HTMLElement | null)?.blur?.();
      expect(() => expectActiveElementFocusVisible()).toThrow();

      // Após Tab para o primeiro card, passa
      await user.tab();
      const focused = expectActiveElementFocusVisible("base");
      expect(focused.getAttribute("aria-label")).toMatch(labelPatterns.anyCard);
    });
  });

  // ───────── Smoke tests dos seletores resilientes (testid + regex fuzzy) ─────────
  describe("seletores resilientes (data-testid + regex fuzzy)", () => {
    it("expõe testIds previsíveis para comparator, list, cards e botões 'Marcar vencedora'", () => {
      renderComparator({ variations: buildVariations() });
      expect(screen.getByTestId(testIds.comparator)).toBeInTheDocument();
      expect(select.listByTid()).toBeInTheDocument();
      // eslint-disable-next-line no-restricted-syntax
      [1, 2, 3].forEach((n) => {
        expect(select.cardByTid(n)).toBeInTheDocument();
        expect(select.marcarByTid(n)).toBeInTheDocument();
      });
    });

    it("select.cardByTid e select.marcarByTid retornam os MESMOS nós que os helpers ARIA", () => {
      renderComparator({ variations: buildVariations() });
      // eslint-disable-next-line no-restricted-syntax
      [1, 2, 3].forEach((n) => {
        expect(select.cardByTid(n)).toBe(select.card(n));
        expect(select.marcarByTid(n)).toBe(select.marcar(n));
      });
    });

    it("allCardsByTid e allMarcarByTid retornam contagem coerente com os helpers ARIA", () => {
      renderComparator({ variations: buildVariations() });
      expect(select.allCardsByTid()).toHaveLength(select.allCards().length);
      expect(select.allMarcarByTid()).toHaveLength(select.allMarcar().length);
    });

    it("data-active e data-winner refletem activeIndex/winnerIndex sem depender de aria-pressed", () => {
      const variations = buildVariations([
        { qualityScore: 90, isWinner: true },
        { qualityScore: 70 },
        { qualityScore: 50 },
      ]);
      renderComparator({ variations, activeIndex: 1 });

      // active state
      expect(select.isCardActiveByTid(1)).toBe(false);
      expect(select.isCardActiveByTid(2)).toBe(true);
      expect(select.isCardActiveByTid(3)).toBe(false);
      // winner state (deriva de isWinner do item, não de winnerIndex prop)
      expect(select.isCardWinnerByTid(1)).toBe(true);
      expect(select.isCardWinnerByTid(2)).toBe(false);
      expect(select.isCardWinnerByTid(3)).toBe(false);
    });

    it("labelPatterns.cardNFuzzy / winnerNFuzzy casam aria-labels mesmo com variações de pontuação", () => {
      // Asserts puramente sobre regex — não dependem de render.
      expect("Selecionar variação 2, score 80").toMatch(labelPatterns.cardNFuzzy(2));
      expect("Selecionar variacao 2 score 80").toMatch(labelPatterns.cardNFuzzy(2));
      expect("Selecionar Variação 2").toMatch(labelPatterns.cardNFuzzy(2));
      expect("Marcar variação 3 como vencedora").toMatch(labelPatterns.winnerNFuzzy(3));
      expect("marcar a variacao 3 como vencedor").toMatch(labelPatterns.winnerNFuzzy(3));

      // Negativos: número diferente não deve casar
      expect("Selecionar variação 22").not.toMatch(labelPatterns.cardNFuzzy(2));
      expect("Marcar variação 33 como vencedora").not.toMatch(labelPatterns.winnerNFuzzy(3));
    });

    it("queryCardByTid / queryMarcarByTid retornam null sem lançar quando o índice não existe", () => {
      renderComparator({ variations: buildVariations() });
      expect(select.queryCardByTid(99)).toBeNull();
      expect(select.queryMarcarByTid(99)).toBeNull();
    });
  });
});

describe("MagicUpVariationComparator snapshots", () => {
  const baseVariation = (overrides: Partial<VariationItem> & { id: string; imageUrl: string }): VariationItem => ({
    isFavorite: false,
    ...overrides,
  });

  it("snapshot — estado base com 3 variações e scores distintos", () => {
    const variations: VariationItem[] = [
      baseVariation({ id: "a", imageUrl: "https://example.com/a.png", qualityScore: 70 }),
      baseVariation({ id: "b", imageUrl: "https://example.com/b.png", qualityScore: 85 }),
      baseVariation({ id: "c", imageUrl: "https://example.com/c.png", qualityScore: 92 }),
    ];
    const { container } = render(
      <MagicUpVariationComparator variations={variations} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot — variação ativa em activeIndex=1", () => {
    const variations: VariationItem[] = [
      baseVariation({ id: "a", imageUrl: "https://example.com/a.png", qualityScore: 70 }),
      baseVariation({ id: "b", imageUrl: "https://example.com/b.png", qualityScore: 85 }),
      baseVariation({ id: "c", imageUrl: "https://example.com/c.png", qualityScore: 92 }),
    ];
    const { container } = render(
      <MagicUpVariationComparator variations={variations} activeIndex={1} onSelect={vi.fn()} onSelectWinner={vi.fn()} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot — empate de scores [70, 90, 90] mantém badge única no índice 1", () => {
    const variations: VariationItem[] = [
      baseVariation({ id: "a", imageUrl: "https://example.com/a.png", qualityScore: 70 }),
      baseVariation({ id: "b", imageUrl: "https://example.com/b.png", qualityScore: 90 }),
      baseVariation({ id: "c", imageUrl: "https://example.com/c.png", qualityScore: 90 }),
    ];
    const { container } = render(
      <MagicUpVariationComparator variations={variations} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot — scores ausentes exibe placeholders e nenhum vencedor (sem badge)", () => {
    const variations: VariationItem[] = [
      baseVariation({ id: "a", imageUrl: "https://example.com/a.png" }),
      baseVariation({ id: "b", imageUrl: "https://example.com/b.png" }),
      baseVariation({ id: "c", imageUrl: "https://example.com/c.png" }),
    ];
    const { container } = render(
      <MagicUpVariationComparator variations={variations} activeIndex={0} onSelect={vi.fn()} onSelectWinner={vi.fn()} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("MagicUpVariationComparator keyboard navigation", () => {
  it("Tab percorre cards e botões 'Marcar vencedora' na ordem do DOM", () => {
    renderComparator();

    const expectedOrder = [
      select.card(1),
      select.marcar(1),
      select.card(2),
      select.marcar(2),
      select.card(3),
      select.marcar(3),
    ];

    // Todos os elementos são <button> nativos, focáveis via Tab por padrão (sem tabindex=-1)
    for (const el of expectedOrder) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("tabindex")).not.toBe("-1");
    }

    // Confirma ordem do DOM: cada elemento aparece depois do anterior
    for (let i = 1; i < expectedOrder.length; i++) {
      const prev = expectedOrder[i - 1];
      const curr = expectedOrder[i];
      const position = prev.compareDocumentPosition(curr);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("Enter no card de variação dispara onSelect com índice correto", async () => {
    const { onSelect, onSelectWinner, user } = renderComparator();

    const card = select.card(2);
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("Space no card de variação dispara onSelect com índice correto", async () => {
    const { onSelect, onSelectWinner, user } = renderComparator();

    const card = select.card(3);
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("Enter no botão 'Marcar vencedora' chama onSelectWinner sem disparar onSelect", async () => {
    const { onSelect, onSelectWinner, user } = renderComparator();

    const winnerBtn = select.marcar(3);
    winnerBtn.focus();
    expect(winnerBtn).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onSelectWinner).toHaveBeenCalledWith(2);
    expect(onSelectWinner).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("regressão: Enter em botão focado dispara onClick nativo (semântica HTML preservada, sem keyDown handler custom)", async () => {
    const { onSelect, onSelectWinner, user } = renderComparator();

    const card = select.card(2);
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);

    const card3 = select.card(3);
    card3.focus();
    expect(card3).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(2);

    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("Tab/Shift+Tab navega na ordem DOM: select-1 → marcar-1 → select-2 → marcar-2 → select-3 → marcar-3", async () => {
    const { user } = renderComparator();

    expect(document.body).toHaveFocus();

    await user.tab();
    expect(select.cardExact("Selecionar variação 1, score 90, melhor score")).toHaveFocus();

    await user.tab();
    expect(select.marcar(1)).toHaveFocus();

    await user.tab();
    expect(select.cardExact("Selecionar variação 2, score 70")).toHaveFocus();

    await user.tab();
    expect(select.marcar(2)).toHaveFocus();

    await user.tab();
    expect(select.cardExact("Selecionar variação 3, score 50")).toHaveFocus();

    await user.tab();
    expect(select.marcar(3)).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.cardExact("Selecionar variação 3, score 50")).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.marcar(2)).toHaveFocus();
  });

  it("card ativo reflete activeIndex via aria-pressed/aria-current/border-primary, independente do foco do teclado", () => {
    const variations = buildVariations();
    const { rerender } = renderComparator({ variations });

    const card1Btn = select.card(1);
    const card2Btn = select.card(2);
    const card3Btn = select.card(3);

    expect(card1Btn).toHaveAttribute("aria-pressed", "true");
    expect(card1Btn).toHaveAttribute("aria-current", "true");
    expect(card2Btn).toHaveAttribute("aria-pressed", "false");
    expect(card2Btn).not.toHaveAttribute("aria-current");
    expect(card3Btn).toHaveAttribute("aria-pressed", "false");
    expect(card3Btn).not.toHaveAttribute("aria-current");

    expect(card1Btn.parentElement).toHaveClass("border-primary");
    expect(card2Btn.parentElement).not.toHaveClass("border-primary");

    // Foco programático no card 3 não muda o estado ativo
    card3Btn.focus();
    expect(card3Btn).toHaveFocus();
    expect(card1Btn).toHaveAttribute("aria-pressed", "true");
    expect(card3Btn).toHaveAttribute("aria-pressed", "false");
    expect(card3Btn.parentElement).not.toHaveClass("border-primary");

    rerender(
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={2}
        onSelect={vi.fn()}
        onSelectWinner={vi.fn()}
      />
    );

    expect(card1Btn).toHaveAttribute("aria-pressed", "false");
    expect(card1Btn).not.toHaveAttribute("aria-current");
    expect(card3Btn).toHaveAttribute("aria-pressed", "true");
    expect(card3Btn).toHaveAttribute("aria-current", "true");
    expect(card3Btn.parentElement).toHaveClass("border-primary");
    expect(card1Btn.parentElement).not.toHaveClass("border-primary");
  });

  it("'Marcar vencedora' com disabled nativo: removido do Tab e Enter/Space não disparam onSelectWinner", async () => {
    const user = userEvent.setup();
    const onSelectWinner = vi.fn();

    function Harness() {
      return (
        <section className="rounded-lg border bg-card p-3">
          <div role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} role="listitem" className="overflow-hidden rounded-lg border">
                <button
                  type="button"
                  aria-pressed={i === 0}
                  aria-label={`Selecionar variação ${i + 1}, score 80`}
                  onClick={vi.fn()}
                >
                  card {i + 1}
                </button>
                <button
                  type="button"
                  disabled={i === 1}
                  aria-label={`Marcar variação ${i + 1} como vencedora`}
                  onClick={() => onSelectWinner(i)}
                >
                  Marcar vencedora
                </button>
              </div>
            ))}
          </div>
        </section>
      );
    }

    render(<Harness />);

    const marcar2 = select.marcar(2);
    expect(marcar2).toBeDisabled();

    await user.tab();
    expect(select.cardExact("Selecionar variação 1, score 80")).toHaveFocus();
    await user.tab();
    expect(select.marcar(1)).toHaveFocus();
    await user.tab();
    expect(select.cardExact("Selecionar variação 2, score 80")).toHaveFocus();
    await user.tab();
    expect(select.cardExact("Selecionar variação 3, score 80")).toHaveFocus();
    expect(marcar2).not.toHaveFocus();

    marcar2.focus();
    expect(marcar2).not.toHaveFocus();

    await user.click(marcar2);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("'Marcar vencedora' com aria-disabled=true: mantém no Tab mas Enter/Space/click são ignorados via guarda", async () => {
    const user = userEvent.setup();
    const onSelectWinner = vi.fn();

    function Harness() {
      const handleClick = (i: number) => (e: React.MouseEvent | React.KeyboardEvent) => {
        if ((e.currentTarget as HTMLElement).getAttribute("aria-disabled") === "true") return;
        onSelectWinner(i);
      };
      return (
        <section>
          <div role="list" className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} role="listitem">
                <button
                  type="button"
                  aria-label={`Selecionar variação ${i + 1}, score 80`}
                  onClick={vi.fn()}
                >
                  card {i + 1}
                </button>
                <button
                  type="button"
                  aria-disabled={i === 1 ? "true" : undefined}
                  aria-label={`Marcar variação ${i + 1} como vencedora`}
                  onClick={handleClick(i)}
                >
                  Marcar vencedora
                </button>
              </div>
            ))}
          </div>
        </section>
      );
    }

    render(<Harness />);

    const marcar2 = select.marcar(2);
    expect(marcar2).toHaveAttribute("aria-disabled", "true");
    expect(marcar2).not.toBeDisabled();

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(marcar2).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onSelectWinner).not.toHaveBeenCalled();

    expect(marcar2).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelectWinner).not.toHaveBeenCalled();

    await user.click(marcar2);
    expect(onSelectWinner).not.toHaveBeenCalled();

    const marcar1 = select.marcar(1);
    marcar1.focus();
    expect(marcar1).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectWinner).toHaveBeenCalledWith(0);
    expect(onSelectWinner).toHaveBeenCalledTimes(1);
  });

  it("Shift+Tab navega em ordem reversa completa: marcar-3 → select-3 → marcar-2 → select-2 → marcar-1 → select-1", async () => {
    const { user } = renderComparator();

    const marcar3 = select.marcar(3);
    marcar3.focus();
    expect(marcar3).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.cardExact("Selecionar variação 3, score 50")).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.marcar(2)).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.cardExact("Selecionar variação 2, score 70")).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.marcar(1)).toHaveFocus();

    await user.tab({ shift: true });
    expect(select.cardExact("Selecionar variação 1, score 90, melhor score")).toHaveFocus();

    await user.tab();
    expect(select.marcar(1)).toHaveFocus();
  });

  it("Enter e Space ativam onSelect (cards) e onSelectWinner (marcar) consistentemente, inclusive após Shift+Tab", async () => {
    const variations = buildVariations().slice(0, 2);
    const { onSelect, onSelectWinner, user } = renderComparator({ variations });

    const select1 = select.card(1);
    const marcar1 = select.marcar(1);
    const select2 = select.cardExact("Selecionar variação 2, score 70");
    const marcar2 = select.marcar(2);

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(marcar2).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectWinner).toHaveBeenCalledWith(1);
    expect(onSelectWinner).toHaveBeenCalledTimes(1);

    await user.tab({ shift: true });
    expect(select2).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledTimes(1);

    await user.tab({ shift: true });
    expect(marcar1).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelectWinner).toHaveBeenCalledWith(0);
    expect(onSelectWinner).toHaveBeenCalledTimes(2);

    await user.tab({ shift: true });
    expect(select1).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onSelect).toHaveBeenCalledTimes(2);

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelectWinner).toHaveBeenCalledTimes(2);
  });

  it("Enter/Space disparam re-render que atualiza border-primary + aria-pressed + aria-current no novo card ativo", async () => {
    const user = userEvent.setup();
    const variations = buildVariations();

    function ControlledHarness() {
      const [active, setActive] = React.useState(0);
      return (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={active}
          onSelect={setActive}
          onSelectWinner={vi.fn()}
        />
      );
    }

    render(<ControlledHarness />);

    const select1 = select.card(1);
    const select2 = select.cardExact("Selecionar variação 2, score 70");
    const select3 = select.cardExact("Selecionar variação 3, score 50");

    expect(select1).toHaveAttribute("aria-pressed", "true");
    expect(select1).toHaveAttribute("aria-current", "true");
    expect(select1.parentElement).toHaveClass("border-primary");
    expect(select2.parentElement).not.toHaveClass("border-primary");

    await user.tab();
    await user.tab();
    await user.tab();
    expect(select2).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(select2).toHaveAttribute("aria-pressed", "true");
    expect(select2).toHaveAttribute("aria-current", "true");
    expect(select2.parentElement).toHaveClass("border-primary");
    expect(select2.parentElement?.className).toMatch(/ring-2/);
    expect(select1).toHaveAttribute("aria-pressed", "false");
    expect(select1).not.toHaveAttribute("aria-current");
    expect(select1.parentElement).not.toHaveClass("border-primary");

    await user.tab();
    await user.tab();
    expect(select3).toHaveFocus();
    await user.keyboard(" ");

    expect(select3).toHaveAttribute("aria-pressed", "true");
    expect(select3).toHaveAttribute("aria-current", "true");
    expect(select3.parentElement).toHaveClass("border-primary");
    expect(select2).toHaveAttribute("aria-pressed", "false");
    expect(select2.parentElement).not.toHaveClass("border-primary");
  });

  it("Enter/Space não alteram quantidade de botões, listitems, imagens nem criam portais/tooltips", async () => {
    const user = userEvent.setup();
    const onSelectWinner = vi.fn();
    const variations = buildVariations();

    function ControlledHarness() {
      const [active, setActive] = React.useState(0);
      return (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={active}
          onSelect={setActive}
          onSelectWinner={onSelectWinner}
        />
      );
    }

    const { container } = render(<ControlledHarness />);

    const initialButtons = screen.getAllByRole("button").length;
    const initialListItems = screen.getAllByRole("listitem").length;
    const initialImages = container.querySelectorAll("img").length;
    const initialBodyChildren = document.body.children.length;
    const initialSectionHTML = container.querySelector("section")?.outerHTML.length || 0;

    expect(initialButtons).toBe(6);
    expect(initialListItems).toBe(3);
    expect(initialImages).toBe(3);

    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getAllByRole("button").length).toBe(initialButtons);
    expect(screen.getAllByRole("listitem").length).toBe(initialListItems);
    expect(container.querySelectorAll("img").length).toBe(initialImages);
    expect(document.body.children.length).toBe(initialBodyChildren);
    const afterEnterHTML = container.querySelector("section")?.outerHTML.length || 0;
    expect(Math.abs(afterEnterHTML - initialSectionHTML)).toBeLessThan(200);

    await user.tab();
    expect(screen.getByRole("button", { name: "Marcar variação 2 como vencedora" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onSelectWinner).toHaveBeenCalledWith(1);

    expect(screen.getAllByRole("button").length).toBe(initialButtons);
    expect(screen.getAllByRole("listitem").length).toBe(initialListItems);
    expect(container.querySelectorAll("img").length).toBe(initialImages);
    expect(document.body.children.length).toBe(initialBodyChildren);

    expect(document.querySelector("[role='tooltip']")).toBeNull();
    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(document.querySelector("[data-radix-portal]")).toBeNull();
  });

  it("ARIA do cartão ativo: aria-pressed='true' + aria-current='true' apenas no activeIndex; demais sem aria-current", () => {
    const variations = buildVariations();

    for (const activeIdx of [0, 1, 2]) {
      const { unmount } = render(
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={activeIdx}
          onSelect={vi.fn()}
          onSelectWinner={vi.fn()}
        />
      );

      const cards = [select.card(1), select.card(2), select.card(3)];

      // eslint-disable-next-line no-restricted-syntax
      cards.forEach((card, i) => {
        if (i === activeIdx) {
          expect(card).toHaveAttribute("aria-pressed", "true");
          expect(card).toHaveAttribute("aria-current", "true");
        } else {
          expect(card).toHaveAttribute("aria-pressed", "false");
          expect(card).not.toHaveAttribute("aria-current");
        }
      });

      unmount();
    }
  });

  it("aria-label do botão 'Selecionar' compõe corretamente: índice + score (opcional) + 'melhor score' (opcional)", () => {
    const variations: VariationItem[] = [
      // 1: com score, é winner explícito → "Selecionar variação 1, score 95, melhor score"
      { id: "v1", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 95, isWinner: true },
      // 2: com score, não é winner → "Selecionar variação 2, score 70"
      { id: "v2", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 70 },
      // 3: sem score → "Selecionar variação 3"
      { id: "v3", imageUrl: "https://example.com/c.png", isFavorite: false },
    ];

    renderComparator({ variations });

    expect(select.cardExact("Selecionar variação 1, score 95, melhor score")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 2, score 70")).toBeInTheDocument();
    expect(select.cardExact("Selecionar variação 3")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Selecionar variação 2, melhor score" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Selecionar variação 3, score 0" })).not.toBeInTheDocument();
  });

  it("aria-label dos botões 'Marcar vencedora' é único por índice; botões de ação não têm aria-pressed/aria-current", () => {
    const variations = buildVariations([{ qualityScore: 90, isWinner: true }, {}, {}]);

    renderComparator({ variations });

    const marcar1 = select.marcar(1);
    const marcar2 = select.marcar(2);
    const marcar3 = select.marcar(3);

    expect(marcar1).toBeInTheDocument();
    expect(marcar2).toBeInTheDocument();
    expect(marcar3).toBeInTheDocument();
    expect(marcar1).not.toBe(marcar2);
    expect(marcar2).not.toBe(marcar3);

    for (const btn of [marcar1, marcar2, marcar3]) {
      expect(btn).not.toHaveAttribute("aria-pressed");
      expect(btn).not.toHaveAttribute("aria-current");
    }

    expect(marcar1).toBeEnabled();

    expect(select.allMarcar()).toHaveLength(3);
  });

  describe("navegação por setas (APG composite widget)", () => {
    function ArrowHarness({ initial = 0 }: { initial?: number }) {
      const [active, setActive] = React.useState(initial);
      return (
        <MagicUpVariationComparator
          variations={buildVariations()}
          activeIndex={active}
          onSelect={setActive}
          onSelectWinner={vi.fn()}
        />
      );
    }

    it("ArrowRight e ArrowDown avançam activeIndex e movem foco para o próximo card", async () => {
      const user = userEvent.setup();
      render(<ArrowHarness initial={0} />);

      const card1 = select.card(1);
      card1.focus();
      expect(card1).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      const card2 = select.card(2);
      expect(card2).toHaveFocus();
      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");

      await user.keyboard("{ArrowDown}");
      const card3 = select.card(3);
      expect(card3).toHaveFocus();
      expect(card3).toHaveAttribute("aria-pressed", "true");
    });

    it("ArrowLeft e ArrowUp retrocedem activeIndex e movem foco para o card anterior", async () => {
      const user = userEvent.setup();
      render(<ArrowHarness initial={2} />);

      const card3 = select.card(3);
      card3.focus();
      expect(card3).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      const card2 = select.card(2);
      expect(card2).toHaveFocus();
      expect(card2).toHaveAttribute("aria-pressed", "true");

      await user.keyboard("{ArrowUp}");
      const card1 = select.card(1);
      expect(card1).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");
    });

    it("ArrowRight no último faz wrap para o primeiro; ArrowLeft no primeiro faz wrap para o último; Home/End funcionam", async () => {
      const user = userEvent.setup();
      render(<ArrowHarness initial={2} />);

      const card1 = select.card(1);
      const card3 = select.card(3);

      card3.focus();
      expect(card3).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(card1).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");

      expect(card1).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(card3).toHaveFocus();
      expect(card3).toHaveAttribute("aria-pressed", "true");

      expect(card3).toHaveFocus();
      await user.keyboard("{Home}");
      expect(card1).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");

      expect(card1).toHaveFocus();
      await user.keyboard("{End}");
      expect(card3).toHaveFocus();
      expect(card3).toHaveAttribute("aria-pressed", "true");
    });

    it("teclas não-seta não interceptam navegação: Tab segue ordem natural; letras não disparam onSelect", async () => {
      const { onSelect, user } = renderComparator();

      const card1 = select.card(1);
      card1.focus();
      expect(card1).toHaveFocus();

      await user.keyboard("a");
      expect(onSelect).not.toHaveBeenCalled();
      expect(card1).toHaveFocus();

      await user.keyboard("{Tab}");
      const marcar1 = select.marcar(1);
      expect(marcar1).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("botão 'Selecionar' expõe aria-keyshortcuts com setas + Home/End", () => {
      renderComparator();
      const cards = select.allCards();
      for (const card of cards) {
        const shortcuts = card.getAttribute("aria-keyshortcuts") || "";
        expect(shortcuts).toContain("ArrowLeft");
        expect(shortcuts).toContain("ArrowRight");
        expect(shortcuts).toContain("ArrowUp");
        expect(shortcuts).toContain("ArrowDown");
        expect(shortcuts).toContain("Home");
        expect(shortcuts).toContain("End");
      }
    });
  });

  describe("setas atualizam activeIndex e ARIA acompanha após rerender", () => {
    const navVariations: VariationItem[] = [
      { id: "var-1", imageUrl: "https://example.com/1.png", qualityScore: 80 } as VariationItem,
      { id: "var-2", imageUrl: "https://example.com/2.png", qualityScore: 70 } as VariationItem,
      { id: "var-3", imageUrl: "https://example.com/3.png", qualityScore: 90 } as VariationItem,
    ];

    it("ArrowRight chama onSelect com próximo índice e aria-pressed/aria-current acompanham após rerender", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (activeIndex: number) => (
        <MagicUpVariationComparator variations={navVariations} activeIndex={activeIndex} onSelect={onSelect} onSelectWinner={onSelectWinner} />
      );
      const { rerender } = render(renderWith(0));

      const card0 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card0.focus();
      expect(card0).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(onSelect).toHaveBeenLastCalledWith(1);

      rerender(renderWith(1));
      const card1After = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(card1After).toHaveAttribute("aria-pressed", "true");
      expect(card1After).toHaveAttribute("aria-current", "true");
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveAttribute("aria-pressed", "false");

      rerender(renderWith(2));
      const card3Sel = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      card3Sel.focus();
      expect(card3Sel).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
    });

    it("ArrowLeft retrocede e faz wrap-around do índice 0 para o último", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      render(
        <MagicUpVariationComparator variations={navVariations} activeIndex={0} onSelect={onSelect} onSelectWinner={onSelectWinner} />
      );

      const card1A = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1A.focus();
      expect(card1A).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(onSelect).toHaveBeenLastCalledWith(2);

      onSelect.mockClear();
      const card3B = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      card3B.focus();
      expect(card3B).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(onSelect).toHaveBeenLastCalledWith(1);
    });

    it("ArrowUp/ArrowDown comportam-se como ArrowLeft/ArrowRight (eixo vertical equivalente)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      render(
        <MagicUpVariationComparator variations={navVariations} activeIndex={1} onSelect={onSelect} onSelectWinner={onSelectWinner} />
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      card1.focus();
      expect(card1).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(onSelect).toHaveBeenLastCalledWith(2);

      onSelect.mockClear();
      card1.focus();
      expect(card1).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
    });

    it("Home vai para o primeiro índice e End vai para o último", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      render(
        <MagicUpVariationComparator variations={navVariations} activeIndex={1} onSelect={onSelect} onSelectWinner={onSelectWinner} />
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      card1.focus();
      expect(card1).toHaveFocus();
      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenLastCalledWith(0);

      onSelect.mockClear();
      card1.focus();
      expect(card1).toHaveFocus();
      await user.keyboard("{End}");
      expect(onSelect).toHaveBeenLastCalledWith(2);
    });

    it("Tab/Enter/Space/letras não chamam onSelect nem onSelectWinner via handleArrowKey", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      render(
        <MagicUpVariationComparator variations={navVariations} activeIndex={0} onSelect={onSelect} onSelectWinner={onSelectWinner} />
      );

      const card0 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card0.focus();
      expect(card0).toHaveFocus();

      await user.keyboard("a");
      expect(card0).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(card0).toHaveFocus();
      await user.keyboard("{PageDown}");
      expect(onSelect).not.toHaveBeenCalled();

      expect(card0).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Tab percorre os 3 cards e botões 'Marcar vencedora' em ordem DOM, Shift+Tab faz o reverso", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <>
            <button data-testid="before-sentinel">antes</button>
            <MagicUpVariationComparator
              variations={navVariations}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onSelectWinner={onSelectWinner}
            />
            <button data-testid="after-sentinel">depois</button>
          </>
        );
      }

      render(<ControlledWrapper />);

      const beforeSentinel = screen.getByTestId("before-sentinel");
      const afterSentinel = screen.getByTestId("after-sentinel");
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      const winner1 = screen.getByRole("button", { name: /Marcar variação 1 como vencedora/ });
      const winner2 = screen.getByRole("button", { name: /Marcar variação 2 como vencedora/ });
      const winner3 = screen.getByRole("button", { name: /Marcar variação 3 como vencedora/ });

      // ── Tab: ordem direta ──
      beforeSentinel.focus();
      expect(beforeSentinel).toHaveFocus();

      const expectedForwardSequence = [card1, winner1, card2, winner2, card3, winner3, afterSentinel];
      for (const expected of expectedForwardSequence) {
        await user.tab();
        expect(expected).toHaveFocus();
      }

      // ── Shift+Tab: ordem reversa ──
      const expectedReverseSequence = [winner3, card3, winner2, card2, winner1, card1, beforeSentinel];
      for (const expected of expectedReverseSequence) {
        await user.tab({ shift: true });
        expect(expected).toHaveFocus();
      }

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Tab move foco sem alterar aria-pressed; mudança externa de activeIndex sincroniza ARIA em todos os cards", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();
      let setActiveIndexExternal: ((i: number) => void) | null = null;

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        setActiveIndexExternal = setActiveIndex;
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={onSelectWinner}
          />
        );
      }

      render(<ControlledWrapper />);

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });

      // Estado inicial
      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card1).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card3).toHaveAttribute("aria-pressed", "false");
      expect(card3).not.toHaveAttribute("aria-current");

      // Tab até card2: foco muda, ARIA NÃO muda
      card1.focus();
      expect(card1).toHaveFocus();
      await user.tab(); // → winner1
      await user.tab(); // → card2
      expect(card2).toHaveFocus();

      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card1).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");

      // Tab até card3: ARIA continua imutável
      await user.tab(); // → winner2
      await user.tab(); // → card3
      expect(card3).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card3).toHaveAttribute("aria-pressed", "false");

      // Mudança externa de activeIndex → 2
      await act(async () => {
        setActiveIndexExternal!(2);
      });

      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card1).not.toHaveAttribute("aria-current");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card3).toHaveAttribute("aria-pressed", "true");
      expect(card3).toHaveAttribute("aria-current", "true");

      const pressedCount = [card1, card2, card3].filter(
        (c) => c.getAttribute("aria-pressed") === "true"
      ).length;
      expect(pressedCount).toBe(1);

      // Mudança externa para card2
      await act(async () => {
        setActiveIndexExternal!(1);
      });

      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");
      expect(card3).toHaveAttribute("aria-pressed", "false");
      expect(card3).not.toHaveAttribute("aria-current");

      // Foco preservado durante mudança externa
      expect(card3).toHaveFocus();

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("hierarquia acessível: cards e botões 'Marcar vencedora' expõem role=button com nomes únicos e dinâmicos", async () => {
      const onSelectWinner = vi.fn();
      let setActiveIndexExternal: ((i: number) => void) | null = null;

      const variationsWithWinner = navVariations.map((v, i) =>
        i === 1 ? { ...v, isWinner: true } : v
      );

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        setActiveIndexExternal = setActiveIndex;
        return (
          <MagicUpVariationComparator
            variations={variationsWithWinner}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={onSelectWinner}
          />
        );
      }

      render(<ControlledWrapper />);

      // 1) Estrutura semântica: list + listitems
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
      const listitems = within(list).getAllByRole("listitem");
      expect(listitems).toHaveLength(variationsWithWinner.length);

      // 2) Contagem exata: N cards + N botões "Marcar vencedora"
      const allButtonsInList = within(list).getAllByRole("button");
      expect(allButtonsInList).toHaveLength(variationsWithWinner.length * 2);

      // 3) Cards expostos como role=button com accessible name único
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });

      expect(card1.tagName).toBe("BUTTON");
      expect(card2.tagName).toBe("BUTTON");
      expect(card3.tagName).toBe("BUTTON");

      const cardNames = [card1, card2, card3].map((c) => c.getAttribute("aria-label"));
      expect(new Set(cardNames).size).toBe(3);

      // 4) Card vencedor tem rótulo com "melhor score"
      expect(card2.getAttribute("aria-label")).toMatch(/melhor score/i);
      expect(card1.getAttribute("aria-label")).not.toMatch(/melhor score/i);
      expect(card3.getAttribute("aria-label")).not.toMatch(/melhor score/i);

      // 5) Score mencionado no accessible name
      expect(card1.getAttribute("aria-label")).toMatch(/score/i);
      expect(card2.getAttribute("aria-label")).toMatch(/score/i);
      expect(card3.getAttribute("aria-label")).toMatch(/score/i);

      // 6) Botões "Marcar vencedora" — nomes únicos e distintos dos cards
      const winner1 = screen.getByRole("button", { name: /Marcar variação 1 como vencedora/ });
      const winner2 = screen.getByRole("button", { name: /Marcar variação 2 como vencedora/ });
      const winner3 = screen.getByRole("button", { name: /Marcar variação 3 como vencedora/ });

      expect(winner1.tagName).toBe("BUTTON");
      expect(winner2.tagName).toBe("BUTTON");
      expect(winner3.tagName).toBe("BUTTON");

      const winnerNames = [winner1, winner2, winner3].map(
        (w) => w.getAttribute("aria-label") ?? w.textContent
      );
      const allNames = [...cardNames, ...winnerNames];
      expect(new Set(allNames).size).toBe(6);

      expect(winner1).not.toBe(card1);
      expect(winner2).not.toBe(card2);
      expect(winner3).not.toBe(card3);

      // 7) Pareamento card↔winner por listitem
      // eslint-disable-next-line no-restricted-syntax
      listitems.forEach((item, idx) => {
        const buttonsInItem = within(item).getAllByRole("button");
        expect(buttonsInItem).toHaveLength(2);

        const selectBtn = within(item).getByRole("button", {
          name: new RegExp(`^Selecionar variação ${idx + 1}`),
        });
        const winnerBtn = within(item).getByRole("button", {
          name: new RegExp(`Marcar variação ${idx + 1} como vencedora`),
        });
        expect(selectBtn).toBeInTheDocument();
        expect(winnerBtn).toBeInTheDocument();
      });

      // 8) Card ativo descobrível via role + aria-pressed
      const pressedButtons = within(list)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressedButtons).toHaveLength(1);
      expect(pressedButtons[0]).toBe(card1);

      // 9) Mudança de activeIndex re-anuncia o card correto
      await act(async () => {
        setActiveIndexExternal!(2);
      });

      const pressedAfter = within(list)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressedAfter).toHaveLength(1);
      expect(pressedAfter[0]).toBe(card3);

      // 10) aria-label estável após mudança de seleção
      expect(card1.getAttribute("aria-label")).toBe(cardNames[0]);
      expect(card2.getAttribute("aria-label")).toBe(cardNames[1]);
      expect(card3.getAttribute("aria-label")).toBe(cardNames[2]);

      // 11) Sem roles indevidos dentro dos listitems
      // eslint-disable-next-line no-restricted-syntax
      listitems.forEach((item) => {
        const interactiveRoles = ["link", "checkbox", "radio", "tab", "menuitem"];
        // eslint-disable-next-line no-restricted-syntax
        interactiveRoles.forEach((role) => {
          expect(within(item).queryAllByRole(role)).toHaveLength(0);
        });
      });

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("aria-label omite 'score' quando qualityScore/qualityDiagnosis.total ausentes; consistência winner/não-winner preservada", async () => {
      const onSelectWinner = vi.fn();

      // Fixture: 4 variações cobrindo matriz {score: ausente | 0 | 85} × {winner: false | true}
      const matrixVariations = [
        // 0: sem score, não-winner
        { ...navVariations[0], qualityScore: undefined, qualityDiagnosis: undefined, isWinner: false },
        // 1: sem score, winner
        { ...navVariations[0], id: "var-no-score-winner", qualityScore: undefined, qualityDiagnosis: undefined, isWinner: true },
        // 2: com score 0 (caso-limite — zero é válido), não-winner
        { ...navVariations[0], id: "var-score-zero", qualityScore: 0, qualityDiagnosis: undefined, isWinner: false },
        // 3: com score 85, não-winner
        { ...navVariations[0], id: "var-score-85", qualityScore: 85, qualityDiagnosis: undefined, isWinner: false },
      ];

      render(
        <MagicUpVariationComparator
          variations={matrixVariations}
          activeIndex={0}
          onSelect={() => {}}
          onSelectWinner={onSelectWinner}
        />
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      const card4 = screen.getByRole("button", { name: /^Selecionar variação 4/ });

      const label1 = card1.getAttribute("aria-label") ?? "";
      const label2 = card2.getAttribute("aria-label") ?? "";
      const label3 = card3.getAttribute("aria-label") ?? "";
      const label4 = card4.getAttribute("aria-label") ?? "";

      // ── 1) Sem score: NÃO contém ", score" nem "score 0" nem "score undefined" ──
      expect(label1).not.toMatch(/,\s*score\s/i);
      expect(label1).not.toMatch(/score\s+0\b/i);
      expect(label1).not.toMatch(/score\s+undefined/i);
      expect(label1).not.toMatch(/score\s+null/i);
      expect(label1).not.toMatch(/score\s+NaN/i);

      expect(label2).not.toMatch(/,\s*score\s/i);
      expect(label2).not.toMatch(/score\s+0\b/i);
      expect(label2).not.toMatch(/score\s+undefined/i);

      // ── 2) Score 0 É anunciado (zero é dado válido, não ausência) ──
      expect(label3).toMatch(/score\s+0\b/i);

      // ── 3) Score 85 é anunciado normalmente ──
      expect(label4).toMatch(/score\s+85\b/i);

      // ── 4) Winner sem score MANTÉM sufixo "melhor score" ──
      expect(label2).toMatch(/melhor score/i);
      expect(label1).not.toMatch(/melhor score/i);
      expect(label3).not.toMatch(/melhor score/i);
      expect(label4).not.toMatch(/melhor score/i);

      // ── 5) Consistência estrutural: prefixo idêntico ──
      expect(label1).toMatch(/^Selecionar variação 1/);
      expect(label2).toMatch(/^Selecionar variação 2/);
      expect(label3).toMatch(/^Selecionar variação 3/);
      expect(label4).toMatch(/^Selecionar variação 4/);

      // ── 6) Winner sem score = prefixo + ", melhor score" ──
      expect(label2).toBe("Selecionar variação 2, melhor score");

      // ── 7) Não-winner sem score = APENAS prefixo ──
      expect(label1).toBe("Selecionar variação 1");

      // ── 8) Não-winner com score 0 = prefixo + ", score 0" ──
      expect(label3).toBe("Selecionar variação 3, score 0");

      // ── 9) Não-winner com score 85 = prefixo + ", score 85" ──
      expect(label4).toBe("Selecionar variação 4, score 85");

      // ── 10) Sem espaços duplos, vírgulas órfãs ou sufixos vazios ──
      // eslint-disable-next-line no-restricted-syntax
      [label1, label2, label3, label4].forEach((label) => {
        expect(label).not.toMatch(/\s{2,}/);
        expect(label).not.toMatch(/,\s*,/);
        expect(label).not.toMatch(/,\s*$/);
        expect(label.trim()).toBe(label);
      });

      // ── 11) Sem "score —" no rótulo (placeholder visual não vaza para a11y) ──
      expect(label1).not.toMatch(/score\s+—/);
      expect(label2).not.toMatch(/score\s+—/);

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("auto-scroll: setas/Home/End disparam scrollIntoView com block:nearest e behavior:smooth", async () => {
      const user = userEvent.setup();
      const scrollSpy = vi.fn();
      const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
      window.HTMLElement.prototype.scrollIntoView = scrollSpy;

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      try {
        function ControlledWrapper() {
          const [activeIndex, setActiveIndex] = React.useState(0);
          return (
            <MagicUpVariationComparator
              variations={navVariations}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onSelectWinner={vi.fn()}
            />
          );
        }
        render(<ControlledWrapper />);

        const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
        card1.focus();
        scrollSpy.mockClear();

        await user.keyboard("{ArrowRight}");
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });

        scrollSpy.mockClear();
        await user.keyboard("{End}");
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith(
          expect.objectContaining({ block: "nearest", behavior: "smooth" })
        );

        scrollSpy.mockClear();
        await user.keyboard("{Home}");
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith(
          expect.objectContaining({ block: "nearest", behavior: "smooth" })
        );
      } finally {
        window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
        window.matchMedia = originalMatchMedia;
      }
    });

    it("auto-scroll respeita prefers-reduced-motion: behavior vira 'auto' (instantâneo)", async () => {
      const user = userEvent.setup();
      const scrollSpy = vi.fn();
      const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
      window.HTMLElement.prototype.scrollIntoView = scrollSpy;

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;

      try {
        render(
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={vi.fn()}
            onSelectWinner={vi.fn()}
          />
        );
        const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
        card1.focus();
        scrollSpy.mockClear();

        await user.keyboard("{ArrowRight}");
        expect(scrollSpy).toHaveBeenCalledWith({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        });

        scrollSpy.mockClear();
        await user.click(screen.getByRole("button", { name: /^Selecionar variação 3/ }));
        expect(scrollSpy).not.toHaveBeenCalled();
      } finally {
        window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
        window.matchMedia = originalMatchMedia;
      }
    });

    it("Enter após navegar com seta seleciona a variação focada (não a anterior)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={vi.fn()}
        />
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1.focus();
      expect(card1).toHaveFocus();
      onSelect.mockClear();

      await user.keyboard("{ArrowRight}");
      expect(onSelect).toHaveBeenLastCalledWith(1);
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(card2).toHaveFocus();

      onSelect.mockClear();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(1);
      expect(onSelect).not.toHaveBeenCalledWith(0);

      onSelect.mockClear();
      await user.keyboard("{ArrowRight}");
      expect(onSelect).toHaveBeenLastCalledWith(2);
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      expect(card3).toHaveFocus();

      onSelect.mockClear();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(2);
      expect(onSelect).not.toHaveBeenCalledWith(1);
    });

    it("Espaço após Home/End ativa card focado, previne scroll e respeita índice", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={vi.fn()}
        />
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1.focus();
      onSelect.mockClear();

      await user.keyboard("{End}");
      const lastIndex = navVariations.length - 1;
      expect(onSelect).toHaveBeenLastCalledWith(lastIndex);
      const lastCard = screen.getByRole("button", {
        name: new RegExp(`^Selecionar variação ${lastIndex + 1}`),
      });
      expect(lastCard).toHaveFocus();

      onSelect.mockClear();
      await user.keyboard(" ");
      expect(onSelect).toHaveBeenCalledWith(lastIndex);

      onSelect.mockClear();
      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(card1).toHaveFocus();

      onSelect.mockClear();
      await user.keyboard(" ");
      expect(onSelect).toHaveBeenCalledWith(0);
      expect(onSelect).not.toHaveBeenCalledWith(lastIndex);
    });

    it("Home e End movem foco e atualizam activeIndex independentemente da posição inicial", async () => {
      const user = userEvent.setup();

      function ControlledWrapper({ initial }: { initial: number }) {
        const [activeIndex, setActiveIndex] = React.useState(initial);
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={vi.fn()}
          />
        );
      }

      const total = navVariations.length;
      const lastIndex = total - 1;
      const middleIndex = Math.floor((total - 1) / 2);

      // ── Cenário A: partindo do meio, End vai para último ──
      const { unmount } = render(<ControlledWrapper initial={middleIndex} />);

      const middleCard = screen.getByRole("button", {
        name: new RegExp(`^Selecionar variação ${middleIndex + 1}`),
      });
      middleCard.focus();
      expect(middleCard).toHaveFocus();
      expect(middleCard).toHaveAttribute("aria-pressed", "true");

      await user.keyboard("{End}");
      const lastCard = screen.getByRole("button", {
        name: new RegExp(`^Selecionar variação ${lastIndex + 1}`),
      });
      expect(lastCard).toHaveFocus();
      expect(lastCard).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^Selecionar variação ${middleIndex + 1}`),
        })
      ).toHaveAttribute("aria-pressed", "false");

      // ── Home a partir do último vai direto para card 1 (não decrementa) ──
      await user.keyboard("{Home}");
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(card1).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(lastCard).toHaveAttribute("aria-pressed", "false");

      unmount();

      // ── Cenário B: partindo do último, Home vai para card 1 (sem passos intermediários) ──
      render(<ControlledWrapper initial={lastIndex} />);
      const lastCardB = screen.getByRole("button", {
        name: new RegExp(`^Selecionar variação ${lastIndex + 1}`),
      });
      lastCardB.focus();
      expect(lastCardB).toHaveFocus();

      await user.keyboard("{Home}");
      const card1B = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(card1B).toHaveFocus();
      expect(card1B).toHaveAttribute("aria-pressed", "true");

      // End a partir do card 1 → último
      await user.keyboard("{End}");
      const lastCardB2 = screen.getByRole("button", {
        name: new RegExp(`^Selecionar variação ${lastIndex + 1}`),
      });
      expect(lastCardB2).toHaveFocus();
      expect(lastCardB2).toHaveAttribute("aria-pressed", "true");
      expect(card1B).toHaveAttribute("aria-pressed", "false");
    });

    it("aria-pressed permanece exclusivo (1 ativo) em sequência de setas, Home, End e wrap-around", async () => {
      const user = userEvent.setup();

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={vi.fn()}
          />
        );
      }

      render(<ControlledWrapper />);
      const total = navVariations.length;

      const getActiveCardIndex = (): number => {
        const cards = screen.getAllByRole("button", { name: /^Selecionar variação/ });
        const activeCards = cards.filter((c) => c.getAttribute("aria-pressed") === "true");
        expect(activeCards).toHaveLength(1);
        const match = activeCards[0].getAttribute("aria-label")?.match(/variação (\d+)/);
        return Number(match?.[1] ?? 0);
      };

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1.focus();
      expect(getActiveCardIndex()).toBe(1);

      for (let step = 1; step <= total + 1; step++) {
        await user.keyboard("{ArrowRight}");
        const expectedActive = (step % total) + 1;
        expect(getActiveCardIndex()).toBe(expectedActive);
        const activeByLabel = screen.getByRole("button", {
          name: new RegExp(`^Selecionar variação ${expectedActive}`),
        });
        expect(activeByLabel).toHaveFocus();
      }

      for (let step = 1; step <= total + 1; step++) {
        await user.keyboard("{ArrowLeft}");
        expect(getActiveCardIndex()).toBeGreaterThanOrEqual(1);
        expect(getActiveCardIndex()).toBeLessThanOrEqual(total);
      }

      await user.keyboard("{Home}");
      expect(getActiveCardIndex()).toBe(1);

      await user.keyboard("{End}");
      expect(getActiveCardIndex()).toBe(total);

      const winnerButtons = screen.queryAllByRole("button", { name: /vencedora/i });
      expect(winnerButtons).not.toHaveLength(0);
      // eslint-disable-next-line no-restricted-syntax
      winnerButtons.forEach((btn) => {
        const labelStartsWithSelecionar = btn.getAttribute("aria-label")?.startsWith("Selecionar");
        if (!labelStartsWithSelecionar) {
          expect(btn.hasAttribute("aria-pressed")).toBe(false);
        }
      });

      const sequence = ["{ArrowRight}", "{Home}", "{End}", "{ArrowLeft}", "{ArrowLeft}", "{End}"];
      for (const key of sequence) {
        await user.keyboard(key);
        getActiveCardIndex();
      }
    });

    it("Shift+Tab navega na ordem inversa entre cards e botões 'Marcar vencedora' mantendo focus-visible", async () => {
      const user = userEvent.setup();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={vi.fn()}
          onSelectWinner={vi.fn()}
        />
      );

      const REQUIRED_FOCUS_CLASSES_BASE = [
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
      ];
      const REQUIRED_FOCUS_CLASSES_WINNER = [
        ...REQUIRED_FOCUS_CLASSES_BASE,
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
      ];

      const cards = screen.getAllByRole("button", { name: /^Selecionar variação/ });
      const winnerBtns = screen.getAllByRole("button", { name: /vencedora/i });
      const winnerSet = new Set(winnerBtns);

      const allFocusables = [...cards, ...winnerBtns].sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      expect(allFocusables.length).toBeGreaterThanOrEqual(2);

      const last = allFocusables[allFocusables.length - 1];
      last.focus();
      expect(last).toHaveFocus();

      const expectedClassesFor = (el: Element) =>
        winnerSet.has(el as HTMLElement) ? REQUIRED_FOCUS_CLASSES_WINNER : REQUIRED_FOCUS_CLASSES_BASE;

      // eslint-disable-next-line no-restricted-syntax
      expectedClassesFor(last).forEach((cls) => {
        expect(last.className).toContain(cls);
      });

      for (let i = allFocusables.length - 2; i >= 0; i--) {
        await user.tab({ shift: true });
        const expected = allFocusables[i];
        expect(expected).toHaveFocus();

        // eslint-disable-next-line no-restricted-syntax
        expectedClassesFor(expected).forEach((cls) => {
          expect(expected.className).toContain(cls);
        });

        expect(expected.className).not.toMatch(/(?<!focus-visible:)focus:ring-/);
      }

      expect(allFocusables[0]).toHaveFocus();
    });
  });
});

describe("MagicUpVariationComparator focus-visible classes", () => {
  it("Botão 'Marcar vencedora' expõe ring + ring-offset no foco (WCAG 2.4.7)", () => {
    renderComparator();
    const buttons = select.allMarcar();
    expect(buttons).toHaveLength(3);
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-ring");
      expect(btn.className).toContain("focus-visible:ring-offset-2");
      expect(btn.className).toContain("focus-visible:ring-offset-background");
    }
  });

  it("Card de variação não fica invisível ao foco — outline-none compensado por ring (WCAG 2.4.7)", () => {
    renderComparator();
    const cards = select.allCards();
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.className).toContain("focus-visible:outline-none");
      expect(card.className).toContain("focus-visible:ring-2");
      expect(card.className).toContain("focus-visible:ring-ring");
    }
  });

  it("Estado disabled do botão 'Marcar vencedora' mantém contraste legível (WCAG 1.4.3)", () => {
    renderComparator();
    const buttons = select.allMarcar();
    for (const btn of buttons) {
      expect(btn.className).toContain("disabled:bg-muted");
      expect(btn.className).toContain("disabled:text-muted-foreground");
      expect(btn.className).toContain("disabled:opacity-100");
    }
  });

  it("Tab atravessa cards e botões 'Marcar vencedora' alternadamente; cada parada tem classes focus-visible:ring-2 (WCAG 2.4.7)", async () => {
    const { user } = renderComparator();

    const expectedOrder: Array<{ name: RegExp | string }> = [
      { name: /^Selecionar variação 1/ },
      { name: "Marcar variação 1 como vencedora" },
      { name: /^Selecionar variação 2/ },
      { name: "Marcar variação 2 como vencedora" },
      { name: /^Selecionar variação 3/ },
      { name: "Marcar variação 3 como vencedora" },
    ];

    for (const matcher of expectedOrder) {
      await user.tab();
      const focused = screen.getByRole("button", matcher);
      expect(focused).toHaveFocus();
      expect(focused.className).toContain("focus-visible:ring-2");
      expect(focused.className).toContain("focus-visible:ring-ring");
    }
  });

  it("Cards de seleção aplicam focus-visible:outline-none e são alcançáveis por Tab (sem outline duplicado sobre o ring)", async () => {
    const { user } = renderComparator();

    const cards = select.allCards();
    for (const card of cards) {
      expect(card.className).toContain("focus-visible:outline-none");
    }

    await user.tab();
    expect(cards[0]).toHaveFocus();
    expect(cards[0].className).toContain("focus-visible:ring-2");
  });

  it("Botões 'Marcar vencedora' aplicam ring-2 + ring-offset-2 + ring-offset-background e são alcançados na 2ª parada do Tab (WCAG 1.4.11)", async () => {
    const { user } = renderComparator();

    const marcarBtns = select.allMarcar();
    for (const btn of marcarBtns) {
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-ring");
      expect(btn.className).toContain("focus-visible:ring-offset-2");
      expect(btn.className).toContain("focus-visible:ring-offset-background");
    }

    await user.tab(); // card1
    await user.tab(); // marcar1
    expect(marcarBtns[0]).toHaveFocus();
  });
});

// ─────────────────────────────────────────────────────────────────────
// MagicUpVariationComparator — empate total de scores (determinismo)
// Trava contrato: findIndex retorna primeiro empatado; apenas 1 badge "Melhor score"
// ─────────────────────────────────────────────────────────────────────

describe("MagicUpVariationComparator — empate total de scores (determinismo)", () => {
  function buildVariation(overrides: Partial<VariationItem> = {}, idx = 0): VariationItem {
    return {
      id: `var-${idx}`,
      imageUrl: `https://example.com/img-${idx}.png`,
      isFavorite: false,
      qualityScore: 75,
      isWinner: false,
      ...overrides,
    };
  }

  const renderTied = (variations: VariationItem[]) =>
    render(
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={0}
        onSelect={vi.fn()}
        onSelectWinner={vi.fn()}
      />
    );

  it("empate total com qualityScore=75: renderiza exatamente 1 badge 'Melhor score' nos cards", () => {
    const variations = [0, 1, 2].map((i) => buildVariation({ qualityScore: 75 }, i));
    renderTied(variations);
    // Filtra apenas as badges dos cards (exclui o badge do header "Melhor score: N")
    const cardBadges = screen
      .getAllByLabelText("Melhor score")
      .filter((el) => el.tagName.toLowerCase() !== "div" || !el.textContent?.includes(":"));
    // O badge no header tem aria-label diferente ("Melhor score entre variações: ...")
    // então getAllByLabelText("Melhor score") só pega os badges dentro dos cards
    expect(cardBadges).toHaveLength(1);
  });

  it("empate total: badge 'Melhor score' aparece apenas no card do índice 0", () => {
    const variations = [0, 1, 2].map((i) => buildVariation({ qualityScore: 75 }, i));
    renderTied(variations);
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    const { within } = require("@testing-library/react");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
  });

  it("empate total via qualityDiagnosis.total=90: badge fica no índice 0 (mesmo determinismo)", () => {
    const variations = [0, 1, 2].map((i) =>
      buildVariation({ qualityScore: undefined, qualityDiagnosis: diagnosis(90) }, i)
    );
    renderTied(variations);
    const cards = screen.getAllByRole("listitem");
    const { within } = require("@testing-library/react");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
  });

  it("caso degenerado (todos sem score): bestScore=0, NENHUMA badge em nenhum card", () => {
    const variations = [0, 1, 2].map((i) =>
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, i)
    );
    renderTied(variations);
    const cards = screen.getAllByRole("listitem");
    const { within } = require("@testing-library/react");
    // Novo contrato: hasValidScores = false → winnerIndex = -1 → sem badge em qualquer card
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
    expect(screen.queryAllByLabelText("Melhor score")).toHaveLength(0);
  });

  it("empate parcial [60, 90, 90]: badge no primeiro com bestScore (índice 1), nunca no 2", () => {
    const variations = [
      buildVariation({ qualityScore: 60 }, 0),
      buildVariation({ qualityScore: 90 }, 1),
      buildVariation({ qualityScore: 90 }, 2),
    ];
    renderTied(variations);
    const cards = screen.getAllByRole("listitem");
    const { within } = require("@testing-library/react");
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
  });

  it.each([2, 3, 5])(
    "empate em score válido (75) com %i variações: exatamente 1 badge 'Melhor score', sempre no índice 0",
    (count) => {
      const variations = Array.from({ length: count }, (_, i) =>
        buildVariation({ qualityScore: 75 }, i)
      );
      renderTied(variations);

      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);

      const cards = screen.getAllByRole("listitem");
      expect(cards).toHaveLength(count);
      const { within } = require("@testing-library/react");
      expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
      for (let i = 1; i < count; i++) {
        expect(within(cards[i]).queryByLabelText("Melhor score")).toBeNull();
      }
    }
  );

  it("nenhum score (todos undefined): badge 'Melhor score' não aparece em nenhum card e nenhum aria-label menciona vencedor", () => {
    const variations = [
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 0),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 1),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 2),
    ];
    renderTied(variations);

    // Nenhuma badge "Melhor score" nos cards
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    // eslint-disable-next-line no-restricted-syntax
    cards.forEach((card) => {
      expect(within(card).queryByLabelText("Melhor score")).toBeNull();
    });

    // Nenhum aria-label de botão menciona "melhor score" nem "score N"
    for (let i = 1; i <= 3; i++) {
      const btn = screen.getByRole("button", { name: new RegExp(`Selecionar variação ${i}`) });
      const label = btn.getAttribute("aria-label") || "";
      expect(label).not.toContain("melhor score");
      expect(label).not.toMatch(/score \d/);
    }

    // Badge global do header mostra "—" (placeholder)
    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: —");
  });

  it("isWinner=true em índice 0 com score menor (50) vence sobre índice 1 com score maior (90)", () => {
    const variations = [
      buildVariation({ qualityScore: 50, isWinner: true }, 0),
      buildVariation({ qualityScore: 90 }, 1),
      buildVariation({ qualityScore: 70 }, 2),
    ];
    renderTied(variations);

    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    const winnerBtn = screen.getByRole("button", { name: /Selecionar variação 1/ });
    expect(winnerBtn.getAttribute("aria-label")).toContain("melhor score");
    expect(winnerBtn.getAttribute("aria-label")).toContain("score 50");
  });

  it("isWinner=true em índice 2 com score menor (30) vence sobre índices 0/1 com scores maiores (70/80)", () => {
    const variations = [
      buildVariation({ qualityScore: 70 }, 0),
      buildVariation({ qualityScore: 80 }, 1),
      buildVariation({ qualityScore: 30, isWinner: true }, 2),
    ];
    renderTied(variations);

    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).not.toBeNull();
  });

  it("isWinner=true sem scores válidos: vence mesmo com bestScore=0", () => {
    const variations = [
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 0),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined, isWinner: true }, 1),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 2),
    ];
    renderTied(variations);

    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[1]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: —");
  });

  it("todos com qualityScore=0 (avaliados ruins): bestScore=0, badge no índice 0, header mostra '0' (não '—')", () => {
    const variations = [
      buildVariation({ qualityScore: 0 }, 0),
      buildVariation({ qualityScore: 0 }, 1),
      buildVariation({ qualityScore: 0 }, 2),
    ];
    renderTied(variations);

    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    // Header mostra o "0" real (não placeholder "—")
    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: 0");

    // aria-label do vencedor inclui "score 0" explícito
    const winnerBtn = screen.getByRole("button", { name: /Selecionar variação 1/ });
    expect(winnerBtn.getAttribute("aria-label")).toContain("score 0");
    expect(winnerBtn.getAttribute("aria-label")).toContain("melhor score");
  });

  it("mix de null e numéricos [null, 60, null, 40]: vencedor é o numérico maior (índice 1)", () => {
    const variations = [
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 0),
      buildVariation({ qualityScore: 60 }, 1),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined }, 2),
      buildVariation({ qualityScore: 40 }, 3),
    ];
    renderTied(variations);

    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[3]).queryByLabelText("Melhor score")).toBeNull();

    // Cards sem score mostram "—" no aria-label do span de score (Score indisponível)
    expect(within(cards[0]).getByLabelText("Score indisponível")).toBeInTheDocument();
    expect(within(cards[2]).getByLabelText("Score indisponível")).toBeInTheDocument();
    // Cards com score mostram valor numérico
    expect(within(cards[1]).getByLabelText("Score 60 de 100")).toBeInTheDocument();
    expect(within(cards[3]).getByLabelText("Score 40 de 100")).toBeInTheDocument();

    // Header mostra o melhor numérico (60)
    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: 60");
  });

  it("qualityDiagnosis.total=0 tem prioridade absoluta sobre qualityScore=80 (não cai no fallback falsy)", () => {
    const variations = [
      // diagnóstico explícito = 0 deve ser respeitado (não cair em qualityScore=80)
      buildVariation({ qualityDiagnosis: diagnosis(0, "ai"), qualityScore: 80 }, 0),
      buildVariation({ qualityScore: 50 }, 1),
    ];
    renderTied(variations);

    // Variação 1: diagnóstico=0 (não 80) → variação 2 (score 50) é a vencedora
    expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).not.toBeNull();

    // Card 1 expõe score 0 (não 80) — diagnosis tem prioridade
    expect(within(cards[0]).getByLabelText("Score 0 de 100")).toBeInTheDocument();
    expect(within(cards[1]).getByLabelText("Score 50 de 100")).toBeInTheDocument();

    // Header mostra o maior (50)
    expect(screen.getByLabelText(/Melhor score entre variações/)).toHaveTextContent("Melhor score: 50");
  });

  it("invariante defensivo: sem bestScore (todas null) e sem isWinner — nenhuma badge 'Melhor score' renderiza em nenhum card", () => {
    const variations = [
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined, isWinner: false }, 0),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined, isWinner: false }, 1),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined, isWinner: false }, 2),
      buildVariation({ qualityScore: undefined, qualityDiagnosis: undefined, isWinner: false }, 3),
    ];
    renderTied(variations);

    // 1. Zero badges "Melhor score" no DOM inteiro
    expect(screen.queryAllByLabelText("Melhor score")).toHaveLength(0);

    // 2. Cada card individualmente: nenhuma badge
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    // eslint-disable-next-line no-restricted-syntax
    cards.forEach((card) => {
      expect(within(card).queryByLabelText("Melhor score")).toBeNull();
    });

    // 3. Nenhum aria-label de botão menciona "melhor score" nem "score N"
    for (let i = 1; i <= 4; i++) {
      const btn = screen.getByRole("button", { name: new RegExp(`Selecionar variação ${i}`) });
      const label = btn.getAttribute("aria-label") ?? "";
      expect(label).not.toContain("melhor score");
      expect(label).not.toMatch(/, score \d/);
    }

    // 4. Header global mostra "—" (placeholder) e aria-label "indisponível"
    const headerBadge = screen.getByLabelText(/Melhor score entre variações/);
    expect(headerBadge).toHaveTextContent("Melhor score: —");
    expect(headerBadge.getAttribute("aria-label")).toContain("indisponível");

    // 5. Cada card mostra "Score indisponível" no span de score
    // eslint-disable-next-line no-restricted-syntax
    cards.forEach((card) => {
      expect(within(card).getByLabelText("Score indisponível")).toBeInTheDocument();
    });
  });

  it("estabilidade sob permutação: empate triplo (80) — vencedor é sempre o índice 0 do array, independente de qual variação ocupe essa posição", () => {
    const variantA: Partial<VariationItem> = { id: "var-A", qualityScore: 80 };
    const variantB: Partial<VariationItem> = { id: "var-B", qualityScore: 80 };
    const variantC: Partial<VariationItem> = { id: "var-C", qualityScore: 80 };

    const assertWinnerAtIndexZero = () => {
      const badges = screen.getAllByLabelText("Melhor score");
      expect(badges).toHaveLength(1);
      const cards = screen.getAllByRole("listitem");
      expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
      expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
      expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();
    };

    // Permutação 1: [A, B, C] → vencedor = A (índice 0)
    const { unmount: unmount1 } = renderTied([
      buildVariation(variantA, 0),
      buildVariation(variantB, 1),
      buildVariation(variantC, 2),
    ]);
    assertWinnerAtIndexZero();
    unmount1();

    // Permutação 2: [B, A, C] → vencedor = B (índice 0)
    const { unmount: unmount2 } = renderTied([
      buildVariation(variantB, 0),
      buildVariation(variantA, 1),
      buildVariation(variantC, 2),
    ]);
    assertWinnerAtIndexZero();
    unmount2();

    // Permutação 3: [C, B, A] → vencedor = C (índice 0)
    renderTied([
      buildVariation(variantC, 0),
      buildVariation(variantB, 1),
      buildVariation(variantA, 2),
    ]);
    assertWinnerAtIndexZero();
  });

  it("aria-labels completos: cenário com vencedor claro — apenas o card vencedor recebe sufixo ', melhor score'; demais terminam exatamente em ', score N'", () => {
    const variations = [
      buildVariation({ id: "var-A", qualityScore: 60 }, 0),
      buildVariation({ id: "var-B", qualityScore: 95 }, 1), // vencedor
      buildVariation({ id: "var-C", qualityScore: 78 }, 2),
    ];
    renderTied(variations);

    const btn1 = screen.getByRole("button", { name: /Selecionar variação 1/ });
    const btn2 = screen.getByRole("button", { name: /Selecionar variação 2/ });
    const btn3 = screen.getByRole("button", { name: /Selecionar variação 3/ });

    // Match literal completo (string igual, sem regex)
    expect(btn1.getAttribute("aria-label")).toBe("Selecionar variação 1, score 60");
    expect(btn2.getAttribute("aria-label")).toBe("Selecionar variação 2, score 95, melhor score");
    expect(btn3.getAttribute("aria-label")).toBe("Selecionar variação 3, score 78");

    // Validação cruzada: apenas 1 ocorrência de ", melhor score" em todo o DOM de aria-labels
    const allButtons = [btn1, btn2, btn3];
    const labelsWithWinner = allButtons.filter((b) =>
      (b.getAttribute("aria-label") ?? "").includes(", melhor score")
    );
    expect(labelsWithWinner).toHaveLength(1);
    expect(labelsWithWinner[0]).toBe(btn2);

    // Validação defensiva: não-vencedores não terminam com sufixo de winner
    expect(btn1.getAttribute("aria-label")).not.toMatch(/, melhor score$/);
    expect(btn3.getAttribute("aria-label")).not.toMatch(/, melhor score$/);
  });

  it("empate parcial (2 no topo + 1 abaixo): badge 'Melhor score' aparece apenas no primeiro empatado; variação com score menor nunca recebe badge", () => {
    const variations = [
      buildVariation({ id: "var-A", qualityScore: 90 }, 0),
      buildVariation({ id: "var-B", qualityScore: 90 }, 1),
      buildVariation({ id: "var-C", qualityScore: 70 }, 2),
    ];
    renderTied(variations);

    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);

    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    const btn1 = screen.getByRole("button", { name: /Selecionar variação 1/ });
    const btn2 = screen.getByRole("button", { name: /Selecionar variação 2/ });
    const btn3 = screen.getByRole("button", { name: /Selecionar variação 3/ });
    expect(btn1.getAttribute("aria-label")).toBe("Selecionar variação 1, score 90, melhor score");
    expect(btn2.getAttribute("aria-label")).toBe("Selecionar variação 2, score 90");
    expect(btn3.getAttribute("aria-label")).toBe("Selecionar variação 3, score 70");

    expect(screen.getByLabelText(/Melhor score entre variações: 90/)).toBeInTheDocument();
  });

  it("empate parcial com permutação: ordem [C=70, A=90, B=90] → winner determinístico no índice 1 (primeiro empatado no maior score)", () => {
    const variations = [
      buildVariation({ id: "var-C", qualityScore: 70 }, 0),
      buildVariation({ id: "var-A", qualityScore: 90 }, 1),
      buildVariation({ id: "var-B", qualityScore: 90 }, 2),
    ];
    renderTied(variations);

    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);

    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    const btn1 = screen.getByRole("button", { name: /Selecionar variação 1/ });
    const btn2 = screen.getByRole("button", { name: /Selecionar variação 2/ });
    const btn3 = screen.getByRole("button", { name: /Selecionar variação 3/ });
    expect(btn1.getAttribute("aria-label")).toBe("Selecionar variação 1, score 70");
    expect(btn2.getAttribute("aria-label")).toBe("Selecionar variação 2, score 90, melhor score");
    expect(btn3.getAttribute("aria-label")).toBe("Selecionar variação 3, score 90");
  });

  it("cardinalidade do sufixo 'melhor score' em empate: exatamente 1 aria-label contém o sufixo; demais não contêm em nenhuma posição", () => {
    const variations = [
      buildVariation({ id: "var-A", qualityScore: 85 }, 0),
      buildVariation({ id: "var-B", qualityScore: 85 }, 1),
      buildVariation({ id: "var-C", qualityScore: 85 }, 2),
    ];
    renderTied(variations);

    const allSelectButtons = screen.getAllByRole("button", { name: /^Selecionar variação \d+/ });
    expect(allSelectButtons).toHaveLength(3);

    const withWinnerSuffix = allSelectButtons.filter((btn) =>
      (btn.getAttribute("aria-label") ?? "").includes(", melhor score")
    );
    expect(withWinnerSuffix).toHaveLength(1);

    expect(withWinnerSuffix[0].getAttribute("aria-label")).toBe(
      "Selecionar variação 1, score 85, melhor score"
    );

    const withoutWinnerSuffix = allSelectButtons.filter((btn) =>
      !(btn.getAttribute("aria-label") ?? "").includes(", melhor score")
    );
    expect(withoutWinnerSuffix).toHaveLength(2);
    // eslint-disable-next-line no-restricted-syntax
    withoutWinnerSuffix.forEach((btn) => {
      const label = btn.getAttribute("aria-label") ?? "";
      expect(label).not.toContain("melhor score");
      expect(label).not.toMatch(/melhor/i);
    });

    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);
  });

  it("determinismo por ordem em empate: mesmos ids+scores em ordens diferentes → winner segue o array, sem depender de isWinner", () => {
    const baseVariations = [
      buildVariation({ id: "var-X", qualityScore: 88 }, 0),
      buildVariation({ id: "var-Y", qualityScore: 88 }, 1),
      buildVariation({ id: "var-Z", qualityScore: 88 }, 2),
    ];
    // eslint-disable-next-line no-restricted-syntax
    baseVariations.forEach((v) => {
      expect(v.isWinner).toBeFalsy();
    });

    const { unmount: unmount1 } = renderTied(baseVariations);
    const badges1 = screen.getAllByLabelText("Melhor score");
    expect(badges1).toHaveLength(1);
    const cards1 = screen.getAllByRole("listitem");
    expect(within(cards1[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards1[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards1[2]).queryByLabelText("Melhor score")).toBeNull();
    unmount1();

    const reordered = [
      buildVariation({ id: "var-Z", qualityScore: 88 }, 0),
      buildVariation({ id: "var-X", qualityScore: 88 }, 1),
      buildVariation({ id: "var-Y", qualityScore: 88 }, 2),
    ];
    // eslint-disable-next-line no-restricted-syntax
    reordered.forEach((v) => {
      expect(v.isWinner).toBeFalsy();
    });
    const { unmount: unmount2 } = renderTied(reordered);
    const badges2 = screen.getAllByLabelText("Melhor score");
    expect(badges2).toHaveLength(1);
    const cards2 = screen.getAllByRole("listitem");
    expect(within(cards2[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards2[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards2[2]).queryByLabelText("Melhor score")).toBeNull();
    unmount2();

    const reordered2 = [
      buildVariation({ id: "var-Y", qualityScore: 88 }, 0),
      buildVariation({ id: "var-Z", qualityScore: 88 }, 1),
      buildVariation({ id: "var-X", qualityScore: 88 }, 2),
    ];
    renderTied(reordered2);
    const cards3 = screen.getAllByRole("listitem");
    expect(within(cards3[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards3[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards3[2]).queryByLabelText("Melhor score")).toBeNull();

    const winnerBtn = screen.getByRole("button", { name: /Selecionar variação 1, score 88, melhor score/ });
    expect(winnerBtn).toBeInTheDocument();
  });

  it("empate triplo sem isWinner: renderiza exatamente 1 badge 'Melhor score' no primeiro índice", () => {
    const variations = [
      buildVariation({ id: "var-1", qualityScore: 75 }, 0),
      buildVariation({ id: "var-2", qualityScore: 75 }, 1),
      buildVariation({ id: "var-3", qualityScore: 75 }, 2),
    ];

    // eslint-disable-next-line no-restricted-syntax
    variations.forEach((v) => {
      expect(v.isWinner).toBeFalsy();
    });

    renderTied(variations);

    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);

    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    const winnerBtn = screen.getByRole("button", {
      name: "Selecionar variação 1, score 75, melhor score",
    });
    expect(winnerBtn).toBeInTheDocument();

    expect(screen.getByLabelText(/Melhor score entre variações: 75/)).toBeInTheDocument();
  });

  it("snapshot estrutural: empate triplo renderiza DOM estável com exatamente 1 badge 'Melhor score'", () => {
    const variations = [
      buildVariation({ id: "var-snap-1", qualityScore: 80 }, 0),
      buildVariation({ id: "var-snap-2", qualityScore: 80 }, 1),
      buildVariation({ id: "var-snap-3", qualityScore: 80 }, 2),
    ];
    const { container } = renderTied(variations);

    // 1. Assertions defensivas (independentes do snapshot)
    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);

    // 2. Snapshot estrutural focado: extrai apenas a região de badges + scores
    const comparatorSection = container.querySelector('[aria-label="Comparador de variações"]');
    expect(comparatorSection).not.toBeNull();

    const structuralSummary = Array.from(listItems).map((item, idx) => {
      const badge = item.querySelector('[aria-label="Melhor score"]');
      const scoreSpan = item.querySelector('[aria-label^="Score"]');
      return {
        index: idx,
        hasBadge: badge !== null,
        badgeText: badge?.textContent?.trim() ?? null,
        scoreLabel: scoreSpan?.getAttribute("aria-label") ?? null,
        ariaPressed: item.querySelector('button[aria-pressed]')?.getAttribute("aria-pressed") ?? null,
      };
    });

    expect(structuralSummary).toMatchInlineSnapshot(`
      [
        {
          "ariaPressed": "true",
          "badgeText": "Melhor score",
          "hasBadge": true,
          "index": 0,
          "scoreLabel": "Score 80 de 100",
        },
        {
          "ariaPressed": "false",
          "badgeText": null,
          "hasBadge": false,
          "index": 1,
          "scoreLabel": "Score 80 de 100",
        },
        {
          "ariaPressed": "false",
          "badgeText": null,
          "hasBadge": false,
          "index": 2,
          "scoreLabel": "Score 80 de 100",
        },
      ]
    `);

    // 3. Snapshot do header (bestScore badge) — região independente
    const header = container.querySelector('[aria-label^="Melhor score entre variações"]');
    expect(header?.getAttribute("aria-label")).toMatchInlineSnapshot(
      `"Melhor score entre variações: 80"`
    );
  });

  it("dois isWinner: true simultâneos: apenas o primeiro marcado recebe badge (findIndex determinístico)", () => {
    const variations = [
      buildVariation({ id: "var-A", qualityScore: 60, isWinner: true }, 0),
      buildVariation({ id: "var-B", qualityScore: 95, isWinner: false }, 1),
      buildVariation({ id: "var-C", qualityScore: 80, isWinner: true }, 2),
    ];

    expect(variations.filter((v) => v.isWinner === true)).toHaveLength(2);
    expect(variations[0].isWinner).toBe(true);
    expect(variations[2].isWinner).toBe(true);

    renderTied(variations);

    const badges = screen.getAllByLabelText("Melhor score");
    expect(badges).toHaveLength(1);

    const cards = screen.getAllByRole("listitem");
    expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
    expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
    expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

    const winnerBtn = screen.getByRole("button", {
      name: "Selecionar variação 1, score 60, melhor score",
    });
    expect(winnerBtn).toBeInTheDocument();

    const varBBtn = screen.getByRole("button", {
      name: "Selecionar variação 2, score 95",
    });
    expect(varBBtn).toBeInTheDocument();

    const varCBtn = screen.getByRole("button", {
      name: "Selecionar variação 3, score 80",
    });
    expect(varCBtn).toBeInTheDocument();

    const allSelectButtons = screen.getAllByRole("button", { name: /^Selecionar variação/ });
    const withSuffix = allSelectButtons.filter((btn) =>
      (btn.getAttribute("aria-label") ?? "").includes("melhor score")
    );
    expect(withSuffix).toHaveLength(1);

    expect(screen.getByLabelText(/Melhor score entre variações: 95/)).toBeInTheDocument();
  });

  it.each([
    { label: "menor índice tem menor score", scoreA: 10, scoreC: 99 },
    { label: "menor índice tem maior score", scoreA: 99, scoreC: 10 },
    { label: "ambos têm o mesmo score", scoreA: 50, scoreC: 50 },
  ])(
    "múltiplos isWinner: true — vencedor é sempre o de menor índice ($label)",
    ({ scoreA, scoreC }) => {
      const variations = [
        buildVariation({ id: "var-A", qualityScore: scoreA, isWinner: true }, 0),
        buildVariation({ id: "var-B", qualityScore: 50, isWinner: false }, 1),
        buildVariation({ id: "var-C", qualityScore: scoreC, isWinner: true }, 2),
      ];

      expect(variations.filter((v) => v.isWinner === true)).toHaveLength(2);
      expect(variations[0].isWinner).toBe(true);
      expect(variations[2].isWinner).toBe(true);

      renderTied(variations);

      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);

      const cards = screen.getAllByRole("listitem");
      expect(within(cards[0]).queryByLabelText("Melhor score")).not.toBeNull();
      expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
      expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

      const winnerBtn = screen.getByRole("button", {
        name: `Selecionar variação 1, score ${scoreA}, melhor score`,
      });
      expect(winnerBtn).toBeInTheDocument();

      const varCBtn = screen.getByRole("button", {
        name: `Selecionar variação 3, score ${scoreC}`,
      });
      expect(varCBtn).toBeInTheDocument();

      const allSelectButtons = screen.getAllByRole("button", { name: /^Selecionar variação/ });
      const withSuffix = allSelectButtons.filter((btn) =>
        (btn.getAttribute("aria-label") ?? "").includes("melhor score")
      );
      expect(withSuffix).toHaveLength(1);

      // 6. Verificações negativas dirigidas a var-C (segundo isWinner: true que perde)
      const varCCard = cards[2];
      expect(within(varCCard).queryByLabelText("Melhor score")).toBeNull();
      expect(within(varCCard).queryByText("Melhor score")).toBeNull();

      const varCButton = within(varCCard).getByRole("button", { name: /^Selecionar variação 3/ });
      expect(varCButton.getAttribute("aria-label")).not.toMatch(/melhor score/);
      expect(varCButton.getAttribute("aria-label")).toBe(`Selecionar variação 3, score ${scoreC}`);
      expect(varCButton).toHaveAttribute("aria-pressed", "false");
      expect(varCButton).not.toHaveAttribute("aria-current");

      const varBCard = cards[1];
      expect(within(varBCard).queryByLabelText("Melhor score")).toBeNull();
      const varBButton = within(varBCard).getByRole("button", { name: /^Selecionar variação 2/ });
      expect(varBButton.getAttribute("aria-label")).not.toMatch(/melhor score/);
      expect(varBButton.getAttribute("aria-label")).toBe("Selecionar variação 2, score 50");

      const winnerButtons = screen
        .getAllByRole("button", { name: /^Selecionar variação/ })
        .filter((btn) => (btn.getAttribute("aria-label") ?? "").endsWith(", melhor score"));
      expect(winnerButtons).toHaveLength(1);
      expect(winnerButtons[0].getAttribute("aria-label")).toBe(
        `Selecionar variação 1, score ${scoreA}, melhor score`
      );

      // 7. Auditoria global de cardinalidade — protege contra duplicações em
      //    qualquer parte do DOM acessível (header, listitems, tooltips, sr-only).
      const exactBadgeMatches = screen.getAllByLabelText("Melhor score", { exact: true });
      expect(exactBadgeMatches).toHaveLength(1);

      const headerMatches = screen.getAllByLabelText(/^Melhor score entre variações:/);
      expect(headerMatches).toHaveLength(1);

      const visibleBadgeText = screen.getAllByText("Melhor score", { exact: true });
      expect(visibleBadgeText).toHaveLength(1);

      const allElementsWithSuffix = Array.from(
        document.querySelectorAll("[aria-label]")
      ).filter((el) => (el.getAttribute("aria-label") ?? "").endsWith(", melhor score"));
      expect(allElementsWithSuffix).toHaveLength(1);

      expect(cards[0].contains(exactBadgeMatches[0])).toBe(true);
      expect(cards[0].contains(visibleBadgeText[0])).toBe(true);

      // 8. Contrato literal de aria-labels — espec. executável dos 3 botões
      //    Documenta o formato esperado lado a lado e trava regressões de formato
      //    (vírgulas, espaçamento, ordem dos componentes).

      // 8.1 Mapa do contrato esperado por card (índice → aria-label literal)
      const expectedAriaLabels: Record<number, string> = {
        0: `Selecionar variação 1, score ${scoreA}, melhor score`,
        1: "Selecionar variação 2, score 50",
        2: `Selecionar variação 3, score ${scoreC}`,
      };

      // 8.2 Validação literal por card — cada button deve ter EXATAMENTE o aria-label
      //     definido no contrato, sem caracteres extras, sem espaços a mais.
      // eslint-disable-next-line no-restricted-syntax
      cards.forEach((card, index) => {
        const button = within(card).getByRole("button", { name: /^Selecionar variação/ });
        const ariaLabel = button.getAttribute("aria-label");
        expect(ariaLabel).toBe(expectedAriaLabels[index]);
      });

      // 8.3 Validação estrutural — vencedor tem 3 componentes (separados por ", "),
      //     perdedores têm 2 componentes. Trava o formato do contrato.
      const winnerLabel = within(cards[0])
        .getByRole("button", { name: /^Selecionar variação/ })
        .getAttribute("aria-label");
      expect(winnerLabel?.split(", ")).toHaveLength(3);
      expect(winnerLabel?.split(", ")[2]).toBe("melhor score");

      // eslint-disable-next-line no-restricted-syntax
      [cards[1], cards[2]].forEach((card) => {
        const label = within(card)
          .getByRole("button", { name: /^Selecionar variação/ })
          .getAttribute("aria-label");
        expect(label?.split(", ")).toHaveLength(2);
        expect(label).not.toMatch(/melhor score/);
      });

      // 8.4 Cross-check com a coleção completa — todos os 3 labels esperados
      //     existem no DOM e nenhum label inesperado aparece.
      const allButtonLabels = screen
        .getAllByRole("button", { name: /^Selecionar variação/ })
        .map((btn) => btn.getAttribute("aria-label"));
      expect(allButtonLabels).toEqual([
        expectedAriaLabels[0],
        expectedAriaLabels[1],
        expectedAriaLabels[2],
      ]);
    }
  );

  it("badge 'Melhor score' permanece no winnerIndex mesmo quando outro card é selecionado (activeIndex controlado)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSelectWinner = vi.fn();

    const variations: VariationItem[] = [
      { id: "var-A", imageUrl: "https://example.com/a.png", qualityScore: 60 },
      { id: "var-B", imageUrl: "https://example.com/b.png", qualityScore: 90 },
      { id: "var-C", imageUrl: "https://example.com/c.png", qualityScore: 40 },
    ];
    const winnerIndex = 1;

    const renderWithActive = (activeIndex: number) => (
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onSelectWinner={onSelectWinner}
      />
    );

    const { rerender } = render(renderWithActive(0));

    const assertWinnerInvariant = (currentActive: number) => {
      const cards = screen.getAllByRole("listitem");

      // 1. Badge sempre no winnerIndex
      expect(within(cards[winnerIndex]).getByLabelText("Melhor score")).toBeInTheDocument();
      expect(within(cards[winnerIndex]).getByText("Melhor score")).toBeInTheDocument();

      // 2. Cardinalidade global
      expect(screen.getAllByLabelText("Melhor score", { exact: true })).toHaveLength(1);
      expect(screen.getAllByText("Melhor score", { exact: true })).toHaveLength(1);

      // 3. Outros cards sem badge
      // eslint-disable-next-line no-restricted-syntax
      [0, 1, 2].filter((i) => i !== winnerIndex).forEach((i) => {
        expect(within(cards[i]).queryByLabelText("Melhor score")).toBeNull();
      });

      // 4. aria-pressed/aria-current refletem activeIndex
      // eslint-disable-next-line no-restricted-syntax
      cards.forEach((card, i) => {
        const button = within(card).getByRole("button", { name: /^Selecionar variação/ });
        const isActive = i === currentActive;
        expect(button).toHaveAttribute("aria-pressed", String(isActive));
        if (isActive) {
          expect(button).toHaveAttribute("aria-current", "true");
        } else {
          expect(button).not.toHaveAttribute("aria-current");
        }
      });

      // 5. Aria-label do winner mantém sufixo
      const winnerButton = within(cards[winnerIndex]).getByRole("button", {
        name: /^Selecionar variação 2/,
      });
      expect(winnerButton.getAttribute("aria-label")).toBe(
        "Selecionar variação 2, score 90, melhor score"
      );
    };

    const captureSnapshot = (clickedIndex: number) => {
      const cards = screen.getAllByRole("listitem");
      const clickedButton = within(cards[clickedIndex]).getByRole("button", {
        name: /^Selecionar variação/,
      });
      const winnerButton = within(cards[winnerIndex]).getByRole("button", {
        name: /^Selecionar variação/,
      });
      return {
        clickedAriaPressed: clickedButton.getAttribute("aria-pressed"),
        winnerAriaPressed: winnerButton.getAttribute("aria-pressed"),
        winnerBadgePresent: within(cards[winnerIndex]).queryByLabelText("Melhor score") !== null,
        winnerBadgeText: within(cards[winnerIndex]).queryByText("Melhor score") !== null,
      };
    };

    const clickAndAssertSnapshot = async (
      clickIndex: number,
      newActiveIndex: number,
      expectedBefore: ReturnType<typeof captureSnapshot>,
      expectedAfter: ReturnType<typeof captureSnapshot>
    ) => {
      const beforeSnapshot = captureSnapshot(clickIndex);
      expect(beforeSnapshot).toEqual(expectedBefore);

      const cardsForClick = screen.getAllByRole("listitem");
      await user.click(
        within(cardsForClick[clickIndex]).getByRole("button", { name: /^Selecionar variação/ })
      );
      expect(onSelect).toHaveBeenLastCalledWith(clickIndex);
      rerender(renderWithActive(newActiveIndex));

      const afterSnapshot = captureSnapshot(clickIndex);
      expect(afterSnapshot).toEqual(expectedAfter);
    };

    assertWinnerInvariant(0);

    // CLIQUE 1: var-B (winner) — clicado === winner
    await clickAndAssertSnapshot(
      1,
      1,
      {
        clickedAriaPressed: "false",
        winnerAriaPressed: "false",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      },
      {
        clickedAriaPressed: "true",
        winnerAriaPressed: "true",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      }
    );
    assertWinnerInvariant(1);

    // CLIQUE 2: var-C — clicado ≠ winner; winner perde aria-pressed mas mantém badge
    await clickAndAssertSnapshot(
      2,
      2,
      {
        clickedAriaPressed: "false",
        winnerAriaPressed: "true",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      },
      {
        clickedAriaPressed: "true",
        winnerAriaPressed: "false",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      }
    );
    assertWinnerInvariant(2);

    // CLIQUE 3: var-A — badge persiste em var-B
    await clickAndAssertSnapshot(
      0,
      0,
      {
        clickedAriaPressed: "false",
        winnerAriaPressed: "false",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      },
      {
        clickedAriaPressed: "true",
        winnerAriaPressed: "false",
        winnerBadgePresent: true,
        winnerBadgeText: true,
      }
    );
    assertWinnerInvariant(0);

    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([1, 2, 0]);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("badge 'Melhor score' não migra ao clicar em sequência em cards empatados não vencedores", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSelectWinner = vi.fn();

    // Setup: var-A é winner único (95); var-B e var-C empatadas em 70 (perdedoras)
    const variations: VariationItem[] = [
      { id: "var-A", imageUrl: "https://example.com/a.png", qualityScore: 95 },
      { id: "var-B", imageUrl: "https://example.com/b.png", qualityScore: 70 },
      { id: "var-C", imageUrl: "https://example.com/c.png", qualityScore: 70 },
    ];
    const winnerIndex = 0;

    const renderWithActive = (activeIndex: number) => (
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onSelectWinner={onSelectWinner}
      />
    );

    const { rerender } = render(renderWithActive(0));

    const assertBadgeFixedOnWinner = (currentActive: number) => {
      const cards = screen.getAllByRole("listitem");

      // 1. Cardinalidade global: exatamente 1 badge no DOM
      expect(screen.getAllByLabelText("Melhor score", { exact: true })).toHaveLength(1);
      expect(screen.getAllByText("Melhor score", { exact: true })).toHaveLength(1);

      // 2. Badge presente em var-A (winner único)
      expect(within(cards[winnerIndex]).getByLabelText("Melhor score")).toBeInTheDocument();

      // 3. Badge AUSENTE nas duas empatadas
      expect(within(cards[1]).queryByLabelText("Melhor score")).toBeNull();
      expect(within(cards[2]).queryByLabelText("Melhor score")).toBeNull();

      // 4. Aria-labels: empatadas sem sufixo; winner com sufixo
      const aLabel = within(cards[0]).getByRole("button", { name: /^Selecionar variação/ }).getAttribute("aria-label");
      const bLabel = within(cards[1]).getByRole("button", { name: /^Selecionar variação/ }).getAttribute("aria-label");
      const cLabel = within(cards[2]).getByRole("button", { name: /^Selecionar variação/ }).getAttribute("aria-label");
      expect(aLabel).toBe("Selecionar variação 1, score 95, melhor score");
      expect(bLabel).toBe("Selecionar variação 2, score 70");
      expect(cLabel).toBe("Selecionar variação 3, score 70");

      // 5. aria-pressed reflete activeIndex; badge é independente
      expect(within(cards[currentActive]).getByRole("button", { name: /^Selecionar variação/ }))
        .toHaveAttribute("aria-pressed", "true");
    };

    // Estado inicial
    assertBadgeFixedOnWinner(0);

    // CLIQUE 1: var-B (empatada, perdedora)
    await user.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: /^Selecionar variação 2/ }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    rerender(renderWithActive(1));
    assertBadgeFixedOnWinner(1);

    // CLIQUE 2: var-C (outra empatada)
    await user.click(within(screen.getAllByRole("listitem")[2]).getByRole("button", { name: /^Selecionar variação 3/ }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    rerender(renderWithActive(2));
    assertBadgeFixedOnWinner(2);

    // CLIQUE 3: volta para var-B (toggle entre empatadas)
    await user.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: /^Selecionar variação 2/ }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    rerender(renderWithActive(1));
    assertBadgeFixedOnWinner(1);

    // CLIQUE 4: var-C novamente
    await user.click(within(screen.getAllByRole("listitem")[2]).getByRole("button", { name: /^Selecionar variação 3/ }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    rerender(renderWithActive(2));
    assertBadgeFixedOnWinner(2);

    // Auditoria final
    expect(onSelect).toHaveBeenCalledTimes(4);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([1, 2, 1, 2]);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it("badge fica no menor índice quando 2 cards têm isWinner: true e usuário clica no empatado de maior índice", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSelectWinner = vi.fn();

    // Setup: var-A (idx 0) E var-C (idx 2) com isWinner: true; var-B (idx 1) sem
    // Score var-B é maior (99) para provar que isWinner explícito tem precedência
    const variations: VariationItem[] = [
      { id: "var-A", imageUrl: "https://example.com/a.png", isFavorite: false, qualityScore: 70, curationStatus: "draft", isWinner: true },
      { id: "var-B", imageUrl: "https://example.com/b.png", isFavorite: false, qualityScore: 99, curationStatus: "draft", isWinner: false },
      { id: "var-C", imageUrl: "https://example.com/c.png", isFavorite: false, qualityScore: 70, curationStatus: "draft", isWinner: true },
    ];
    // aria-labels exatos esperados — fonte única de verdade do teste
    const ARIA_LABEL_VAR_A_WINNER = "Selecionar variação 1, score 70, melhor score";
    const ARIA_LABEL_VAR_B = "Selecionar variação 2, score 99";
    const ARIA_LABEL_VAR_C = "Selecionar variação 3, score 70";

    const renderWithActive = (activeIndex: number) => (
      <MagicUpVariationComparator
        variations={variations}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onSelectWinner={onSelectWinner}
      />
    );

    const { rerender } = render(renderWithActive(0));

    const assertBadgeOnFirstWinner = (currentActive: number) => {
      // 1. Cardinalidade global da badge = 1
      expect(screen.getAllByLabelText("Melhor score", { exact: true })).toHaveLength(1);
      expect(screen.getAllByText("Melhor score", { exact: true })).toHaveLength(1);

      // 2. Botões localizados diretamente por aria-label exato
      const buttonA = screen.getByRole("button", { name: ARIA_LABEL_VAR_A_WINNER });
      const buttonB = screen.getByRole("button", { name: ARIA_LABEL_VAR_B });
      const buttonC = screen.getByRole("button", { name: ARIA_LABEL_VAR_C });

      // 3. aria-pressed reflete activeIndex; badge é independente
      const buttons = [buttonA, buttonB, buttonC];
      // eslint-disable-next-line no-restricted-syntax
      buttons.forEach((btn, idx) => {
        expect(btn).toHaveAttribute("aria-pressed", idx === currentActive ? "true" : "false");
      });

      // 4. Sufixo ", melhor score" presente APENAS no aria-label do winner
      expect(buttonA.getAttribute("aria-label")).toContain(", melhor score");
      expect(buttonB.getAttribute("aria-label")).not.toContain("melhor score");
      expect(buttonC.getAttribute("aria-label")).not.toContain("melhor score");
    };

    // Estado inicial
    assertBadgeOnFirstWinner(0);

    // CLIQUE 1: var-C (winner empatado de MAIOR índice)
    await user.click(screen.getByRole("button", { name: ARIA_LABEL_VAR_C }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    rerender(renderWithActive(2));
    assertBadgeOnFirstWinner(2);

    // CLIQUE 2: var-C novamente (re-confirma estabilidade)
    await user.click(screen.getByRole("button", { name: ARIA_LABEL_VAR_C }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    rerender(renderWithActive(2));
    assertBadgeOnFirstWinner(2);

    // CLIQUE 3: var-B (não-winner, mas score 99) — não promove a winner
    await user.click(screen.getByRole("button", { name: ARIA_LABEL_VAR_B }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    rerender(renderWithActive(1));
    assertBadgeOnFirstWinner(1);

    // CLIQUE 4: volta para var-C
    await user.click(screen.getByRole("button", { name: ARIA_LABEL_VAR_C }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    rerender(renderWithActive(2));
    assertBadgeOnFirstWinner(2);

    // Auditoria final
    expect(onSelect).toHaveBeenCalledTimes(4);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([2, 2, 1, 2]);
    expect(onSelectWinner).not.toHaveBeenCalled();
  });

  it.skip("roving tabindex: apenas card ativo tem tabIndex=0; demais cards tabIndex=-1; ativo migra ao mudar activeIndex (PENDENTE: componente não usa roving tabindex; outros testes desta suíte requerem Tab atravessar todos os cards)", async () => {
    const user = userEvent.setup();
    const navVariations: VariationItem[] = [
      { id: "rv-1", imageUrl: "https://example.com/rv1.png", qualityScore: 80 } as VariationItem,
      { id: "rv-2", imageUrl: "https://example.com/rv2.png", qualityScore: 70 } as VariationItem,
      { id: "rv-3", imageUrl: "https://example.com/rv3.png", qualityScore: 90 } as VariationItem,
    ];

    function ControlledWrapper() {
      const [activeIndex, setActiveIndex] = React.useState(0);
      return (
        <>
          <button type="button" data-testid="before">Antes</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={vi.fn()}
          />
          <button type="button" data-testid="after">Depois</button>
        </>
      );
    }

    render(<ControlledWrapper />);
    const total = navVariations.length;

    const getCardTabIndices = (): number[] => {
      return Array.from({ length: total }, (_, i) => {
        const card = screen.getByRole("button", {
          name: new RegExp(`^Selecionar variação ${i + 1}`),
        });
        return card.tabIndex;
      });
    };

    const expectRovingState = (oneBasedActiveIndex: number) => {
      const tabIndices = getCardTabIndices();
      const zeros = tabIndices.filter((t) => t === 0);
      expect(zeros).toHaveLength(1);
      expect(tabIndices[oneBasedActiveIndex - 1]).toBe(0);
      // eslint-disable-next-line no-restricted-syntax
      tabIndices.forEach((t, i) => {
        if (i !== oneBasedActiveIndex - 1) {
          expect(t).toBe(-1);
        }
      });
    };

    // Estado inicial: card 1 ativo
    expectRovingState(1);

    // Tab a partir do botão "before" entra no card ATIVO (card 1)
    const beforeBtn = screen.getByTestId("before");
    beforeBtn.focus();
    expect(beforeBtn).toHaveFocus();
    await user.tab();
    const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
    expect(card1).toHaveFocus();

    // Tab a partir do card ativo SAI do grupo (não cicla para outro card de seleção)
    await user.tab();
    const cardsAfterTab = screen.getAllByRole("button", { name: /^Selecionar variação/ });
    // eslint-disable-next-line no-restricted-syntax
    cardsAfterTab.forEach((c) => {
      expect(c).not.toHaveFocus();
    });

    // ArrowRight: card 1 → card 2; tabIndex migra
    card1.focus();
    await user.keyboard("{ArrowRight}");
    expectRovingState(2);

    // ArrowRight: card 2 → card 3; tabIndex migra
    await user.keyboard("{ArrowRight}");
    expectRovingState(3);

    // End: → último
    await user.keyboard("{End}");
    expectRovingState(total);

    // Home: → primeiro
    await user.keyboard("{Home}");
    expectRovingState(1);

    // Após Home, Tab a partir de "before" deve entrar no card 1 (ativo)
    beforeBtn.focus();
    await user.tab();
    expect(card1).toHaveFocus();

    // Mude activeIndex para 2 via setas e valide que Tab agora entra no card 2
    await user.keyboard("{ArrowRight}");
    expectRovingState(2);
    beforeBtn.focus();
    await user.tab();
    const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
    expect(card2).toHaveFocus();
  });

  describe("ativação por Enter/Espaço nos botões", () => {
    const navVariations: VariationItem[] = [
      { id: "var-1", imageUrl: "https://example.com/1.png", qualityScore: 80 } as VariationItem,
      { id: "var-2", imageUrl: "https://example.com/2.png", qualityScore: 70 } as VariationItem,
      { id: "var-3", imageUrl: "https://example.com/3.png", qualityScore: 90 } as VariationItem,
    ];

    it("Enter no botão 'Selecionar variação N' chama onSelect(N-1) e aria-pressed/aria-current acompanham após rerender", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (activeIndex: number) => (
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={activeIndex}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );
      const { rerender } = render(renderWith(0));

      const selectBtn2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      selectBtn2.focus();
      expect(selectBtn2).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenLastCalledWith(1);
      expect(onSelectWinner).not.toHaveBeenCalled();

      rerender(renderWith(1));
      const selectBtn2After = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(selectBtn2After).toHaveAttribute("aria-pressed", "true");
      expect(selectBtn2After).toHaveAttribute("aria-current", "true");
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("Espaço no botão 'Selecionar variação N' chama onSelect(N-1) com mesmo comportamento de Enter", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const selectBtn3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      selectBtn3.focus();
      expect(selectBtn3).toHaveFocus();
      await user.keyboard(" ");

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenLastCalledWith(2);
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Enter e Espaço no botão 'Marcar vencedora' chamam onSelectWinner(index) e badge migra após rerender com isWinner", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (variations: VariationItem[]) => (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );
      const { rerender } = render(renderWith(navVariations));

      // Sanity: badge inicial em var-3 (maior score 90)
      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      const initialWinnerCard = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      expect(initialWinnerCard.getAttribute("aria-label")).toContain(", melhor score");

      // Enter em "Marcar variação 1 como vencedora"
      const winnerBtn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      winnerBtn1.focus();
      expect(winnerBtn1).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(onSelectWinner).toHaveBeenCalledTimes(1);
      expect(onSelectWinner).toHaveBeenLastCalledWith(0);
      expect(onSelect).not.toHaveBeenCalled();

      const updatedVariations: VariationItem[] = [
        { ...navVariations[0], isWinner: true },
        navVariations[1],
        navVariations[2],
      ];
      rerender(renderWith(updatedVariations));

      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ }).getAttribute("aria-label")).toContain(
        ", melhor score"
      );
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ }).getAttribute("aria-label")).not.toContain(
        "melhor score"
      );

      // Espaço em "Marcar variação 2 como vencedora"
      onSelectWinner.mockClear();
      const winnerBtn2 = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      winnerBtn2.focus();
      expect(winnerBtn2).toHaveFocus();
      await user.keyboard(" ");

      expect(onSelectWinner).toHaveBeenCalledTimes(1);
      expect(onSelectWinner).toHaveBeenLastCalledWith(1);
      expect(onSelect).not.toHaveBeenCalled();

      const updatedAgain: VariationItem[] = [
        navVariations[0],
        { ...navVariations[1], isWinner: true },
        navVariations[2],
      ];
      rerender(renderWith(updatedAgain));

      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ }).getAttribute("aria-label")).toContain(
        ", melhor score"
      );
    });

    it("foco DOM move para o novo card ativo após ArrowRight/ArrowLeft e segue activeIndex após rerender", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (activeIndex: number) => (
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={activeIndex}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );
      const { rerender } = render(renderWith(0));

      const card0 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card0.focus();
      expect(card0).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(onSelect).toHaveBeenLastCalledWith(1);
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(card1).toHaveFocus();
      expect(card0).not.toHaveFocus();

      rerender(renderWith(1));
      const card1AfterRerender = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(card1AfterRerender).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();

      rerender(renderWith(0));
      await user.keyboard("{End}");
      expect(onSelect).toHaveBeenLastCalledWith(2);
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveFocus();

      rerender(renderWith(2));
      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();
    });

    it("wrapper do card ativo recebe classes de destaque (border-primary ring-2) e apenas um card por vez", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (activeIndex: number) => (
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={activeIndex}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );
      const { rerender } = render(renderWith(0));

      const getWrapper = (variationNum: number): HTMLElement => {
        const btn = screen.getByRole("button", { name: new RegExp(`^Selecionar variação ${variationNum}`) });
        const wrapper = btn.parentElement;
        expect(wrapper).not.toBeNull();
        return wrapper as HTMLElement;
      };

      // border-primary "exato" (sem /xx) — exclui border-primary/40 dos cards inativos
      const hasActiveBorder = (el: HTMLElement) => /(?:^|\s)border-primary(?:\s|$)/.test(el.className);

      expect(hasActiveBorder(getWrapper(1))).toBe(true);
      expect(getWrapper(1).className).toContain("ring-2");
      expect(getWrapper(1).className).toContain("ring-primary/20");
      expect(hasActiveBorder(getWrapper(2))).toBe(false);
      expect(getWrapper(2).className).toContain("border-border");
      expect(hasActiveBorder(getWrapper(3))).toBe(false);
      expect(getWrapper(3).className).toContain("border-border");

      const allWrappers = [getWrapper(1), getWrapper(2), getWrapper(3)];
      expect(allWrappers.filter(hasActiveBorder)).toHaveLength(1);

      rerender(renderWith(2));
      expect(hasActiveBorder(getWrapper(1))).toBe(false);
      expect(getWrapper(1).className).toContain("border-border");
      expect(hasActiveBorder(getWrapper(2))).toBe(false);
      expect(hasActiveBorder(getWrapper(3))).toBe(true);
      expect(getWrapper(3).className).toContain("ring-2");
      expect(getWrapper(3).className).toContain("ring-primary/20");

      rerender(renderWith(1));
      expect(hasActiveBorder(getWrapper(1))).toBe(false);
      expect(hasActiveBorder(getWrapper(2))).toBe(true);
      expect(getWrapper(2).className).toContain("ring-2");
      expect(hasActiveBorder(getWrapper(3))).toBe(false);

      const wrappersAfter = [getWrapper(1), getWrapper(2), getWrapper(3)];
      expect(wrappersAfter.filter((w) => w.className.includes("ring-2"))).toHaveLength(1);
    });

    it("aria-label do botão de seleção ganha/perde sufixo ', melhor score' conforme winnerIndex muda", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      const renderWith = (variations: VariationItem[]) => (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const { rerender } = render(renderWith(navVariations));
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ }).getAttribute("aria-label"))
        .not.toContain("melhor score");
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ }).getAttribute("aria-label"))
        .not.toContain("melhor score");
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ }).getAttribute("aria-label"))
        .toContain(", melhor score");

      rerender(renderWith([
        { ...navVariations[0], isWinner: true },
        navVariations[1],
        navVariations[2],
      ]));
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ }).getAttribute("aria-label"))
        .toContain(", melhor score");
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ }).getAttribute("aria-label"))
        .not.toContain("melhor score");

      rerender(renderWith(navVariations));
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ }).getAttribute("aria-label"))
        .not.toContain("melhor score");
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ }).getAttribute("aria-label"))
        .toContain(", melhor score");
    });

    it("badge interna 'Melhor score' aparece exatamente uma vez no DOM e migra para o card winner correto", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      const renderWith = (variations: VariationItem[]) => (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const { rerender } = render(renderWith(navVariations));

      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      const winnerBadge1 = screen.getByLabelText("Melhor score");
      const winnerBtn1 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      expect(winnerBtn1.contains(winnerBadge1)).toBe(true);

      rerender(renderWith([
        { ...navVariations[0], isWinner: true },
        navVariations[1],
        navVariations[2],
      ]));
      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      const winnerBadge2 = screen.getByLabelText("Melhor score");
      const winnerBtn2 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(winnerBtn2.contains(winnerBadge2)).toBe(true);

      rerender(renderWith([
        navVariations[0],
        { ...navVariations[1], isWinner: true },
        navVariations[2],
      ]));
      expect(screen.getAllByLabelText("Melhor score")).toHaveLength(1);
      const winnerBadge3 = screen.getByLabelText("Melhor score");
      const winnerBtn3 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(winnerBtn3.contains(winnerBadge3)).toBe(true);
    });

    it("badge de header anuncia o maior score numérico via aria-label e atualiza após mudanças de variations", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      const renderWith = (variations: VariationItem[]) => (
        <MagicUpVariationComparator
          variations={variations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const { rerender } = render(renderWith(navVariations));
      expect(screen.getByLabelText("Melhor score entre variações: 90")).toBeInTheDocument();

      rerender(renderWith([
        { ...navVariations[0], qualityScore: 50 },
        { ...navVariations[1], qualityScore: 60 },
        { ...navVariations[2], qualityScore: 40 },
      ]));
      expect(screen.getByLabelText("Melhor score entre variações: 60")).toBeInTheDocument();
      expect(screen.queryByLabelText("Melhor score entre variações: 90")).not.toBeInTheDocument();

      rerender(renderWith([
        { id: "var-1", imageUrl: "https://example.com/1.png" } as VariationItem,
        { id: "var-2", imageUrl: "https://example.com/2.png" } as VariationItem,
      ]));
      expect(screen.getByLabelText("Melhor score entre variações: indisponível")).toBeInTheDocument();
    });

    it("Tab a partir de elemento externo move foco para o primeiro botão 'Selecionar variação 1' na ordem DOM correta", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <>
          <button type="button" data-testid="external-anchor">Âncora externa</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
          />
        </>
      );

      const anchor = screen.getByTestId("external-anchor");
      anchor.focus();
      expect(anchor).toHaveFocus();

      await user.tab();
      const firstSelectBtn = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(firstSelectBtn).toHaveFocus();

      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).not.toHaveFocus();
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).not.toHaveFocus();
      expect(screen.getByRole("button", { name: "Marcar variação 1 como vencedora" })).not.toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: "Marcar variação 1 como vencedora" })).toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Tab pula o botão 'Marcar vencedora' quando em loading (disabled remove do tab order)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <>
          <button type="button" data-testid="external-anchor">Âncora externa</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
            loadingWinnerIndex={0}
          />
        </>
      );

      const winnerBtn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(winnerBtn1).toBeDisabled();
      expect(winnerBtn1).toHaveAttribute("aria-busy", "true");

      screen.getByTestId("external-anchor").focus();

      await user.tab();
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();

      await user.tab();
      expect(winnerBtn1).not.toHaveFocus();
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: "Marcar variação 2 como vencedora" })).toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Enter e Space não disparam onSelectWinner quando o botão 'Marcar vencedora' está em loading", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const { rerender } = render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
          loadingWinnerIndex={1}
        />
      );

      const loadingBtn = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(loadingBtn).toBeDisabled();
      expect(loadingBtn).toHaveAttribute("aria-busy", "true");

      loadingBtn.focus();
      expect(loadingBtn).not.toHaveFocus();

      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(onSelectWinner).not.toHaveBeenCalled();

      rerender(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
          loadingWinnerIndex={null}
        />
      );
      const enabledBtn = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(enabledBtn).not.toBeDisabled();
      expect(enabledBtn).not.toHaveAttribute("aria-busy");
      enabledBtn.focus();
      expect(enabledBtn).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelectWinner).toHaveBeenCalledWith(1);

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).toHaveBeenCalledTimes(1);
    });

    it("botão 'Marcar vencedora' preserva aria-label e expõe aria-busy/disabled apenas durante loading", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();
      const renderWith = (loadingIdx: number | null) => (
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
          loadingWinnerIndex={loadingIdx}
        />
      );

      const { rerender } = render(renderWith(null));
      const btn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(btn1).toHaveAttribute("aria-label", "Marcar variação 1 como vencedora");
      expect(btn1).not.toBeDisabled();
      expect(btn1).not.toHaveAttribute("aria-busy");
      expect(screen.queryByText("Marcando vencedora…")).not.toBeInTheDocument();

      rerender(renderWith(0));
      const btn1Loading = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(btn1Loading).toHaveAttribute("aria-label", "Marcar variação 1 como vencedora");
      expect(btn1Loading).toBeDisabled();
      expect(btn1Loading).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Marcando vencedora…")).toBeInTheDocument();

      rerender(renderWith(null));
      const btn1Restored = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(btn1Restored).toHaveAttribute("aria-label", "Marcar variação 1 como vencedora");
      expect(btn1Restored).not.toBeDisabled();
      expect(btn1Restored).not.toHaveAttribute("aria-busy");
      expect(screen.queryByText("Marcando vencedora…")).not.toBeInTheDocument();
    });

    it("loading em um botão não afeta acessibilidade dos demais botões 'Marcar vencedora' (cardinalidade isolada)", () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const { container } = render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
          loadingWinnerIndex={1}
        />
      );

      const btn2 = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(btn2).toBeDisabled();
      expect(btn2).toHaveAttribute("aria-busy", "true");

      const btn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      const btn3 = screen.getByRole("button", { name: "Marcar variação 3 como vencedora" });
      expect(btn1).not.toBeDisabled();
      expect(btn1).not.toHaveAttribute("aria-busy");
      expect(btn3).not.toBeDisabled();
      expect(btn3).not.toHaveAttribute("aria-busy");

      const srOnlyMatches = screen.getAllByText("Marcando vencedora…");
      expect(srOnlyMatches).toHaveLength(1);
      expect(btn2.contains(srOnlyMatches[0])).toBe(true);

      const spinners = container.querySelectorAll('svg[aria-hidden="true"].animate-spin');
      expect(spinners).toHaveLength(1);
      expect(btn2.contains(spinners[0])).toBe(true);

      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).not.toBeDisabled();
    });

    it("transição habilitado→loading preserva foco no elemento atual e suspende Enter/Space enquanto aria-busy=true", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const renderWith = (loadingIdx: number | null) => (
        <div>
          <button type="button" data-testid="external-sentinel">externo</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
            loadingWinnerIndex={loadingIdx}
          />
        </div>
      );

      // Estado inicial: nenhum loading — botão var-1 habilitado
      const { rerender } = render(renderWith(null));
      const winnerBtn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(winnerBtn1).not.toBeDisabled();
      expect(winnerBtn1).not.toHaveAttribute("aria-busy");

      // Usuário foca um elemento neutro externo (sem handler) — equivalente a "o foco atual não está no botão de loading"
      const sentinel = screen.getByTestId("external-sentinel");
      sentinel.focus();
      expect(sentinel).toHaveFocus();

      // Transição: ativa loading no botão "Marcar vencedora" da var-1
      rerender(renderWith(0));

      // 1) Foco PRESERVADO no sentinel externo (rerender não roubou foco)
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 2) Botão "Marcar vencedora" da var-1 agora desabilitado e com aria-busy="true"
      const winnerBtn1Loading = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(winnerBtn1Loading).toBeDisabled();
      expect(winnerBtn1Loading).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Marcando vencedora…")).toBeInTheDocument();

      // 3) Tentativa de focar o botão em loading: HTMLButtonElement disabled
      //    rejeita foco programático — sanity check
      winnerBtn1Loading.focus();
      expect(winnerBtn1Loading).not.toHaveFocus();
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 4) userEvent.click no botão disabled é silenciosamente ignorado
      //    (respeita pointer-events: none do estado disabled)
      await user.click(winnerBtn1Loading);
      expect(onSelectWinner).not.toHaveBeenCalled();

      // Re-foca sentinel (click em disabled remove foco para body)
      screen.getByTestId("external-sentinel").focus();
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 5) Enter/Space via userEvent.keyboard com foco no sentinel — botão disabled
      //    nunca recebe o evento porque não está na cadeia de foco
      await user.keyboard("{Enter}");
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();
      await user.keyboard(" ");
      expect(onSelectWinner).not.toHaveBeenCalled();

      // 6) Foco continua no sentinel externo (botão disabled não rouba foco)
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // Sanity: onSelect (cards) não foi disparado em nenhum momento
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("combinações com modificador (Ctrl/Cmd/Shift/Alt + Enter) não disparam onSelectWinner em botão 'Marcar vencedora' desabilitado", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <div>
          <button type="button" data-testid="external-sentinel">externo</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
            loadingWinnerIndex={0}
          />
        </div>
      );

      const winnerBtn = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(winnerBtn).toBeDisabled();
      expect(winnerBtn).toHaveAttribute("aria-busy", "true");

      screen.getByTestId("external-sentinel").focus();

      // 1) Sanity: botão disabled rejeita foco programático
      winnerBtn.focus();
      expect(winnerBtn).not.toHaveFocus();
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 2) userEvent.click no botão disabled é ignorado
      await user.click(winnerBtn);
      expect(onSelectWinner).not.toHaveBeenCalled();

      // Re-foca sentinel (click em disabled remove foco para body)
      screen.getByTestId("external-sentinel").focus();
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 3) userEvent.keyboard com sintaxe de modificadores — emula atalho global Ctrl+Enter / Cmd+Enter
      await user.keyboard("{Control>}{Enter}{/Control}");
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();
      await user.keyboard("{Meta>}{Enter}{/Meta}");
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();
      await user.keyboard("{Alt>}{Enter}{/Alt}");
      expect(onSelectWinner).not.toHaveBeenCalled();

      // 3) Foco continua no sentinel — botão disabled não capturou foco
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Space com auto-repeat e múltiplas pressões sequenciais não disparam onSelectWinner em botão 'Marcar vencedora' desabilitado", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <div>
          <button type="button" data-testid="external-sentinel">externo</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
            loadingWinnerIndex={1}
          />
        </div>
      );

      const winnerBtn = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(winnerBtn).toBeDisabled();
      expect(winnerBtn).toHaveAttribute("aria-busy", "true");

      screen.getByTestId("external-sentinel").focus();

      // 1) Sanity: botão disabled rejeita foco programático
      winnerBtn.focus();
      expect(winnerBtn).not.toHaveFocus();
      expect(screen.getByTestId("external-sentinel")).toHaveFocus();

      // 2) userEvent.click no botão disabled é ignorado
      await user.click(winnerBtn);
      expect(onSelectWinner).not.toHaveBeenCalled();

      // Re-foca sentinel (click em disabled remove foco para body)
      const sentinel = screen.getByTestId("external-sentinel");
      sentinel.focus();
      expect(sentinel).toHaveFocus();

      // 3) Múltiplas pressões Space sequenciais (15 no total — emula auto-repeat) com foco no sentinel
      for (let i = 0; i < 15; i++) {
        await user.keyboard(" ");
      }
      expect(sentinel).toHaveFocus();
      expect(onSelectWinner).not.toHaveBeenCalled();

      // 4) Combinação Space + modificadores via atalho global
      expect(sentinel).toHaveFocus();
      await user.keyboard("{Control>} {/Control}");
      expect(sentinel).toHaveFocus();
      await user.keyboard("{Meta>} {/Meta}");
      expect(sentinel).toHaveFocus();
      await user.keyboard("{Shift>} {/Shift}");
      expect(sentinel).toHaveFocus();
      await user.keyboard("{Alt>} {/Alt}");
      expect(onSelectWinner).not.toHaveBeenCalled();

      // 4) Sanity reverso: botão habilitado vizinho (var-1) responde normalmente a Space
      const winnerBtn1 = screen.getByRole("button", { name: "Marcar variação 1 como vencedora" });
      expect(winnerBtn1).not.toBeDisabled();
      winnerBtn1.focus();
      expect(winnerBtn1).toHaveFocus();
      await user.keyboard(" ");
      expect(onSelectWinner).toHaveBeenCalledTimes(1);
      expect(onSelectWinner).toHaveBeenCalledWith(0);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Home salta foco e seleção para o primeiro card de variação e Enter/Space disparam onSelect(0)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={2}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      card3.focus();
      expect(card3).toHaveFocus();

      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenCalledWith(0);
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(card1).toHaveFocus();

      expect(card1).toHaveAttribute("aria-keyshortcuts", expect.stringContaining("Home"));

      onSelect.mockClear();
      expect(card1).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(0);

      onSelect.mockClear();
      expect(card1).toHaveFocus();
      await user.keyboard(" ");
      expect(onSelect).toHaveBeenCalledWith(0);

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("End salta foco e seleção para o último card de variação e Enter/Space disparam onSelect(last)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <MagicUpVariationComparator
          variations={navVariations}
          activeIndex={0}
          onSelect={onSelect}
          onSelectWinner={onSelectWinner}
        />
      );

      const lastIndex = navVariations.length - 1;

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1.focus();
      expect(card1).toHaveFocus();

      await user.keyboard("{End}");
      expect(onSelect).toHaveBeenCalledWith(lastIndex);
      const cardLast = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      expect(cardLast).toHaveFocus();

      expect(cardLast).toHaveAttribute("aria-keyshortcuts", expect.stringContaining("End"));

      onSelect.mockClear();
      expect(cardLast).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(lastIndex);

      onSelect.mockClear();
      expect(cardLast).toHaveFocus();
      await user.keyboard(" ");
      expect(onSelect).toHaveBeenCalledWith(lastIndex);

      onSelect.mockClear();
      expect(cardLast).toHaveFocus();
      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();

      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();
      await user.keyboard("{End}");
      expect(onSelect).toHaveBeenLastCalledWith(lastIndex);
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveFocus();

      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveFocus();
      await user.keyboard("{Home}");
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toHaveFocus();

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("scroll do container e do window não rouba foco do botão atualmente focado", async () => {
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      const { container } = render(
        <div style={{ height: "200px", overflow: "auto" }} data-testid="scroll-container">
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={1}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
          />
        </div>
      );

      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      card2.focus();
      expect(card2).toHaveFocus();
      expect(document.activeElement).toBe(card2);

      const scrollContainer = screen.getByTestId("scroll-container");
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 50 } });
      }
      expect(card2).toHaveFocus();
      expect(document.activeElement).toBe(card2);

      fireEvent.scroll(window, { target: { scrollY: 300 } });
      fireEvent.scroll(window, { target: { scrollY: 600 } });
      expect(card2).toHaveFocus();

      const section = container.querySelector('[aria-label="Comparador de variações"]');
      if (section) {
        fireEvent.scroll(section, { target: { scrollTop: 100 } });
      }
      expect(card2).toHaveFocus();

      const winnerBtn3 = screen.getByRole("button", { name: "Marcar variação 3 como vencedora" });
      winnerBtn3.focus();
      expect(winnerBtn3).toHaveFocus();

      for (let i = 0; i < 5; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 200 + i * 30 } });
      }
      fireEvent.scroll(window, { target: { scrollY: 0 } });
      expect(winnerBtn3).toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("Shift+Tab percorre os botões do comparador em ordem reversa (last → first), mantendo Enter/Space funcionais em cada parada", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <div>
          <button type="button" data-testid="before-sentinel">antes</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
          />
          <button type="button" data-testid="after-sentinel">depois</button>
        </div>
      );

      const afterSentinel = screen.getByTestId("after-sentinel");
      afterSentinel.focus();
      expect(afterSentinel).toHaveFocus();

      const expectedReverseOrder: Array<{ name: string | RegExp }> = [
        { name: "Marcar variação 3 como vencedora" },
        { name: /^Selecionar variação 3/ },
        { name: "Marcar variação 2 como vencedora" },
        { name: /^Selecionar variação 2/ },
        { name: "Marcar variação 1 como vencedora" },
        { name: /^Selecionar variação 1/ },
      ];

      for (const target of expectedReverseOrder) {
        await user.tab({ shift: true });
        const btn = screen.getByRole("button", target);
        expect(btn).toHaveFocus();
      }

      await user.tab({ shift: true });
      expect(screen.getByTestId("before-sentinel")).toHaveFocus();

      await user.tab();
      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(card1).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(0);

      onSelect.mockClear();
      await user.tab({ shift: true });
      expect(screen.getByTestId("before-sentinel")).toHaveFocus();

      await user.tab(); // card1
      await user.tab(); // marcar1
      await user.tab(); // card2
      await user.tab(); // marcar2
      const winnerBtn2 = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(winnerBtn2).toHaveFocus();
      await user.keyboard(" ");
      expect(onSelectWinner).toHaveBeenCalledWith(1);

      await user.tab({ shift: true });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      expect(card2).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it("não cria keyboard trap: Tab no último botão sai para sentinel 'depois' e Shift+Tab no primeiro botão sai para sentinel 'antes' (WCAG 2.1.2)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <div>
          <button type="button" data-testid="before-sentinel">antes</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
          />
          <button type="button" data-testid="after-sentinel">depois</button>
        </div>
      );

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      card1.focus();
      expect(card1).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByTestId("before-sentinel")).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByTestId("before-sentinel")).not.toHaveFocus();
      expect(card1).not.toHaveFocus();

      const winnerBtn3 = screen.getByRole("button", { name: "Marcar variação 3 como vencedora" });
      winnerBtn3.focus();
      expect(winnerBtn3).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId("after-sentinel")).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId("after-sentinel")).not.toHaveFocus();
      expect(winnerBtn3).not.toHaveFocus();

      screen.getByTestId("before-sentinel").focus();
      expect(screen.getByTestId("before-sentinel")).toHaveFocus();

      const expectedForwardOrder = [
        { name: /^Selecionar variação 1/ },
        { name: "Marcar variação 1 como vencedora" },
        { name: /^Selecionar variação 2/ },
        { name: "Marcar variação 2 como vencedora" },
        { name: /^Selecionar variação 3/ },
        { name: "Marcar variação 3 como vencedora" },
      ];

      for (const target of expectedForwardOrder) {
        await user.tab();
        expect(screen.getByRole("button", target)).toHaveFocus();
      }

      await user.tab();
      expect(screen.getByTestId("after-sentinel")).toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("não cria keyboard trap mesmo com loadingWinnerIndex ativo: botão disabled é pulado e Tab/Shift+Tab saem do comparador (WCAG 2.1.2)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSelectWinner = vi.fn();

      render(
        <div>
          <button type="button" data-testid="before-sentinel">antes</button>
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={0}
            onSelect={onSelect}
            onSelectWinner={onSelectWinner}
            loadingWinnerIndex={1}
          />
          <button type="button" data-testid="after-sentinel">depois</button>
        </div>
      );

      const winnerBtn2 = screen.getByRole("button", { name: "Marcar variação 2 como vencedora" });
      expect(winnerBtn2).toBeDisabled();
      expect(winnerBtn2).toHaveAttribute("aria-busy", "true");

      screen.getByTestId("before-sentinel").focus();

      const expectedForwardOrder = [
        { name: /^Selecionar variação 1/ },
        { name: "Marcar variação 1 como vencedora" },
        { name: /^Selecionar variação 2/ },
        { name: /^Selecionar variação 3/ },
        { name: "Marcar variação 3 como vencedora" },
      ];

      for (const target of expectedForwardOrder) {
        await user.tab();
        const btn = screen.getByRole("button", target);
        expect(btn).toHaveFocus();
        expect(winnerBtn2).not.toHaveFocus();
      }

      await user.tab();
      expect(screen.getByTestId("after-sentinel")).toHaveFocus();

      const expectedReverseOrder = [
        { name: "Marcar variação 3 como vencedora" },
        { name: /^Selecionar variação 3/ },
        { name: /^Selecionar variação 2/ },
        { name: "Marcar variação 1 como vencedora" },
        { name: /^Selecionar variação 1/ },
      ];

      for (const target of expectedReverseOrder) {
        await user.tab({ shift: true });
        const btn = screen.getByRole("button", target);
        expect(btn).toHaveFocus();
        expect(winnerBtn2).not.toHaveFocus();
      }

      await user.tab({ shift: true });
      expect(screen.getByTestId("before-sentinel")).toHaveFocus();

      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      card2.focus();
      expect(card2).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toHaveFocus();
      expect(winnerBtn2).not.toHaveFocus();

      await user.tab({ shift: true });
      expect(card2).toHaveFocus();
      expect(winnerBtn2).not.toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("aria-pressed e aria-current refletem o estado correto após ativação por Enter/Space, mantendo exclusividade entre cards", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={onSelectWinner}
          />
        );
      }

      render(<ControlledWrapper />);

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });

      // Estado inicial: card1 ativo
      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card1).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card3).toHaveAttribute("aria-pressed", "false");
      expect(card3).not.toHaveAttribute("aria-current");

      // Foca card2 e ativa com Enter
      card2.focus();
      expect(card2).toHaveFocus();
      await user.keyboard("{Enter}");

      await screen.findByRole("button", { name: /^Selecionar variação 2/ });

      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card1).not.toHaveAttribute("aria-current");
      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");
      expect(card3).toHaveAttribute("aria-pressed", "false");
      expect(card3).not.toHaveAttribute("aria-current");

      // Foca card3 e ativa com Space
      card3.focus();
      expect(card3).toHaveFocus();
      await user.keyboard(" ");

      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card1).not.toHaveAttribute("aria-current");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card3).toHaveAttribute("aria-pressed", "true");
      expect(card3).toHaveAttribute("aria-current", "true");

      // Volta para card1 com Home
      expect(card3).toHaveFocus();
      await user.keyboard("{Home}");

      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card1).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card3).toHaveAttribute("aria-pressed", "false");

      const allCards = [card1, card2, card3];
      const currentCount = allCards.filter((c) => c.getAttribute("aria-current") === "true").length;
      expect(currentCount).toBe(1);

      const pressedCount = allCards.filter((c) => c.getAttribute("aria-pressed") === "true").length;
      expect(pressedCount).toBe(1);

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("aria-pressed e aria-current permanecem consistentes em sequência mista Tab→Enter→clique→Space, sem dessincronizar atributos", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <div>
            <button type="button" data-testid="before-sentinel">antes</button>
            <MagicUpVariationComparator
              variations={navVariations}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onSelectWinner={onSelectWinner}
            />
          </div>
        );
      }

      render(<ControlledWrapper />);

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });

      // Etapa 1: Tab até card2 e Enter
      screen.getByTestId("before-sentinel").focus();
      await user.tab(); // card1
      await user.tab(); // marcar1
      await user.tab(); // card2
      expect(card2).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");
      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card3).toHaveAttribute("aria-pressed", "false");

      // Etapa 2: Clique direto no card3
      await user.click(card3);

      expect(card3).toHaveAttribute("aria-pressed", "true");
      expect(card3).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card1).toHaveAttribute("aria-pressed", "false");

      // Etapa 3: Volta ao teclado
      card3.focus();
      expect(card3).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(card2).toHaveFocus();
      await user.keyboard(" ");

      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");
      expect(card3).toHaveAttribute("aria-pressed", "false");
      expect(card3).not.toHaveAttribute("aria-current");

      // Etapa 4: Clique em card1
      await user.click(card1);

      expect(card1).toHaveAttribute("aria-pressed", "true");
      expect(card1).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");
      expect(card3).toHaveAttribute("aria-pressed", "false");

      // Etapa 5: Validação final de exclusividade
      const allCards = [card1, card2, card3];
      expect(allCards.filter((c) => c.getAttribute("aria-pressed") === "true")).toHaveLength(1);
      expect(allCards.filter((c) => c.getAttribute("aria-current") === "true")).toHaveLength(1);
      expect(allCards.filter((c) => c.getAttribute("aria-pressed") === "false")).toHaveLength(2);
      expect(allCards.filter((c) => !c.hasAttribute("aria-current"))).toHaveLength(2);

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("DOM permanece estruturalmente estável após Enter/Space — só mudam atributos do estado controlado", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={onSelectWinner}
          />
        );
      }

      const { container } = render(<ControlledWrapper />);

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });

      const section = container.querySelector('[aria-label="Comparador de variações"]')!;
      const initialNodeCount = section.querySelectorAll("*").length;

      const initialCard1Ref = card1;
      const initialCard2Ref = card2;
      const initialCard3Ref = card3;

      const collectStableAttrs = (el: HTMLElement) => ({
        role: el.getAttribute("role"),
        type: el.getAttribute("type"),
        tabindex: el.getAttribute("tabindex"),
        ariaKeyshortcuts: el.getAttribute("aria-keyshortcuts"),
        ariaLabel: el.getAttribute("aria-label"),
      });
      const card1StableBefore = collectStableAttrs(card1);
      const card2StableBefore = collectStableAttrs(card2);
      const card3StableBefore = collectStableAttrs(card3);

      const initialTagSequence = Array.from(section.querySelectorAll("*"))
        .map((el) => el.tagName)
        .join(",");

      // ── Ação: Enter no card2 ──
      card2.focus();
      expect(card2).toHaveFocus();
      await user.keyboard("{Enter}");

      const postEnterNodeCount = section.querySelectorAll("*").length;
      const postEnterTagSequence = Array.from(section.querySelectorAll("*"))
        .map((el) => el.tagName)
        .join(",");

      expect(postEnterNodeCount).toBe(initialNodeCount);
      expect(postEnterTagSequence).toBe(initialTagSequence);

      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toBe(initialCard1Ref);
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).toBe(initialCard2Ref);
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toBe(initialCard3Ref);

      expect(collectStableAttrs(card1)).toEqual(card1StableBefore);
      expect(collectStableAttrs(card2)).toEqual(card2StableBefore);
      expect(collectStableAttrs(card3)).toEqual(card3StableBefore);

      expect(card2).toHaveAttribute("aria-pressed", "true");
      expect(card2).toHaveAttribute("aria-current", "true");
      expect(card1).toHaveAttribute("aria-pressed", "false");
      expect(card1).not.toHaveAttribute("aria-current");

      // ── Ação: Space no card3 ──
      card3.focus();
      expect(card3).toHaveFocus();
      await user.keyboard(" ");

      const postSpaceNodeCount = section.querySelectorAll("*").length;
      const postSpaceTagSequence = Array.from(section.querySelectorAll("*"))
        .map((el) => el.tagName)
        .join(",");

      expect(postSpaceNodeCount).toBe(initialNodeCount);
      expect(postSpaceTagSequence).toBe(initialTagSequence);

      expect(screen.getByRole("button", { name: /^Selecionar variação 1/ })).toBe(initialCard1Ref);
      expect(screen.getByRole("button", { name: /^Selecionar variação 2/ })).toBe(initialCard2Ref);
      expect(screen.getByRole("button", { name: /^Selecionar variação 3/ })).toBe(initialCard3Ref);

      expect(collectStableAttrs(card1)).toEqual(card1StableBefore);
      expect(collectStableAttrs(card2)).toEqual(card2StableBefore);
      expect(collectStableAttrs(card3)).toEqual(card3StableBefore);

      expect(card3).toHaveAttribute("aria-pressed", "true");
      expect(card3).toHaveAttribute("aria-current", "true");
      expect(card2).toHaveAttribute("aria-pressed", "false");
      expect(card2).not.toHaveAttribute("aria-current");

      expect(onSelectWinner).not.toHaveBeenCalled();
    });

    it("foco permanece visível e consistente após clicar em card e em 'Marcar vencedora'", async () => {
      const user = userEvent.setup();
      const onSelectWinner = vi.fn();
      const navVariations: VariationItem[] = [
        { id: "fv-1", imageUrl: "https://example.com/fv1.png", qualityScore: 80 } as VariationItem,
        { id: "fv-2", imageUrl: "https://example.com/fv2.png", qualityScore: 70 } as VariationItem,
        { id: "fv-3", imageUrl: "https://example.com/fv3.png", qualityScore: 90 } as VariationItem,
      ];

      function ControlledWrapper() {
        const [activeIndex, setActiveIndex] = React.useState(0);
        return (
          <MagicUpVariationComparator
            variations={navVariations}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onSelectWinner={onSelectWinner}
          />
        );
      }

      render(<ControlledWrapper />);

      const REQUIRED_FOCUS_CLASSES = [
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
      ];

      const expectFocusVisible = (el: HTMLElement) => {
        // eslint-disable-next-line no-restricted-syntax
        REQUIRED_FOCUS_CLASSES.forEach((cls) => {
          expect(el.className).toContain(cls);
        });
        expect(el.className).not.toMatch(/(?<!focus-visible:)focus:ring-/);
      };

      // ── Cenário 1: clique em card 2 ──
      const card2 = screen.getByRole("button", { name: /^Selecionar variação 2/ });
      await user.click(card2);
      expect(card2).toHaveFocus();
      expect(card2).toHaveAttribute("aria-pressed", "true");
      expectFocusVisible(card2);

      const card1 = screen.getByRole("button", { name: /^Selecionar variação 1/ });
      expect(card1).toHaveAttribute("aria-pressed", "false");

      // ── Cenário 2: clique em card 3 ──
      const card3 = screen.getByRole("button", { name: /^Selecionar variação 3/ });
      await user.click(card3);
      expect(card3).toHaveFocus();
      expect(card3).toHaveAttribute("aria-pressed", "true");
      expectFocusVisible(card3);
      expect(card2).toHaveAttribute("aria-pressed", "false");

      // ── Cenário 3: ativação via Enter ──
      card1.focus();
      await user.keyboard("{Enter}");
      expect(card1).toHaveFocus();
      expect(card1).toHaveAttribute("aria-pressed", "true");
      expectFocusVisible(card1);

      // ── Cenário 4: ativação via Espaço ──
      card2.focus();
      await user.keyboard(" ");
      expect(card2).toHaveFocus();
      expect(card2).toHaveAttribute("aria-pressed", "true");
      expectFocusVisible(card2);

      // ── Cenário 5: clique em "Marcar vencedora" ──
      const winnerButtons = screen.getAllByRole("button", { name: /vencedora/i });
      expect(winnerButtons.length).toBeGreaterThan(0);

      const firstWinnerBtn = winnerButtons[0];
      await user.click(firstWinnerBtn);

      expect(onSelectWinner).toHaveBeenCalledTimes(1);

      expect(document.activeElement).not.toBe(document.body);

      const focusedAfterWinner = document.activeElement as HTMLElement;
      expect(focusedAfterWinner).not.toBeNull();
      expect(focusedAfterWinner.className).toContain("focus-visible:outline-none");
      expect(focusedAfterWinner.className).toContain("focus-visible:ring-2");
      expect(focusedAfterWinner.className).not.toMatch(/(?<!focus-visible:)focus:ring-/);

      // ── Cenário 6: invariante aria-pressed ──
      const cards = screen.getAllByRole("button", { name: /^Selecionar variação/ });
      const pressedCards = cards.filter((c) => c.getAttribute("aria-pressed") === "true");
      expect(pressedCards).toHaveLength(1);
    });
  });
});
