// hash-product-images — P2.7
// Computes SHA-256 (hex) for each verified product_image by downloading
// the full image from its CDN URL. Processes BATCH_SIZE per invocation.
// Called by pg_cron job 'hash-product-images' every 5 minutes.
//
// Throughput: 80 images/invocation × 12/hour ≈ 960 hashes/hour.
// At 72,047 verified images: ~75 hours to full coverage.
// After completion, duplicates become detectable via GROUP BY content_hash.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { authorizeCron } from '../_shared/dispatcher-auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BATCH_SIZE = 80
const FETCH_TIMEOUT_MS = 15000
const MAX_IMAGE_BYTES = 20 * 1024 * 1024  // 20MB guard — skip pathological images

interface ImgRow {
  id: string
  url_cdn: string
}

interface HashResult {
  id: string
  content_hash: string
  file_size_bytes: number
}

async function fetchAndHash(img: ImgRow): Promise<HashResult | null> {
  try {
    const res = await fetch(img.url_cdn, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn('hash-product-images: fetch_failed', { id: img.id, status: res.status })
      return null
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      console.warn('hash-product-images: image_too_large', { id: img.id, bytes: contentLength })
      return null
    }

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_IMAGE_BYTES) return null

    const hashBuf = await crypto.subtle.digest('SHA-256', buf)
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return { id: img.id, content_hash: hashHex, file_size_bytes: buf.byteLength }
  } catch (err) {
    console.warn('hash-product-images: fetch_error', { id: img.id, err: String(err) })
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
    secretEnvName: 'HASH_PRODUCT_IMAGES_CRON_SECRET',
    headerName: 'x-cron-secret',
  })
  if (!cronAuth.ok) return cronAuth.response

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: images, error: selectErr } = await supabase
    .from('product_images')
    .select('id, url_cdn')
    .is('content_hash', null)
    .eq('cf_sync_status', 'verified')
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (selectErr) {
    console.error('hash-product-images: select_failed', { message: selectErr.message })
    return new Response(JSON.stringify({ error: 'select_failed', detail: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!images || images.length === 0) {
    return new Response(
      JSON.stringify({ done: true, remaining: 0, message: 'all verified images hashed' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const settled = await Promise.allSettled(
    (images as ImgRow[]).map(img => fetchAndHash(img))
  )

  const hashed: HashResult[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value !== null) hashed.push(r.value)
  }

  let updatedCount = 0
  for (const u of hashed) {
    const patch: Record<string, unknown> = { content_hash: u.content_hash }
    // Also backfill file_size_bytes if missing — we downloaded the full image anyway
    if (u.file_size_bytes > 0) patch.file_size_bytes = u.file_size_bytes

    const { error: updErr } = await supabase
      .from('product_images')
      .update(patch)
      .eq('id', u.id)
      .is('content_hash', null)  // idempotency guard

    if (!updErr) updatedCount++
  }

  const { count: remaining } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .is('content_hash', null)
    .eq('cf_sync_status', 'verified')
    .is('deleted_at', null)

  console.log('hash-product-images: batch_complete', {
    processed: images.length,
    hashed: hashed.length,
    updated: updatedCount,
    failed: images.length - hashed.length,
    remaining,
  })

  return new Response(
    JSON.stringify({
      processed: images.length,
      hashed: hashed.length,
      updated: updatedCount,
      failed: images.length - hashed.length,
      remaining: remaining ?? 'unknown',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
