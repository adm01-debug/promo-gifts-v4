// generate-blurhashes — P2.9
// Computes blurhash strings for verified product images (JPEG + PNG + WebP + GIF).
// Downloads each image, decodes pixels with pure-JS decoders, resizes to
// 32×32, then encodes with wolt/blurhash.
//
// WebP/GIF strategy: CF Images serves the /thumbnail variant as JPEG regardless
// of the original upload format. For webp/gif images we fetch /thumbnail instead
// of /public and trust the content-type header for decoder selection.
//
// Called by pg_cron job 'generate-blurhashes' every 5 minutes.
//
// Coverage: JPEG+PNG+WebP+GIF ≈ 99.9% of all verified product images.
// Throughput: 40 images/invocation × 12/hour ≈ 480 hashes/hour.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { authorizeCron } from '../_shared/dispatcher-auth.ts'
import { encode } from 'https://esm.sh/blurhash@2.0.5'
import jpeg from 'https://esm.sh/jpeg-js@0.4.4'
import { decode as decodePng } from 'https://esm.sh/fast-png@6.0.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BATCH_SIZE = 40
const FETCH_TIMEOUT_MS = 15000
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const THUMB_W = 32
const THUMB_H = 32

// Formats processed via thumbnail fallback (CF converts to JPEG internally)
const ALT_FORMATS = new Set(['webp', 'gif'])
// All formats included in the pickup query
const PICKUP_FORMATS = ['jpeg', 'png', 'webp', 'gif']

interface ImgRow {
  id: string
  url_cdn: string
  format: string | null
}

// Convert arbitrary-channel 8-bit pixel buffer to RGBA Uint8Array.
function toRgba8(data: Uint8Array, channels: number): Uint8Array {
  if (channels === 4) return data
  const pixels = data.length / channels
  const rgba = new Uint8Array(pixels * 4)
  for (let i = 0; i < pixels; i++) {
    if (channels === 3) {
      rgba[i * 4] = data[i * 3]
      rgba[i * 4 + 1] = data[i * 3 + 1]
      rgba[i * 4 + 2] = data[i * 3 + 2]
      rgba[i * 4 + 3] = 255
    } else if (channels === 1) {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i]
      rgba[i * 4 + 3] = 255
    } else if (channels === 2) {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i * 2]
      rgba[i * 4 + 3] = data[i * 2 + 1]
    }
  }
  return rgba
}

// Nearest-neighbour resize to THUMB_W × THUMB_H → Uint8ClampedArray (RGBA).
function thumbResize(src: Uint8Array, srcW: number, srcH: number): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(THUMB_W * THUMB_H * 4)
  for (let y = 0; y < THUMB_H; y++) {
    const sy = Math.floor(y * srcH / THUMB_H)
    for (let x = 0; x < THUMB_W; x++) {
      const sx = Math.floor(x * srcW / THUMB_W)
      const si = (sy * srcW + sx) * 4
      const di = (y * THUMB_W + x) * 4
      dst[di] = src[si]; dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3]
    }
  }
  return dst
}

