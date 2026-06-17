import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";

// ─ Types ─────────────────────────────────────────────────────────────────

interface GenerateMockupBody {
  productImageUrl?: string;
  logoBase64?: string;
  logoUrl?: string;
  // techniqueName/techniquePrompt are echoed back as metadata only — this function
  // is a deterministic canvas compositor (the AI/"nano-banana" route was removed),
  // so the prompt has NO visual effect. Kept for response provenance/back-compat.
  techniqueName?: string;
  techniquePrompt?: string;
  positionX?: number;
  positionY?: number;
  logoWidthCm?: number;
  logoHeightCm?: number;
  logoRotation?: number;
  logoScale?: number;
  productName?: string;
}

// ─ Validation ──────────────────────────────────────────────────────────────

function validationError(
  message: string,
  corsHeaders: Record<string, string>,
  errorCode?: string,
): Response {
  return new Response(
    JSON.stringify({ error: "validation_failed", errorCode, message }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

// SSRF mitigation: optionally restrict which hosts the function will fetch from.
// Configured via MOCKUP_FETCH_ALLOWED_HOSTS (comma-separated hostnames). When unset
// the function allows all hosts (logged) so existing product CDNs keep working — set
// the env var to lock it down once the legitimate domains are confirmed.
function hostAllowed(rawUrl: string): boolean {
  const allow = (Deno.env.get("MOCKUP_FETCH_ALLOWED_HOSTS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) {
    console.warn("[generate-mockup] MOCKUP_FETCH_ALLOWED_HOSTS not set — allowing all hosts");
    return true;
  }
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return allow.some((a) => host === a || host.endsWith("." + a));
  } catch {
    return false;
  }
}

// SVG cannot be rasterised by createImageBitmap in the Deno edge runtime, so it must
// be rejected up-front with an actionable, machine-readable error code.
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 512))
    .toLowerCase();
  return head.includes("<svg") || (head.includes("<?xml") && head.includes("svg"));
}

function svgError(corsHeaders: Record<string, string>): Response {
  return validationError(
    "Logos SVG não são suportados. Use PNG ou JPG.",
    corsHeaders,
    "SVG_NOT_SUPPORTED",
  );
}

// ─ Image helpers ────────────────────────────────────────────────────────────

