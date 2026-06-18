// backfill-image-dimensions — E3+E4
// Fetches first 32KB of each image via Range header, parses binary headers to
// extract width/height/file_size. Processes BATCH_SIZE images per invocation.
// Called by pg_cron job #125 (every 5min) via net.http_post.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { authorizeCron } from '../_shared/dispatcher-auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BATCH_SIZE = 40
const RANGE_BYTES = 32767  // 32KB — enough for JPEG SOF with large EXIF

interface ImgRow {
  id: string
  url_cdn: string
  format: string
}

interface Dims {
  width: number
  height: number
  file_size: number | null
}

function parsePng(buf: ArrayBuffer): Dims | null {
  const b = new Uint8Array(buf)
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4E || b[3] !== 0x47) return null
  const v = new DataView(buf)
  return { width: v.getUint32(16), height: v.getUint32(20), file_size: null }
}

function parseJpeg(buf: ArrayBuffer): Dims | null {
  const b = new Uint8Array(buf)
  if (b[0] !== 0xFF || b[1] !== 0xD8) return null
  let i = 2
  while (i < b.length - 8) {
    if (b[i] !== 0xFF) { i++; continue }
    const marker = b[i + 1]
    // SOF0=C0, SOF1=C1, SOF2=C2, SOF3=C3, SOF5..C7, SOF9..CB, SOFD..CF
    if ((marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)) {
      const v = new DataView(buf)
      return { height: v.getUint16(i + 5), width: v.getUint16(i + 7), file_size: null }
    }
    if (i + 3 >= b.length) break
    const segLen = (b[i + 2] << 8) | b[i + 3]
    i += 2 + segLen
  }
  return null
}

function parseWebp(buf: ArrayBuffer): Dims | null {
  const b = new Uint8Array(buf)
  if (b[0] !== 0x52 || b[1] !== 0x49 || b[2] !== 0x46 || b[3] !== 0x46) return null
  if (b[8] !== 0x57 || b[9] !== 0x45 || b[10] !== 0x42 || b[11] !== 0x50) return null
  const chunkType = String.fromCharCode(b[12], b[13], b[14], b[15])
  const v = new DataView(buf)
  if (chunkType === 'VP8 ') {
    const w = (v.getUint16(26, true) & 0x3FFF) + 1
    const h = (v.getUint16(28, true) & 0x3FFF) + 1
    return { width: w, height: h, file_size: null }
  } else if (chunkType === 'VP8L') {
    const bits = v.getUint32(21, true)
    const w = (bits & 0x3FFF) + 1
    const h = ((bits >> 14) & 0x3FFF) + 1
    return { width: w, height: h, file_size: null }
  } else if (chunkType === 'VP8X') {
    const w = ((b[24] | (b[25] << 8) | (b[26] << 16)) & 0xFFFFFF) + 1
    const h = ((b[27] | (b[28] << 8) | (b[29] << 16)) & 0xFFFFFF) + 1
    return { width: w, height: h, file_size: null }
  }
  return null
}

async function fetchDims(img: ImgRow): Promise<{ id: string; width: number; height: number; file_size: number | null } | null> {
  try {
    const res = await fetch(img.url_cdn, {
      headers: { Range: `bytes=0-${RANGE_BYTES}` },
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok && res.status !== 206) return null

    // Content-Range: bytes 0-32767/TOTAL → extract TOTAL for file_size
    let file_size: number | null = null
    const cr = res.headers.get('content-range')
    if (cr) {
      const m = cr.match(/\/(\d+)$/)
      if (m) file_size = parseInt(m[1], 10)
    } else {
      const cl = res.headers.get('content-length')
      if (cl) file_size = parseInt(cl, 10)
    }

    const buf = await res.arrayBuffer()
    let dims: Dims | null = null

    if (img.format === 'png')       dims = parsePng(buf)
    else if (img.format === 'jpeg') dims = parseJpeg(buf)
    else if (img.format === 'webp') dims = parseWebp(buf)

    if (!dims || dims.width <= 0 || dims.height <= 0) return null
    return { id: img.id, width: dims.width, height: dims.height, file_size }
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const cronAuth = await authorizeCron(req, {
    corsHeaders: { 'Content-Type': 'application/json' },
    secretEnvName: 'BACKFILL_DIM_CRON_SECRET',
    headerName: 'x-cron-secret',
  })
  if (!cronAuth.ok) return cronAuth.response

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Prioritize primary images, then by insertion order
  const { data: images, error } = await supabase
    .from('product_images')
    .select('id, url_cdn, format')
    .is('width_px', null)
    .eq('is_active', true)
    .not('format', 'is', null)
    .not('format', 'eq', 'gif')  // GIF: animated, skip
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('backfill-image-dimensions: select_batch_failed', { message: error.message })
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!images || images.length === 0) {
    return new Response(JSON.stringify({ done: true, remaining: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const settled = await Promise.allSettled(
    (images as ImgRow[]).map(img => fetchDims(img))
  )

  const updates: { id: string; width: number; height: number; file_size: number | null }[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) updates.push(r.value)
  }

  let updatedCount = 0
  for (const u of updates) {
    const patch: Record<string, unknown> = { width_px: u.width, height_px: u.height }
    if (u.file_size && u.file_size > 0) patch.file_size_bytes = u.file_size
    const { error: updErr } = await supabase
      .from('product_images')
      .update(patch)
      .eq('id', u.id)
    if (!updErr) updatedCount++
  }

  const { count: remaining } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .is('width_px', null)
    .eq('is_active', true)
    .not('format', 'is', null)
    .not('format', 'eq', 'gif')

  return new Response(
    JSON.stringify({
      processed: images.length,
      updated: updatedCount,
      failed: images.length - updates.length,
      remaining: remaining ?? 'unknown'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