async function computeBlurhash(img: ImgRow): Promise<{ id: string; blurhash: string } | null> {
  try {
    // For WebP/GIF originals: CF Images converts the /thumbnail variant to JPEG
    // regardless of original upload format. Fetching /public would return the
    // original WebP/GIF which our pure-JS decoders cannot handle.
    const isAltFormat = img.format !== null && ALT_FORMATS.has(img.format)
    const fetchUrl = isAltFormat
      ? img.url_cdn.replace(/\/[^/]+$/, '/thumbnail')
      : img.url_cdn

    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) {
      console.warn('generate-blurhashes: fetch_failed', {
        id: img.id,
        status: res.status,
        db_format: img.format,
        fetch_url: fetchUrl,
      })
      return null
    }

    const contentType = res.headers.get('content-type') ?? ''

    // CRITICAL: trust content-type, NOT img.format from DB.
    // For webp/gif images we fetched /thumbnail which CF converts to JPEG,
    // so img.format='webp' but content-type='image/jpeg' → must use jpeg decoder.
    const fmt =
      contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' :
      contentType.includes('png') ? 'png' : null

    if (fmt === null) {
      console.log('generate-blurhashes: skip_undecoded_format', {
        id: img.id,
        db_format: img.format,
        content_type: contentType,
        fetch_url: fetchUrl,
      })
      return null
    }

    const cl = res.headers.get('content-length')
    if (cl && parseInt(cl, 10) > MAX_IMAGE_BYTES) return null

    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > MAX_IMAGE_BYTES) return null

    let rgba: Uint8Array
    let width: number
    let height: number

    if (fmt === 'jpeg') {
      const dec = jpeg.decode(buf, { useTArray: true, tolerantDecoding: true })
      rgba = dec.data as Uint8Array
      width = dec.width
      height = dec.height
    } else {
      const dec = decodePng(buf)
      // fast-png may return Uint16Array for 16-bit PNGs — skip those
      if (!(dec.data instanceof Uint8Array)) return null
      rgba = toRgba8(dec.data, dec.channels ?? 4)
      width = dec.width
      height = dec.height
    }

    const thumb = thumbResize(rgba, width, height)
    const hash = encode(thumb, THUMB_W, THUMB_H, 4, 3)
    return { id: img.id, blurhash: hash }
  } catch (err) {
    console.warn('generate-blurhashes: error', { id: img.id, err: String(err) })
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cronAuth = await authorizeCron(req, {
    corsHeaders: { 'Content-Type': 'application/json' },
    secretEnvName: 'GENERATE_BLURHASHES_CRON_SECRET',
    headerName: 'x-cron-secret',
  })
  if (!cronAuth.ok) return cronAuth.response

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: images, error: selectErr } = await supabase
    .from('product_images')
    .select('id, url_cdn, format')
    .is('blurhash', null)
    .eq('cf_sync_status', 'verified')
    .is('deleted_at', null)
    .in('format', PICKUP_FORMATS)
    .order('is_primary', { ascending: false })
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (selectErr) {
    console.error('generate-blurhashes: select_failed', { message: selectErr.message })
    return new Response(JSON.stringify({ error: 'select_failed', detail: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!images || images.length === 0) {
    const { count: remaining } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .is('blurhash', null)
      .eq('cf_sync_status', 'verified')
      .is('deleted_at', null)
      .in('format', PICKUP_FORMATS)
    return new Response(
      JSON.stringify({ done: true, remaining: remaining ?? 0, message: 'all processable images have blurhash' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Track webp/gif attempts separately for monitoring
  const altFormatImages = (images as ImgRow[]).filter(i => i.format !== null && ALT_FORMATS.has(i.format))

  const settled = await Promise.allSettled(
    (images as ImgRow[]).map(img => computeBlurhash(img))
  )

  const successes = settled
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<{ id: string; blurhash: string }>).value)

  let updatedCount = 0
  for (const u of successes) {
    const { error: updErr } = await supabase
      .from('product_images')
      .update({ blurhash: u.blurhash })
      .eq('id', u.id)
      .is('blurhash', null)  // idempotency guard
    if (!updErr) updatedCount++
  }

  const { count: remaining } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .is('blurhash', null)
    .eq('cf_sync_status', 'verified')
    .is('deleted_at', null)
    .in('format', PICKUP_FORMATS)

  console.log('generate-blurhashes: batch_complete', {
    processed: images.length,
    hashed: successes.length,
    updated: updatedCount,
    failed: images.length - successes.length,
    webp_gif_attempted: altFormatImages.length,
    remaining,
  })

  return new Response(
    JSON.stringify({
      processed: images.length,
      hashed: successes.length,
      updated: updatedCount,
      failed: images.length - successes.length,
      webp_gif_attempted: altFormatImages.length,
      remaining: remaining ?? 'unknown',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
