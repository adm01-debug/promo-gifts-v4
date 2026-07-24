/**
 * api/sitemap.ts — Sitemap XML Dinâmico
 *
 * Vercel Serverless Function que gera sitemap.xml completo
 * a partir de vw_sitemap_all (produtos + categorias) no Supabase.
 *
 * URL pública: https://www.promogifts.com.br/sitemap.xml
 * Cache: 12h (stale-while-revalidate: 24h) — Google reindexação diária
 *
 * Pré-requisito: vercel.json deve mapear /sitemap.xml → /api/sitemap
 * fix_version: seo_sitemap_dynamic_v1_20260627
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://doufsxqlfjyuvxuezpln.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc';
const BASE_URL = 'https://www.promogifts.com.br';
const PAGE_SIZE = 1000;

interface SitemapRow {
  url_type: string;
  url_path: string;
  identifier: string;
  title: string;
  lastmod: string;
  priority: number;
  changefreq: string;
  image_url: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchPage(offset: number): Promise<SitemapRow[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/vw_sitemap_all` +
    `?select=url_type,url_path,identifier,title,lastmod,priority,changefreq,image_url` +
    `&order=priority.desc,lastmod.desc` +
    `&offset=${offset}&limit=${PAGE_SIZE}`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Supabase REST error: ${res.status}`);
  return (await res.json()) as SitemapRow[];
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Paginar até 15.000 URLs (suficiente para 7k produtos + 413 categorias)
    const allRows: SitemapRow[] = [];
    let offset = 0;

    while (offset < 15_000) {
      const page = await fetchPage(offset);
      if (!page || page.length === 0) break;
      allRows.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Adicionar homepage estática
    const staticUrls: SitemapRow[] = [
      {
        url_type: 'static',
        url_path: '/',
        identifier: 'home',
        title: 'Início',
        lastmod: new Date().toISOString(),
        priority: 1.0,
        changefreq: 'daily',
        image_url: null,
      },
    ];

    const rows = [...staticUrls, ...allRows];

    // Gerar XML
    const urlset = rows
      .map((row) => {
        const loc = `${BASE_URL}${row.url_path}`;
        const lastmod = row.lastmod ? new Date(row.lastmod).toISOString().split('T')[0] : '';
        const imageTag =
          row.image_url
            ? `
    <image:image>
      <image:loc>${escapeXml(row.image_url)}</image:loc>
      <image:title>${escapeXml(row.title || '')}</image:title>
    </image:image>`
            : '';

        return `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${row.changefreq || 'weekly'}</changefreq>
    <priority>${(row.priority || 0.7).toFixed(1)}</priority>${imageTag}
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlset}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    // Cache 12h, stale-while-revalidate 24h — Google não precisa de tempo real
    res.setHeader(
      'Cache-Control',
      'public, max-age=43200, stale-while-revalidate=86400'
    );
    res.setHeader('X-Sitemap-Count', String(rows.length));
    res.status(200).send(xml);
  } catch (err) {
    console.error('[sitemap] Error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Sitemap unavailable</error>');
  }
}
