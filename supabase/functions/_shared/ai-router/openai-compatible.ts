// =============================================================================
// AI Router Adapter — OpenAI-compatible
// Suporta: OpenAI, DeepSeek, Lovable Gateway, OpenRouter, Groq, Together,
// vLLM próprio, Anyscale, e qualquer outro provider que fale OpenAI dialect.
// =============================================================================

import type { Adapter, AdapterCallOpts, ToolCall, UnifiedResponse } from "./types.ts";
import { AdapterError } from "./types.ts";

interface OpenAiChoice {
  message?: {
    content?: string;
    images?: Array<string | { image_url?: { url?: string } }>;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string | Record<string, unknown> };
      name?: string;
    }>;
  };
  finish_reason?: string;
}

interface OpenAiResponse {
  choices?: OpenAiChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
  error?: { message?: string; type?: string };
}

function classifyHttpStatus(status: number): { retryable: boolean; kind: "auth" | "rate_limit" | "server" | "client" } {
  if (status === 401 || status === 403) return { retryable: false, kind: "auth" };
  if (status === 429) return { retryable: true, kind: "rate_limit" };
  if (status === 404 || status === 400) return { retryable: true, kind: "client" }; // 404/400 (not found/bad request) could be model-specific
  if (status >= 500 && status <= 599) return { retryable: true, kind: "server" };
  return { retryable: false, kind: "client" };
}

export const openaiCompatibleAdapter: Adapter = {
  async call({ provider, model, request }: AdapterCallOpts): Promise<UnifiedResponse> {
    const url = provider.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const authValue = provider.authFormat.replace("{key}", provider.apiKey);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [provider.authHeader]: authValue,
      ...(provider.extraHeaders ?? {}),
    };

    const body: Record<string, unknown> = { model, messages: request.messages };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
    if (request.stream !== undefined) body.stream = request.stream;
    if (request.modalities) body.modalities = request.modalities;
    if (request.tools) body.tools = request.tools;
    if (request.json_schema) body.response_format = { type: "json_schema", json_schema: request.json_schema };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), provider.timeoutMs);

    let resp: Response;
    try {
      resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new AdapterError(
        isAbort ? `Timeout após ${provider.timeoutMs}ms` : `Network: ${(err as Error).message}`,
        { retryable: true, errorKind: isAbort ? "timeout" : "network", raw: err },
      );
    } finally { clearTimeout(timer); }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const cls = classifyHttpStatus(resp.status);
      throw new AdapterError(`HTTP ${resp.status}: ${text.slice(0, 500)}`, {
        status: resp.status, retryable: cls.retryable, errorKind: cls.kind, raw: text,
      });
    }

    let data: OpenAiResponse;
    try { data = (await resp.json()) as OpenAiResponse; }
    catch (err) { throw new AdapterError("Invalid JSON in provider response", { errorKind: "parse", raw: err }); }

    if (data.error) {
      throw new AdapterError(`Provider error: ${data.error.message ?? "unknown"}`, {
        retryable: false, errorKind: "client", raw: data.error,
      });
    }

    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = typeof message?.content === "string" ? message.content : "";

    const images: string[] = [];
    if (Array.isArray(message?.images)) {
      for (const img of message.images) {
        if (typeof img === "string") images.push(img);
        else if (img?.image_url?.url) images.push(img.image_url.url);
      }
    }

    const toolCalls: ToolCall[] = [];
    if (Array.isArray(message?.tool_calls)) {
      for (const tc of message.tool_calls) {
        const fn = tc.function;
        let args: Record<string, unknown> = {};
        if (fn?.arguments) {
          if (typeof fn.arguments === "string") {
            try { args = JSON.parse(fn.arguments); } catch { args = { _raw: fn.arguments }; }
          } else { args = fn.arguments; }
        }
        toolCalls.push({ name: fn?.name ?? tc.name ?? "", arguments: args });
      }
    }

    const usage = data.usage ?? {};
    return {
      content,
      images: images.length > 0 ? images : undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
      },
      finish_reason: choice?.finish_reason,
      raw: data,
    };
  },
};
