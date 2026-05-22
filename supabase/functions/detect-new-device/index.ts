import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

const DeviceInfoSchema = z.object({
  fingerprint: z.string().min(1).max(256),
  userAgent: z.string().max(1024),
  browserName: z.string().max(100),
  osName: z.string().max(100),
  deviceType: z.string().max(50),
});

const BodySchema = z.object({
  userId: z.string().uuid(),
  userEmail: z.string().email().max(255),
  deviceInfo: DeviceInfoSchema,
});

function jsonRes(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    const rawBody = await req.json();
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }

    const { userId, userEmail, deviceInfo } = parsed.data;

    // Check if device is already known
    const { data: existingDevice, error: fetchError } = await supabase
      .from("user_known_devices")
      .select("*")
      .eq("user_id", userId)
      .eq("device_fingerprint", deviceInfo.fingerprint)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let isNewDevice = false;
    let isNewIP = false;
    let deviceId: string | null = null;

    if (existingDevice) {
      isNewIP = existingDevice.ip_address !== clientIP;
      deviceId = existingDevice.id;

      await supabase
        .from("user_known_devices")
        .update({
          last_seen_at: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: deviceInfo.userAgent,
        })
        .eq("id", existingDevice.id);
    } else {
      isNewDevice = true;

      const { data: newDevice, error: insertError } = await supabase
        .from("user_known_devices")
        .insert({
          user_id: userId,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: clientIP,
          user_agent: deviceInfo.userAgent,
          browser_name: deviceInfo.browserName,
          os_name: deviceInfo.osName,
          device_type: deviceInfo.deviceType,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      deviceId = newDevice.id;
    }

    // If new device or new IP, create notification
    if (isNewDevice || isNewIP) {
      await supabase
        .from("device_login_notifications")
        .insert({
          user_id: userId,
          device_id: deviceId,
          ip_address: clientIP,
          user_agent: deviceInfo.userAgent,
          email_sent: false,
        });

      await supabase
        .from("workspace_notifications")
        .insert({
          user_id: userId,
          type: "security",
          category: "security",
          title: isNewDevice ? "Novo dispositivo detectado" : "Novo IP detectado",
          message: isNewDevice 
            ? `Login detectado de um novo dispositivo: ${deviceInfo.browserName} no ${deviceInfo.osName}`
            : `Login detectado de um novo endereço IP: ${clientIP}`,
          metadata: {
            device_fingerprint: deviceInfo.fingerprint,
            ip_address: clientIP,
            browser: deviceInfo.browserName,
            os: deviceInfo.osName,
            device_type: deviceInfo.deviceType,
          },
        });
    }

    return jsonRes(corsHeaders, {
      success: true,
      isNewDevice,
      isNewIP,
      deviceId,
      message: isNewDevice 
        ? "New device detected and registered" 
        : isNewIP 
          ? "Known device with new IP detected" 
          : "Known device",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return jsonRes(corsHeaders, { error: msg }, 500);
  }
});
