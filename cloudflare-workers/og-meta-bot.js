/** cloudflare-workers/og-meta-bot.js -- OG Meta Bot Middleware
 * fix_version: seo_og_bot_worker_v1_20260627
 * Detecta bots (WhatsApp/Facebook/X/Slack) e injeta OG meta tags estaticas.
 * Deploy: CF Dashboard > Workers > Create > colar codigo.
 * Routes: promogifts.com.br/produto/* e /categoria/*
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY
 */
const BOT_UAS=["facebookexternalhit","twitterbot","whatsapp","slackbot","telegrambot","linkedinbot","discordbot","pinterest","googlebot","bingbot","applebot","embedly","ia_archiver"];
const isBot=ua=>BOT_UAS.some(p=>(ua||"").toLowerCase().includes(p));
const esc=s=>(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
async function sbFetch(url,key){const r=await fetch(url,{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)return null;const d=await r.json();return Array.isArray(d)?d[0]||null:null;}
function buildHtml(m,base){
  const t=esc(m.og_title||m.meta_title||m.name||"Promo Brindes");
  const d=esc(m.og_description||m.meta_description||"Brindes corporativos personalizados.");
  const img=esc(m.og_image_url||m.image_url||base+"/og-image.png");
  const can=esc(base+(m.canonical_url||"/produto/"+(m.slug||"")));
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${t}</title><meta name="description" content="${d}"/><link rel="canonical" href="${can}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Promo Brindes"/><meta property="og:title" content="${t}"/><meta property="og:description" content="${d}"/><meta property="og:image" content="${img}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:url" content="${can}"/><meta property="og:locale" content="pt_BR"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${t}"/><meta name="twitter:description" content="${d}"/><meta name="twitter:image" content="${img}"/><meta http-equiv="refresh" content="0; url=${can}"/></head><body><a href="${can}">${t}</a></body></html>`;
}
export default{async fetch(request,env){
  const ua=request.headers.get("User-Agent")||"";
  if(!isBot(ua))return fetch(request);
  const{pathname,protocol,host}=new URL(request.url);
  const base=protocol+"//"+host;
  const SB=env.SUPABASE_URL||"https://doufsxqlfjyuvxuezpln.supabase.co";
  const KEY=env.SUPABASE_ANON_KEY||"";
  const hdrs={"Content-Type":"text/html; charset=UTF-8","Cache-Control":"public, max-age=3600, stale-while-revalidate=86400"};
  try{
    const pm=pathname.match(/^\/produto\/([^/?#]+)/);
    if(pm){const row=await sbFetch(SB+"/rest/v1/products?slug=eq."+encodeURIComponent(pm[1])+"&select=name,meta_title,meta_description,og_title,og_description,og_image_url,canonical_url,slug&is_deleted=eq.false&is_active=eq.true&limit=1",KEY);if(row)return new Response(buildHtml(row,base),{headers:{...hdrs,"X-OG-Source":"product"}});}
    const cm=pathname.match(/^\/categoria\/([^/?#]+)/);
    if(cm){const row=await sbFetch(SB+"/rest/v1/categories?slug=eq."+encodeURIComponent(cm[1])+"&select=name,meta_title,meta_description,image_url,slug&is_active=eq.true&limit=1",KEY);if(row)return new Response(buildHtml(row,base),{headers:{...hdrs,"X-OG-Source":"category"}});}
  }catch(e){console.error("[og-meta-bot]",e);}
  return fetch(request);
}};
