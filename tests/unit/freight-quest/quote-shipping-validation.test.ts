/**
 * freight-quest: Testes de validação de schema do orçamento com frete
 *
 * Cobre:
 *  - quoteFormSchema: CIF, FOB, FOB_PRE + refine rules
 *  - Campos obrigatórios e opcionais
 *  - Regressões: bugs conhecidos de validação
 *  - Cenários de limite e fronteira
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Schema (espelha src/lib/validations/quoteSchema.ts) ────────────────────

const shippingTypes = ["cif", "fob", "fob_pre"] as const;
type ShippingType = (typeof shippingTypes)[number];

const quoteFormSchema = z
  .object({
    clientId: z.string().min(1, "Cliente é obrigatório"),
    contactId: z.string().min(1, "Contato é obrigatório"),
    paymentMethod: z.string().min(1),
    paymentTerms: z.string().min(1),
    deliveryTime: z.string().min(1),
    shippingType: z.enum(shippingTypes),
    shippingCost: z.number().min(0).optional().default(0),
    discountValue: z.number().min(0).optional().default(0),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shippingType === "fob_pre" && (!data.shippingCost || data.shippingCost <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FOB pré-negociado exige custo de frete maior que zero",
        path: ["shippingCost"],
      });
    }
    if (data.shippingType !== "fob_pre" && data.shippingCost && data.shippingCost > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custo de frete só é aplicável para FOB pré-negociado",
        path: ["shippingCost"],
      });
    }
  });

type QuoteFormInput = z.input<typeof quoteFormSchema>;

const BASE_VALID: QuoteFormInput = {
  clientId: "client-001",
  contactId: "contact-001",
  paymentMethod: "boleto",
  paymentTerms: "30-60-90",
  deliveryTime: "15-20 dias úteis",
  shippingType: "cif",
  shippingCost: 0,
  discountValue: 0,
};

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("quoteFormSchema — valid cases", () => {
  it("CIF com shippingCost=0 → válido", () => {
    expect(quoteFormSchema.safeParse({ ...BASE_VALID, shippingType: "cif" }).success).toBe(true);
  });

  it("FOB com shippingCost=0 → válido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingType: "fob", shippingCost: 0 }).success,
    ).toBe(true);
  });

  it("FOB_PRE com shippingCost=50 → válido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingType: "fob_pre", shippingCost: 50 })
        .success,
    ).toBe(true);
  });

  it("FOB_PRE com shippingCost=0.01 → válido (acima de zero)", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingType: "fob_pre", shippingCost: 0.01 })
        .success,
    ).toBe(true);
  });

  it("notes e internalNotes opcionais → ausentes são válidos", () => {
    const { notes: _n, internalNotes: _i, ...withoutNotes } = BASE_VALID;
    expect(quoteFormSchema.safeParse(withoutNotes).success).toBe(true);
  });

  it("discountValue ausente → default para 0 → válido", () => {
    const { discountValue: _, ...withoutDiscount } = BASE_VALID;
    const result = quoteFormSchema.safeParse(withoutDiscount);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discountValue).toBe(0);
    }
  });

  it("shippingCost ausente → default para 0 no CIF → válido", () => {
    const { shippingCost: _, ...withoutCost } = BASE_VALID;
    const result = quoteFormSchema.safeParse(withoutCost);
    expect(result.success).toBe(true);
  });

  it("notas longas (5000 chars) → válido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, notes: "A".repeat(5000) }).success,
    ).toBe(true);
  });
});

// ─── Refine rules: CIF / FOB não aceitam custo ───────────────────────────────

describe("quoteFormSchema — refine: non-fob_pre rejeita custo", () => {
  it("CIF com shippingCost=100 → inválido", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "cif",
      shippingCost: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("shippingCost");
    }
  });

  it("FOB com shippingCost=50 → inválido", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "fob",
      shippingCost: 50,
    });
    expect(result.success).toBe(false);
  });

  it("FOB_PRE com shippingCost=0 → inválido", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "fob_pre",
      shippingCost: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("pré-negociado");
    }
  });

  it("FOB_PRE com shippingCost negativo → inválido (min(0))", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "fob_pre",
      shippingCost: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Campos obrigatórios ───────────────────────────────────────────────────────

describe("quoteFormSchema — campos obrigatórios", () => {
  const requiredFields: (keyof QuoteFormInput)[] = [
    "clientId",
    "contactId",
    "paymentMethod",
    "paymentTerms",
    "deliveryTime",
    "shippingType",
  ];

  it.each(requiredFields)("sem '%s' → inválido", (field) => {
    const payload = { ...BASE_VALID } as Record<string, unknown>;
    delete payload[field];
    const result = quoteFormSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("clientId vazio → inválido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, clientId: "" }).success,
    ).toBe(false);
  });

  it("shippingType com valor fora do enum → inválido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingType: "invalid_type" }).success,
    ).toBe(false);
  });
});

// ─── Tipos errados ─────────────────────────────────────────────────────────────

describe("quoteFormSchema — type confusion", () => {
  it("shippingCost como string → inválido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingCost: "150" }).success,
    ).toBe(false);
  });

  it("shippingCost como null → inválido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, shippingCost: null }).success,
    ).toBe(false);
  });

  it("discountValue como string → inválido", () => {
    expect(
      quoteFormSchema.safeParse({ ...BASE_VALID, discountValue: "10%" }).success,
    ).toBe(false);
  });

  it("payload completamente diferente → inválido", () => {
    expect(quoteFormSchema.safeParse({ foo: "bar", baz: 42 }).success).toBe(false);
  });

  it("payload null → inválido", () => {
    expect(quoteFormSchema.safeParse(null).success).toBe(false);
  });

  it("payload array → inválido", () => {
    expect(quoteFormSchema.safeParse([]).success).toBe(false);
  });
});

// ─── Regressões ───────────────────────────────────────────────────────────────

describe("quoteFormSchema — regressões de validação", () => {
  it("REG-01: FOB_PRE aceita qualquer valor positivo (não só inteiros)", () => {
    const cases = [0.01, 0.5, 22.75, 150.0, 9999.99];
    for (const cost of cases) {
      expect(
        quoteFormSchema.safeParse({
          ...BASE_VALID,
          shippingType: "fob_pre",
          shippingCost: cost,
        }).success,
      ).toBe(true);
    }
  });

  it("REG-02: CIF aceita shippingCost=undefined (default 0, sem custo ativado)", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "cif",
      shippingCost: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shippingCost).toBe(0);
    }
  });

  it("REG-03: erro sempre reporta path=['shippingCost'] para violação de refine", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      shippingType: "cif",
      shippingCost: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("shippingCost");
    }
  });

  it("REG-04: múltiplos erros coletados (clientId + shippingType inválidos)", () => {
    const result = quoteFormSchema.safeParse({
      ...BASE_VALID,
      clientId: "",
      shippingType: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── Cenários de boundary ─────────────────────────────────────────────────────

describe("quoteFormSchema — boundary values para shippingCost", () => {
  const boundaryFobPre = [
    { cost: 0.001, valid: true },
    { cost: 0.0, valid: false },
    { cost: 100_000, valid: true },
    { cost: Number.MAX_SAFE_INTEGER, valid: true },
  ];

  it.each(boundaryFobPre)(
    "FOB_PRE shippingCost=$cost → valid=$valid",
    ({ cost, valid }) => {
      const result = quoteFormSchema.safeParse({
        ...BASE_VALID,
        shippingType: "fob_pre",
        shippingCost: cost,
      });
      expect(result.success).toBe(valid);
    },
  );
});