async function fetchBytes(url: string, ms = 14_000): Promise<Uint8Array> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`);
    return new Uint8Array(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─ Canvas composition ───────────────────────────────────────────────────────

const CANVAS_PX = 1024;

// BUG-A13 FIX (26/05/2026): OffscreenCanvas pode não estar disponível em todos
// os runtimes Deno Edge. Adicionado try/catch específico com mensagem clara.
// BUG-A15 FIX (26/05/2026): Substituídas declarações `var` por `const`/`let`
// dentro de compositeImages() (era código de era antes do ES6).
async function compositeImages(
  productBytes: Uint8Array,
  logoBytes: Uint8Array,
  posXPct: number,
  posYPct: number,
  logoWRatio: number,
  logoHRatio: number,
  rotDeg: number,
  scalePct: number,
): Promise<Blob> {
  // BUG-A13 FIX: Guard explícito para OffscreenCanvas indisponível
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error(
      "OffscreenCanvas não está disponível neste runtime. " +
      "A função generate-mockup requer Deno com suporte a Canvas. " +
      "Verifique se a edge function está com a flag --unstable-canvas ativada."
    );
  }

  const canvas = new OffscreenCanvas(CANVAS_PX, CANVAS_PX);
  // deno-lint-ignore no-explicit-any
  const ctx = canvas.getContext("2d") as any;
  if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");

  const [prodBmp, logoBmp] = await Promise.all([
    // deno-lint-ignore no-explicit-any
    createImageBitmap(new Blob([productBytes as unknown as any])),
    // deno-lint-ignore no-explicit-any
    createImageBitmap(new Blob([logoBytes as unknown as any])),
  ]);

  // BUG-A15 FIX: const/let em vez de var
  // AUDIT 2026-06-17 — WYSIWYG parity: the on-screen preview (LogoPreviewCanvas)
  // renders the product with `object-contain` on a neutral background and positions
  // the logo as a percentage of that full square frame. The previous cover-fill crop
  // here zoomed/cropped the product, so the generated mockup did NOT match the
  // preview and the logo's %-position drifted (worst on non-square products: mugs,
  // pens, bottles). Switch to contain + white letterbox so the output mirrors the
  // preview frame and nothing on the product gets cropped.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
  const pa = prodBmp.width / prodBmp.height;
  let dw = CANVAS_PX, dh = CANVAS_PX, dx = 0, dy = 0;
  if (pa > 1) { dh = CANVAS_PX / pa; dy = (CANVAS_PX - dh) / 2; }
  else        { dw = CANVAS_PX * pa; dx = (CANVAS_PX - dw) / 2; }
  ctx.drawImage(prodBmp, 0, 0, prodBmp.width, prodBmp.height, dx, dy, dw, dh);

  // Logo -- positioned, rotated, scaled
  const cx = (posXPct / 100) * CANVAS_PX;
  const cy = (posYPct / 100) * CANVAS_PX;
  const s  = scalePct / 100;
  const lw = logoWRatio * CANVAS_PX * s;
  const lh = logoHRatio * CANVAS_PX * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.drawImage(logoBmp, -lw / 2, -lh / 2, lw, lh);
  ctx.restore();

  return await canvas.convertToBlob({ type: "image/png" });
}

// ─ Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const killResponse = await assertSwitchEnabled("edge_generate_mockup", req, corsHeaders);
  if (killResponse) return killResponse;

  let auth: Awaited<ReturnType<typeof authenticateRequest>>;
  try { auth = await authenticateRequest(req); }
  catch (e) { return authErrorResponse(e, corsHeaders); }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: GenerateMockupBody;
  try {
    const parsed = await req.json();
    // Guard: null / array / primitive bodies would throw when we access
    // body.productImageUrl below — treat them as an empty object so the
    // validation error path fires cleanly instead of a 500.
    body = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      ? (parsed as GenerateMockupBody)
      : ({} as GenerateMockupBody);
  } catch { return validationError("Request body must be valid JSON", corsHeaders); }

  if (!isValidHttpUrl(body.productImageUrl))
    return validationError("productImageUrl is required and must be a valid HTTPS URL", corsHeaders);

  if (!hostAllowed(body.productImageUrl!))
    return validationError("productImageUrl host is not allowed", corsHeaders, "HOST_NOT_ALLOWED");

  const hasLogo = body.logoBase64 || isValidHttpUrl(body.logoUrl);
  if (!hasLogo)
    return validationError("Either logoBase64 or a valid logoUrl is required", corsHeaders);

  if (body.logoUrl && !body.logoBase64 && !hostAllowed(body.logoUrl))
    return validationError("logoUrl host is not allowed", corsHeaders, "HOST_NOT_ALLOWED");

  // G1: reject SVG data URLs before any fetch/decode work.
  if (body.logoBase64 && /^data:image\/svg/i.test(body.logoBase64.trim()))
    return svgError(corsHeaders);

  const posX    = Math.max(0, Math.min(100, body.positionX ?? 50));
  const posY    = Math.max(0, Math.min(100, body.positionY ?? 50));
  const logoWR  = Math.max(0.05, Math.min(0.9, (body.logoWidthCm  ?? 5) / 20));
  const logoHR  = Math.max(0.05, Math.min(0.9, (body.logoHeightCm ?? 3) / 20));
  const rotation = body.logoRotation ?? 0;
  const scale    = Math.max(10, Math.min(300, body.logoScale ?? 100));

  const t0 = Date.now();

  try {
    // G10: fetch product image and logo in parallel (was a sequential waterfall up to ~24s).
    const [prodSettled, logoSettled] = await Promise.allSettled([
      fetchBytes(body.productImageUrl!, 12_000),
      (async () =>
        body.logoBase64 ? base64ToBytes(body.logoBase64) : await fetchBytes(body.logoUrl!, 12_000))(),
    ]);

    if (prodSettled.status === "rejected") {
      return new Response(
        JSON.stringify({
          error: "product_image_unavailable",
          message: (prodSettled.reason as Error)?.message ?? "Falha ao baixar imagem do produto",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (logoSettled.status === "rejected") {
      return new Response(
        JSON.stringify({
          error: "logo_unavailable",
          message: (logoSettled.reason as Error)?.message ?? "Falha ao processar o logo",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const productBytes = prodSettled.value;
    const logoBytes = logoSettled.value;

    // G1: reject SVG content that slipped in via a URL fetch.
    if (looksLikeSvg(productBytes) || looksLikeSvg(logoBytes)) return svgError(corsHeaders);

    // G4: this is canvas composition (no AI). The name reflects the total time budget.
    if (Date.now() - t0 > 20_000) {
      return new Response(
        JSON.stringify({ error: "composition_timeout", message: "Tempo limite excedido" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let compositeBlob: Blob;
    try {
      compositeBlob = await compositeImages(
        productBytes, logoBytes, posX, posY, logoWR, logoHR, rotation, scale,
      );
    } catch (e) {
      console.error("[generate-mockup] canvas error:", e);
      // BUG-A13 FIX: distingue erro de canvas indisponível de erro de composição
      const msg = (e as Error).message;
      const isRuntimeError = msg.includes("OffscreenCanvas não está disponível");
      return new Response(
        JSON.stringify({
          error: isRuntimeError ? "canvas_runtime_unavailable" : "composition_failed",
          message: msg,
        }),
        { status: isRuntimeError ? 501 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const filePath = `${auth.userId}/mockups/${Date.now()}-${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabase.storage
      .from("mockup-assets")
      .upload(filePath, await compositeBlob.arrayBuffer(), {
        contentType: "image/png",
        upsert: false,
      });

    if (upErr) {
      console.error("[generate-mockup] storage upload error:", upErr);
      return new Response(
        JSON.stringify({ error: "storage_upload_failed", message: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: urlData } = supabase.storage.from("mockup-assets").getPublicUrl(filePath);
    const mockupUrl = urlData?.publicUrl;
    if (!mockupUrl) {
      return new Response(
        JSON.stringify({ error: "url_resolution_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ms = Date.now() - t0;
    console.log(`[generate-mockup] ok user=${auth.userId} ms=${ms}`);

    return new Response(
      JSON.stringify({
        ok: true,
        mockupUrl,
        mockup_url: mockupUrl,
        mockup_id: filePath.split("/").pop()?.replace(".png", "") ?? null,
        generated_at: new Date().toISOString(),
        generation_ms: ms,
        technique: body.techniqueName ?? "custom",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: unknown) {
    console.error("[generate-mockup] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
