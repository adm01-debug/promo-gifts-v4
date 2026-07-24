// =============================================================================
// AI Router Adapter — Google Generative AI (Gemini /models/{model}:generateContent)
// Diferenças do OpenAI:
//   - Endpoint inclui o model no path: /models/{model}:generateContent
//   - "messages" → "contents" com role "user"|"model" (não "assistant")
//   - System message → "systemInstruction" (top-level)
//   - Content parts: text, inline_data (base64), file_data (URL)
//   - Tools: functionDeclarations + functionCall response
//   - Image generation: response parts contém inline_data
//   - Header: x-goog-api-key (sem prefixo Bearer)
// =============================================================================

import type { Adapter, AdapterCallOpts, ContentPart, ToolCall, UnifiedMessage, UnifiedResponse } from "./types.ts";
import { AdapterError } from "./types.ts";

interface GooglePart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
  file_data?: { file_uri: string; mime_type?: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GoogleCandidate {
  content?: { parts?: GooglePart[]; role?: string };
  finishReason?: string;
}

interface GoogleResponse {
  candidates?: GoogleCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
}

function partsForGoogle(content: string | ContentPart[]): GooglePart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((part) => {
    if (part.type === "text") return { text: part.text ?? "" };
    if (part.type === "image_url") {
      const url = part.image_url?.url ?? "";
      const m = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (m) return { inline_data: { mime_type: m[1], data: m[2] } };
      // External URL — Google supports file_data with URI; mime defaults to jpeg
      return { file_data: { file_uri: url, mime_type: "image/jpeg" } };
    }
    return { text: JSON.stringify(part) };
  });
}

function classifyHttpStatus(status: number): { retryable: boolean; kind: "auth" | "rate_limit" | "server" | "client" } {
  if (status === 401 || status === 403) return { retryable: false, kind: "auth" };
  if (status === 429) return { retryable: true, kind: "rate_limit" };
  if (status === 404 || status === 400) return { retryable: true, kind: "client" }; // 404/400 (not found/bad request) could be model-specific
  if (status >= 500) return { retryable: true, kind: "server" };
  return { retryable: false, kind: "client" };
}

export const googleGenaiAdapter: Adapter = {
  async call({ provider, model, request }: AdapterCallOpts): Promise<UnifiedResponse> {
    let systemInstruction: { parts: GooglePart[] } | undefined;
    const contents: { role: string; parts: GooglePart[] }[] = [];
    for (const m of request.messages) {
      if (m.role === "system") {
        const text = typeof m.content === "string"
          ? m.content
          : (m.content as ContentPart[]).find((p) => p.type === "text")?.text ?? "";
        systemInstruction = { parts: [{ text }] };
      } else {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: partsForGoogle(m.content),
        });
      }
    }

    const url = `${provider.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`;
    const authValue = provider.authFormat.replace("{key}", provider.apiKey);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [provider.authHeader]: authValue,
      ...(provider.extraHeaders ?? {}),
    };

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.max_tokens !== undefined) generationConfig.maxOutputTokens = request.max_tokens;
    if (request.json_schema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = request.json_schema;
    }
    // For Nano Banana / Gemini Image, request both modalities
    if (request.modalities?.includes("image")) {
      generationConfig.responseModalities = ["TEXT", "IMAGE"];
    }

    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
    if (request.tools) {
      // Google expects { tools: [{ functionDeclarations: [...] }] }
      body.tools = request.tools;
    }

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

    let data: GoogleResponse;
    try { data = (await resp.json()) as GoogleResponse; }
    catch (err) { throw new AdapterError("Invalid JSON in Gemini response", { errorKind: "parse", raw: err }); }

    if (data.error) {
      throw new AdapterError(`Gemini error: ${data.error.message ?? "unknown"}`, {
        retryable: false, errorKind: "client", raw: data.error,
      });
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    let textOut = "";
    const images: string[] = [];
    const toolCalls: ToolCall[] = [];
    for (const p of parts) {
      if (p.text) textOut += p.text;
      else if (p.inline_data) images.push(`data:${p.inline_data.mime_type};base64,${p.inline_data.data}`);
      else if (p.functionCall) toolCalls.push({ name: p.functionCall.name, arguments: p.functionCall.args ?? {} });
    }

    return {
      content: textOut,
      images: images.length > 0 ? images : undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      finish_reason: candidate?.finishReason,
      raw: data,
    };
  },
};
