import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
import { getCredential } from "../_shared/credentials.ts";

const corsHeaders = buildPublicCorsHeaders();

interface ScanLog {
  user_id: string;
  bucket: string;
  path: string;
  hash: string;
  scan_result: Record<string, unknown>;
  status_code: number;
}

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "secure-upload", requestId, req });

  if (req.method === "OPTIONS") {
    return log.respond(new Response("ok", { headers: corsHeaders }));
  }

  // 1. Autenticação obrigatória — rejeita anônimos antes de qualquer trabalho.
  let auth;
  try {
    auth = await authenticateRequest(req);
  } catch (err) {
    log.warn("auth_failed", { err });
    return log.respond(authErrorResponse(err, corsHeaders));
  }

  const supabaseAdmin = auth.localServiceClient;
  log.info("request_start", { user_id: auth.userId });

  // Variáveis para auditoria persistente mesmo em caso de erro
  let auditData: Partial<ScanLog> = {
    user_id: auth.userId,
    status_code: 500,
    scan_result: { message: "Iniciando processamento" },
  };

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) throw new Error("Arquivo obrigatório");

    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    auditData = {
      user_id: auth.userId,
      bucket: "personalization-images",
      path: `verified/${folder}/${file.name}`,
      hash: hashHex,
      status_code: 200,
      scan_result: { message: "Arquivo recebido para análise" },
    };

    let isSuspicious = false;
    let scanDetails: Record<string, unknown> = {
      source: "VirusTotal",
      checked_at: new Date().toISOString(),
    };
    let targetBucket = "personalization-images";
    let targetPrefix = "verified";
    // fix: ssot-bypass — credential vault
    const vtApiKey = await getCredential("VIRUSTOTAL_API_KEY");

    if (vtApiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const vtRes = await fetch(
          `https://www.virustotal.com/api/v3/files/${hashHex}`,
          {
            headers: { "x-apikey": vtApiKey },
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (vtRes.ok) {
          const vtData = await vtRes.json();
          scanDetails = { ...scanDetails, ...vtData.data.attributes.last_analysis_stats };
          const malicious = (scanDetails.malicious as number | undefined) ?? 0;
          const suspicious = (scanDetails.suspicious as number | undefined) ?? 0;
          if (malicious > 0 || suspicious > 0) {
            isSuspicious = true;
            scanDetails.reason = `Detectado: ${malicious} maliciosos, ${suspicious} suspeitos`;
          } else {
            scanDetails.reason = "Arquivo limpo (base VirusTotal)";
          }
        } else if (vtRes.status === 404) {
          scanDetails.reason =
            "Arquivo novo no VirusTotal (análise pendente). Permitido upload inicial.";
        } else {
          throw new Error(`Falha na API de segurança (Status: ${vtRes.status})`);
        }
      } catch (err) {
        const errorObj = err as { name?: string; message?: string };
        const reason = errorObj.name === "AbortError"
          ? "Timeout na verificação (10s)"
          : (errorObj.message ?? "Erro desconhecido");
        log.error("security_check_failed", { err, reason, user_id: auth.userId });

        await supabaseAdmin.from("file_scan_logs").insert({
          ...auditData,
          status_code: 403,
          scan_result: { ...scanDetails, error: true, reason: `Bloqueio preventivo: ${reason}` },
        });

        return log.respond(
          new Response(JSON.stringify({ error: `Segurança: ${reason}`, request_id: requestId }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }),
        );
      }
    }

    if (isSuspicious) {
      targetBucket = "quarantine";
      targetPrefix = "suspect";
    }

    const fileName = `${targetPrefix}/${folder}/${Date.now()}-${
      Math.random().toString(36).substring(7)
    }.${file.name.split(".").pop()}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(targetBucket)
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    auditData.path = uploadData.path;
    auditData.bucket = targetBucket;
    auditData.status_code = isSuspicious ? 403 : 200;
    auditData.scan_result = scanDetails;

    await supabaseAdmin.from("file_scan_logs").insert(auditData as ScanLog);

    if (isSuspicious) {
      log.warn("upload_blocked_malware", {
        bucket: targetBucket,
        path: uploadData.path,
        user_id: auth.userId,
      });
      return log.respond(
        new Response(
          JSON.stringify({ error: "Arquivo bloqueado: Malware detectado", request_id: requestId }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      );
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(targetBucket)
      .getPublicUrl(uploadData.path);

    log.info("upload_ok", {
      bucket: targetBucket,
      path: uploadData.path,
      user_id: auth.userId,
    });

    return log.respond(
      new Response(
        JSON.stringify({ url: publicUrl, path: uploadData.path, request_id: requestId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      ),
    );
  } catch (error) {
    const errorObj = error as { message?: string };
    log.error("upload_failed", { err: error, user_id: auth.userId });
    if (auditData.hash) {
      await supabaseAdmin.from("file_scan_logs").insert({
        ...auditData,
        status_code: 500,
        scan_result: { error: true, message: errorObj.message ?? "Erro desconhecido" },
      });
    }
    return log.respond(
      safeErrorResponse(error, { corsHeaders, publicMessage: "upload_failed", requestId, logLabel: "secure-upload error:" }),
    );
  }
});
