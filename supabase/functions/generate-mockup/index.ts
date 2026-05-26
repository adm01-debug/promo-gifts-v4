import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";

// ─ Types ─────────────────────────────────────────────────────────────────

interface GenerateMockupBody {
  productImageUrl?: string;
  logoBase64?: string;
  logoUrl?: string;
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

function validationError(message: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "validation_failed", message }),
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
  const canvas = new OffscreenCanvas(CANVAS_PX, CANVAS_PX);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");

  const [prodBmp, logoBmp] = await Promise.all([
    createImageBitmap(new Blob([productBytes])),
    createImageBitmap(new Blob([logoBytes])),
  ]);

  // Product -- cover-fill crop
  var pa = prodBmp.width / prodBmp.height;
  var sx = 0, sy = 0, sw = prodBmp.width, sh = prodBmp.height;
  if (pa > 1) { sw = prodBmp.height; sx = (prodBmp.width - sw) / 2; }
  else        { sh = prodBmp.width;  sy = (prodBmp.height - sh) / 2; }
  ctx.drawImage(prodBmp, sx, sy, sw, sh, 0, 0, CANVAS_PX, CANVAS_PX);

  // Logo -- positioned, rotated, scaled
  var cx = (posXPct / 100) * CANVAS_PX;
  var cy = (posYPct / 100) * CANVAS_PX;
  var s  = scalePct / 100;
  var lw = logoWRatio * CANVAS_PX * s;
  var lh = logoHRatio * CANVAS_PX * s;
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
  try { body = await req.json(); }
  catch { return validationError("Request body must be valid JSON", corsHeaders); }

  if (!isValidHttpUrl(body.productImageUrl))
    return validationError("productImageUrl is required and must be a valid HTTPS URL", corsHeaders);

  const hasLogo = body.logoBase64 || isValidHttpUrl(body.logoUrl);
  if (!hasLogo)
    return validationError("Either logoBase64 or a valid logoUrl is required", corsHeaders);

  const posX    = Math.max(0, Math.min(100, body.positionX ?? 50));
  const posY    = Math.max(0, Math.min(100, body.positionY ?? 50));
  const logoWR  = Math.max(0.05, Math.min(0.9, (body.logoWidthCm  ?? 5) / 20));
  const logoHR  = Math.max(0.05, Math.min(0.9, (body.logoHeightCm ?? 3) / 20));
  const rotation = body.logoRotation ?? 0;
  const scale    = Math.max(10, Math.min(300, body.logoScale ?? 100));

  const t0 = Date.now();

  try {
    let productBytes: Uint8Array;
    try { productBytes = await fetchBytes(body.productImageUrl!, 12_000); }
    catch (e) {
      return new Response(
        JSON.stringify({ error: "product_image_unavailable", message: (e as Error).message }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let logoBytes: Uint8Array;
    try {
      logoBytes = body.logoBase64
        ? base64ToBytes(body.logoBase64)
        : await fetchBytes(body.logoUrl!, 12_000);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "logo_unavailable", message: (e as Error).message }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (Date.now() - t0 > 20_000) {
      return new Response(
        JSON.stringify({ error: "ai_generation_timeout", message: "Tempo limite excedido" }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let compositeBlob: Blob;
    try {
      compositeBlob = await compositeImages(
        productBytes, logoBytes, posX, posY, logoWR, logoHR, rotation, scale,
      );
    } catch (e) {
      console.error("[generate-mockup] canvas error:", e);
      return new Response(
        JSON.stringify({ error: "composition_failed", message: (e as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
