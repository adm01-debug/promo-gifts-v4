import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

const AccessBodySchema = z.object({
  ip: z.string().max(45).optional(),
  userAgent: z.string().max(512).optional(),
}).passthrough();
// CORS headers are now dynamic — use getCorsHeaders(req) inside the handler
// See _shared/cors.ts for the centralized configuration

interface GeoInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
}

async function getGeoInfo(ip: string): Promise<GeoInfo | null> {
  try {
    // Usa ip-api.com (gratuito para uso não-comercial, 45 req/min)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,countryCode,org,query`);
    const data = await response.json();

    if (data.status === "success") {
      return {
        ip: data.query || ip,
        city: data.city || "Desconhecida",
        region: data.regionName || "",
        country: data.countryCode || "",
        org: data.org || "",
      };
    }
    return null;
  } catch (e) {
    console.error("Erro ao buscar geolocalização:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Autenticar o usuário
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    // System/Service bypass: only allowed if it's explicitly internal via header
    const isServiceKey = token === serviceKey || (token?.startsWith("sb_") && serviceKey.startsWith("sb_") && token === serviceKey);
    
    if (token && isServiceKey) {
      // SEC-001: Para evitar que a service_role seja usada indevidamente em endpoints públicos,
      // exigimos o cabeçalho X-Internal-Call: true. Isso garante que testes que tentam
      // usar service_role sem o flag recebam 401, mantendo a consistência da auditoria.
      const isInternal = req.headers.get("X-Internal-Call") === "true";
      
      if (!isInternal) {
        console.warn(`[validate-access] Bloqueada tentativa de service_role sem X-Internal-Call`);
        return new Response(
          JSON.stringify({ 
            error: "unauthorized_service_role", 
            message: "Internal flag required for service_role bypass. Access denied.",
            allowed: false 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ allowed: true, reason: "service_role_bypass", internal: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } },
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;
    const userEmail = user.email || "";

    // Obter e validar body da request
    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = AccessBodySchema.safeParse(rawBody);
    const body = parsedBody.success ? parsedBody.data : {};
    const clientIp = body.ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = body.userAgent || req.headers.get("user-agent") || "";

    // Buscar configurações de segurança
    const { data: settings } = await supabaseAdmin
      .from("access_security_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings) {
      // Sem configurações = acesso livre
      return new Response(
        JSON.stringify({ allowed: true, reason: "no_settings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: { allowed: boolean; reason: string; details?: Record<string, unknown> } = {
      allowed: true,
      reason: "ok",
    };

    // ============ VERIFICAÇÃO DE IP ============
    if (settings.ip_whitelist_enabled) {
      const { data: allowedIps } = await supabaseAdmin
        .from("ip_whitelist")
        .select("ip_address, label")
        .eq("is_active", true);

      const ipList = (allowedIps || []).map((r) => r.ip_address);

      if (ipList.length > 0 && !ipList.includes(clientIp)) {
        // Verificar se o IP faz match parcial (ex: range /24)
        const isAllowed = ipList.some((allowedIp) => {
          if (allowedIp.includes("/")) {
            // CIDR check simplificado (apenas /24 e /16)
            const [base, bits] = allowedIp.split("/");
            const baseParts = base.split(".");
            const ipParts = clientIp.split(".");
            const cidr = parseInt(bits);
            if (cidr === 24) return baseParts.slice(0, 3).join(".") === ipParts.slice(0, 3).join(".");
            if (cidr === 16) return baseParts.slice(0, 2).join(".") === ipParts.slice(0, 2).join(".");
          }
          return allowedIp === clientIp;
        });

        if (!isAllowed) {
          results.allowed = false;
          results.reason = "ip_not_whitelisted";

          // Logar tentativa bloqueada
          await supabaseAdmin.from("access_blocked_log").insert({
            user_id: userId,
            email: userEmail,
            ip_address: clientIp,
            block_reason: "ip_not_whitelisted",
            user_agent: userAgent,
          });
        }
      }
    }

    // ============ VERIFICAÇÃO DE CIDADE ============
    if (settings.city_whitelist_enabled && results.allowed) {
      // Buscar geolocalização do IP
      const geo = await getGeoInfo(clientIp);

      if (geo) {
        const { data: allowedCities } = await supabaseAdmin
          .from("city_whitelist")
          .select("city_name, state, country_code")
          .eq("is_active", true);

        const cityList = allowedCities || [];

        if (cityList.length > 0) {
          // Match por cidade (case insensitive) + estado opcional
          const isAllowed = cityList.some((c) => {
            const cityMatch = c.city_name.toLowerCase() === geo.city.toLowerCase();
            const stateMatch = !c.state || c.state.toLowerCase() === geo.region.toLowerCase();
            const countryMatch = c.country_code.toLowerCase() === geo.country.toLowerCase();
            return cityMatch && stateMatch && countryMatch;
          });

          if (!isAllowed) {
            results.allowed = false;
            results.reason = "city_not_whitelisted";
            results.details = {
              detected_city: geo.city,
              detected_state: geo.region,
              detected_country: geo.country,
            };

            // Logar tentativa bloqueada
            await supabaseAdmin.from("access_blocked_log").insert({
              user_id: userId,
              email: userEmail,
              ip_address: clientIp,
              city: geo.city,
              state: geo.region,
              country: geo.country,
              block_reason: "city_not_whitelisted",
              user_agent: userAgent,
            });
          }
        }
      }
    }

    // ============ VERIFICAÇÃO DE TENTATIVAS FALHADAS ============
    if (settings.max_failed_attempts > 0) {
      const lockoutTime = new Date(Date.now() - settings.lockout_duration_minutes * 60 * 1000).toISOString();

      const { count } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .eq("success", false)
        .gte("created_at", lockoutTime);

      if ((count || 0) >= settings.max_failed_attempts) {
        results.allowed = false;
        results.reason = "too_many_attempts";
        results.details = {
          attempts: count,
          lockout_minutes: settings.lockout_duration_minutes,
        };
      }
    }

    console.log(`Access check for ${userEmail} from ${clientIp}: ${results.allowed ? "ALLOWED" : "BLOCKED"} (${results.reason})`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro na validação de acesso:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", allowed: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
