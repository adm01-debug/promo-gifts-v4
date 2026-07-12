/**
 * Helpers OBRIGATÓRIOS para criar recursos nomeáveis em testes E2E.
 *
 * Garantem que TODO orçamento, coleção, lista de favoritos, kit ou cart
 * template criado por um spec carregue o prefixo `e2eName(...)`. Isso é
 * pré-requisito para que o `e2e-cleanup` (com `nameFilterPrefix` ativo)
 * apague apenas os dados criados por testes — nunca dados manuais.
 *
 * REGRA:
 *   - NUNCA escreva diretamente no input de nome via `page.fill(...)`.
 *   - SEMPRE passe por `fillResourceNameField(...)` ou pelos atalhos
 *     `createE2eQuote / createE2eCollection / createE2eFavoriteList /
 *     createE2eCartTemplate / createE2eCustomKit`.
 *
 * Caso o helper detecte que o valor passado não começa com `getTestPrefix()`,
 * ele LANÇA imediatamente — falha rápido em vez de poluir o BD.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { e2eName, getTestPrefix, isE2eName } from "../fixtures/test-user";
import { Sel } from "../fixtures/selectors";

// Re-export dos helpers de nomenclatura E2E para que outros módulos possam
// importar diretamente de `./e2e-resources` (padrão adotado por
// `quotes-status-seed.ts`, `discount-approval-seed.ts` e specs 04p*).
// Sem este re-export, Playwright falha a coleta com
// `does not provide an export named 'e2eName'` e o CI reporta 0 testes.
export { e2eName, getTestPrefix, isE2eName };

/**
 * Guarda runtime: lança se `value` não começa com o prefixo global E2E
 * NEM com um sub-prefixo `[E2E:*]` (gerado por `e2eScope`).
 *
 * Aceita opcionalmente um `expectedPrefix` para validação estrita —
 * útil quando a fixture `e2eResources` quer garantir scoping correto.
 */
export function assertE2eName(
  value: string,
  context = "resource",
  expectedPrefix?: string,
): void {
  if (expectedPrefix) {
    if (!value.startsWith(expectedPrefix)) {
      throw new Error(
        `[e2e-resources] ${context} name="${value}" não usa o prefixo escopado "${expectedPrefix}". ` +
          `Use o helper escopado da fixture (resources.create*) — caso contrário o cleanup ` +
          `escopado por spec não conseguirá apagar este recurso.`,
      );
    }
    return;
  }
  if (isE2eName(value)) return;
  const prefix = getTestPrefix();
  throw new Error(
    `[e2e-resources] ${context} name="${value}" não usa o prefixo "${prefix}" nem um sub-prefixo "[E2E:*]". ` +
      `Use e2eName("${context}") (ou e2eName(label, { prefix: e2eScope(slug) })) em vez de strings literais — ` +
      `caso contrário o cleanup com nameFilterPrefix=true não conseguirá apagar este recurso ` +
      `e o teste pode acidentalmente impactar dados fora do escopo.`,
  );
}

/**
 * Preenche um campo de nome de recurso APLICANDO a guarda `assertE2eName`.
 * Aceita o locator do input (já resolvido pelo spec) e o valor.
 *
 * Quando `expectedPrefix` é fornecido, faz validação estrita (deve bater
 * exatamente com esse sub-prefixo) — usado pela fixture `e2eResources`.
 */
export async function fillResourceNameField(
  field: Locator,
  value: string,
  context = "resource",
  expectedPrefix?: string,
): Promise<void> {
  assertE2eName(value, context, expectedPrefix);
  await field.waitFor({ state: "visible", timeout: 8_000 });
  await field.fill(value);
}

// ─────────────────────────────────────────────────────────────────────────
// Atalhos por domínio — geram o nome internamente para impedir engano.
// Cada um aceita `prefix?` opcional para scoping por spec via fixture.
// ─────────────────────────────────────────────────────────────────────────

interface CreateOpts {
  label?: string;
  submit?: boolean;
  prefix?: string;
}

export async function createE2eQuote(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "orcamento", { prefix: opts.prefix });
  const field = page.locator('[data-testid="quote-client-name"]').first();
  await fillResourceNameField(field, name, "quote.client_name", opts.prefix);
  if (opts.submit) {
    const submit = page
      .locator('[data-testid="quote-submit"], [data-testid="quote-save"]')
      .first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eCollection(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "colecao", { prefix: opts.prefix });
  const field = page.locator('[data-testid="collection-name-input"]').first();
  await fillResourceNameField(field, name, "collection.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator('[data-testid="collection-create-submit"]').first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eFavoriteList(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "favorite-list", { prefix: opts.prefix });
  const field = page.locator('[data-testid="favorite-list-name-input"]').first();
  await fillResourceNameField(field, name, "favorite_lists.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator('[data-testid="favorite-list-create-submit"]').first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eCartTemplate(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "cart-template", { prefix: opts.prefix });
  const field = page.locator('[data-testid="cart-template-name-input"]').first();
  await fillResourceNameField(field, name, "cart_templates.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator('[data-testid="cart-template-save"]').first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eCustomKit(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "custom-kit", { prefix: opts.prefix });
  const field = page.locator('[data-testid="custom-kit-name-input"]').first();
  await fillResourceNameField(field, name, "custom_kits.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator('[data-testid="custom-kit-save"]').first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eSupplier(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "fornecedor", { prefix: opts.prefix });
  const field = page.locator(Sel.admin.nameInput).first();
  await fillResourceNameField(field, name, "suppliers.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator(Sel.admin.saveBtn).first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

export async function createE2eTechnique(
  page: Page,
  opts: CreateOpts = {},
): Promise<{ name: string }> {
  const name = e2eName(opts.label ?? "tecnica", { prefix: opts.prefix });
  const field = page.locator(Sel.admin.nameInput).first();
  await fillResourceNameField(field, name, "personalization_techniques.name", opts.prefix);
  if (opts.submit) {
    const submit = page.locator(Sel.admin.saveBtn).first();
    await submit.waitFor({ state: "visible", timeout: 8_000 });
    await submit.click();
  }
  return { name };
}

/**
 * Espera que um recurso de nome E2E apareça na lista correspondente.
 * Aceita opcionalmente um `expectedPrefix` para validação estrita.
 */
export async function expectE2eResourceVisible(
  page: Page,
  containerSelector: string,
  resourceName: string,
  expectedPrefix?: string,
): Promise<void> {
  assertE2eName(resourceName, "resource (assert)", expectedPrefix);
  void Sel; // mantém referência para garantir consistência de import
  await expect(
    page.locator(`${containerSelector} :text("${resourceName}")`).first(),
    `recurso "${resourceName}" deveria estar visível em ${containerSelector}`,
  ).toBeVisible({ timeout: 10_000 });
}
