// _shared/supabase-client-adapter.ts
// ----------------------------------------------------------------------------
// Adapter centralizado para resolver incompatibilidades de tipagem do
// `SupabaseClient` entre edge functions. Diferentes módulos importam o SDK
// de versões distintas (2.45.0 / 2.49.4 / 2.95.0) e/ou com genéricos diferentes
// (`SupabaseClient<Database, 'public'>` vs `SupabaseClient<any, never>`),
// o que produz erros de TS2345 ("Type 'public' is not assignable to type 'never'")
// e quebra `client.rpc<T>()` (T colapsando para `unknown` por PromiseLike).
//
// Este módulo expõe:
//   • `CompatibleSupabaseClient<DB, Schema>` — tipo genérico estruturalmente
//     compatível com qualquer SupabaseClient com schema "public" por padrão.
//   • `ServiceClient` — alias canônico (default `SupabaseClient`) usado por
//     helpers internos que esperam a forma "default".
//   • `assertServiceClient(client)` — runtime guard com mensagem descritiva.
//   • `castSupabaseClient(client)` — narrow type-safe (com guard opcional)
//     para o alias canônico, eliminando casts ad-hoc espalhados no código.
//   • `castRpcResult<T>(promise)` — wrapper que normaliza `PromiseLike<T>`
//     retornado por `.rpc()` em `Promise<T>` real, preservando o genérico.
// ----------------------------------------------------------------------------

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

/** Alias canônico do client default (schema "public"). */
export type ServiceClient = SupabaseClient;

/**
 * Tipo genérico estruturalmente compatível com SupabaseClient.
 * Aceita qualquer Database / SchemaName, com default "public" — cobre 100%
 * dos call sites atuais sem forçar usuários a importar `Database`.
 */
export type CompatibleSupabaseClient<
  // deno-lint-ignore no-explicit-any
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public" & string
    : string & keyof Database,
> = SupabaseClient<Database, SchemaName>;

/**
 * Runtime guard: verifica forma estrutural mínima de um SupabaseClient
 * (`.from()`, `.rpc()`, `.auth`). Lança TypeError descritivo se inválido.
 *
 * Use quando o client vier de fonte não-confiável (params externos, mocks).
 */
export function assertServiceClient(
  client: unknown,
  context = "supabase-client-adapter",
): asserts client is ServiceClient {
  if (!client || typeof client !== "object") {
    throw new TypeError(
      `[${context}] service client inválido: esperado SupabaseClient, recebeu ${
        client === null ? "null" : typeof client
      }`,
    );
  }
  const c = client as Record<string, unknown>;
  const missing: string[] = [];
  if (typeof c.from !== "function") missing.push(".from()");
  if (typeof c.rpc !== "function") missing.push(".rpc()");
  if (typeof c.auth !== "object" || c.auth === null) missing.push(".auth");
  if (missing.length > 0) {
    throw new TypeError(
      `[${context}] service client não satisfaz forma de SupabaseClient — ` +
        `faltando: ${missing.join(", ")}. Verifique se createClient<Database, 'public'> ` +
        `está alinhado com o schema esperado.`,
    );
  }
}

/**
 * Narrow type-safe de qualquer SupabaseClient compatível para o alias
 * canônico `ServiceClient`. Substitui os `as unknown as SupabaseClient`
 * espalhados pelas edge functions.
 *
 * @param client  Cliente Supabase (qualquer versão / genéricos compatíveis).
 * @param opts.validate  Quando true, executa `assertServiceClient` antes do cast.
 * @param opts.context   Identificador para mensagens de erro do guard.
 */
export function castSupabaseClient<
  // deno-lint-ignore no-explicit-any
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public" & string
    : string & keyof Database,
>(
  client: CompatibleSupabaseClient<Database, SchemaName> | unknown,
  opts: { validate?: boolean; context?: string } = {},
): ServiceClient {
  if (opts.validate) {
    assertServiceClient(client, opts.context ?? "castSupabaseClient");
  }
  return client as unknown as ServiceClient;
}

/**
 * Normaliza o retorno de `client.rpc<T>(...)` (que é `PromiseLike<T>` no SDK
 * e por isso colapsa o genérico T para `unknown` em alguns contextos) em uma
 * `Promise<T>` real, preservando o tipo genérico passado pelo caller.
 *
 * Uso:
 *   const { data, error } = await castRpcResult<MyRow[]>(supabase.rpc("fn", args));
 */
export function castRpcResult<T>(thenable: PromiseLike<T>): Promise<T> {
  return Promise.resolve(thenable);
}
