/**
 * Helpers para gerar variantes negativas de payloads a partir de um exemplo
 * positivo + introspecção do schema Zod.
 *
 * Tipos de variante gerados:
 *   - missing  → remove o campo (deleta a chave do objeto)
 *   - wrong    → substitui por um valor de tipo incompatível
 *   - empty    → substitui por "" / [] / {} dependendo do tipo
 *
 * Limitações conhecidas (best-effort):
 *   - Funciona apenas para campos top-level de schemas que são z.ZodObject.
 *     Discriminated unions, refinements e wrappers são ignorados.
 *   - Schemas com .default() não permitem testar "missing" porque o default
 *     completa o valor antes da validação — esses casos são pulados.
 *   - Schemas .partial() ou só com optionals retornam matrizes vazias.
 *
 * Para schemas mais complexos, defina `examples.invalid[]` explicitamente no
 * arquivo de contrato.
 */
import { z } from "zod";

export interface NegativeCase {
  variant: "missing" | "wrong" | "empty";
  field: string;
  payload: unknown;
}

/** Verifica se o ZodType anota o campo como "obrigatório" (não optional/default). */
function isRequiredField(type: z.ZodTypeAny): boolean {
  const def = type._def as { typeName?: string };
  return def.typeName !== "ZodOptional" && def.typeName !== "ZodDefault";
}

/** Resolve o ZodType "interno" (descasca optional/default/nullable). */
function unwrap(type: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = type;
  while (true) {
    const def = cur._def as { typeName?: string; innerType?: z.ZodTypeAny };
    if (
      def.typeName === "ZodOptional" ||
      def.typeName === "ZodDefault" ||
      def.typeName === "ZodNullable"
    ) {
      if (!def.innerType) break;
      cur = def.innerType;
    } else {
      break;
    }
  }
  return cur;
}

/** Valor de tipo "errado" para o ZodType dado. */
function wrongValueFor(type: z.ZodTypeAny): unknown {
  const inner = unwrap(type);
  const def = inner._def as { typeName?: string };
  switch (def.typeName) {
    case "ZodString":
      return 12345;
    case "ZodNumber":
      return "not-a-number";
    case "ZodBoolean":
      return "no";
    case "ZodArray":
      return "not-array";
    case "ZodObject":
    case "ZodRecord":
      return "not-an-object";
    case "ZodEnum":
    case "ZodNativeEnum":
      return "definitely_not_in_enum_XYZ";
    case "ZodLiteral":
      return "definitely_not_the_literal";
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return 999.5; // não casa em nenhum branch comum
    default:
      return Symbol.for("unknown");
  }
}

/** Valor "vazio" para o ZodType dado (ou null se não aplicável). */
function emptyValueFor(type: z.ZodTypeAny): { applicable: boolean; value: unknown } {
  const inner = unwrap(type);
  const def = inner._def as { typeName?: string };
  switch (def.typeName) {
    case "ZodString":
      return { applicable: true, value: "" };
    case "ZodArray":
      return { applicable: true, value: [] };
    case "ZodObject":
    case "ZodRecord":
      return { applicable: true, value: {} };
    default:
      return { applicable: false, value: null };
  }
}

/**
 * Gera casos negativos para todos os campos top-level de um schema ZodObject.
 *
 * @param schema Schema canônico. Se não for ZodObject (ou estiver wrapper-ado),
 *               tenta descascar; se não conseguir, devolve [].
 * @param validExample Exemplo positivo de payload (usado como base).
 */
export function generateNegativeMatrix<T extends z.ZodTypeAny>(
  schema: T,
  validExample: Record<string, unknown>,
): NegativeCase[] {
  const inner = unwrap(schema);
  const def = inner._def as { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> };
  if (def.typeName !== "ZodObject" || typeof def.shape !== "function") {
    return [];
  }
  const shape = def.shape();
  const cases: NegativeCase[] = [];

  for (const [field, fieldType] of Object.entries(shape)) {
    const required = isRequiredField(fieldType);
    const fieldDef = (fieldType as z.ZodTypeAny)._def as { typeName?: string };

    if (required) {
      // missing: só faz sentido se o campo estiver presente no exemplo.
      if (field in validExample) {
        const next = { ...validExample };
        delete (next as Record<string, unknown>)[field];
        cases.push({ variant: "missing", field, payload: next });
      }
    }

    // wrong type
    const wrong = wrongValueFor(fieldType as z.ZodTypeAny);
    if (typeof wrong !== "symbol") {
      cases.push({
        variant: "wrong",
        field,
        payload: { ...validExample, [field]: wrong },
      });
    }

    // empty
    if (fieldDef.typeName !== "ZodBoolean" && fieldDef.typeName !== "ZodNumber") {
      const empty = emptyValueFor(fieldType as z.ZodTypeAny);
      if (empty.applicable) {
        cases.push({
          variant: "empty",
          field,
          payload: { ...validExample, [field]: empty.value },
        });
      }
    }
  }

  return cases;
}
