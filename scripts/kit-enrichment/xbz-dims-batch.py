#!/usr/bin/env python3
"""
xbz-dims-batch.py
Scraping em batch das dimensões dos kits XBZ
Suporta formatos:
 1. "Tamanho total aproximado (CxL): Nome L cm x W cm - ..."
 2. "Medidas Nome (A x L): L cm x W cm"
 3. "Altura: L cm / Largura: W cm" (kit geral)
"""
import urllib.request, urllib.parse, re, json, sys, time

SUPA = 'https://doufsxqlfjyuvxuezpln.supabase.co'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM4NjY0MywiZXhwIjoyMDgyOTYyNjQzfQ.97elRH8MIOfybKMog91JStBOzVx4elcgMTQH0Fw68N8'
DRY  = '--dry' in sys.argv
LIM  = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--limit=')), '60'))

HDRS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}

def norm(s):
    import unicodedata
    return unicodedata.normalize('NFD', s.lower()).encode('ascii','ignore').decode()

TYPE_MAP = {
    'faca':['FACA','FACA_TRINCHAR'],'garfo':['GARFO'],'colher':['COLHER'],
    'tabua':['TABUA'],'suporte':['TABUA'],'pinca':['PEGADOR'],'pegador':['PEGADOR'],
    'spatula':['ESPATULA'],'espatula':['ESPATULA'],'saca':['SACA_ROLHAS'],
    'abridor':['SACA_ROLHAS'],'caixa':['CAIXA'],'estojo':['CAIXA'],
    'chaveiro':['CHAVEIRO'],'caneta':['CANETA'],'caderno':['CADERNO'],
    'chaira':['CHAIRA'],'afiador':['CHAIRA'],'espeto':['FERRAMENTAS'],
    'pincel':['FERRAMENTAS'],'alicate':['FERRAMENTAS'],'chave':['FERRAMENTAS'],
    'necessaire':['NECESSAIRE'],'canudo':['CANUDO'],
    'lixa':['MANICURE'],'cortador':['MANICURE'],'pinca_m':['MANICURE'],
    'tesoura':['TESOURA'],
}

EXCLUDE_NAMES = {'aproximadas', 'para gravacao', 'para gravacao cxl', 'peso', 'peso e', 'geral'}

def supa_get(path):
    req = urllib.request.Request(f'{SUPA}{path}', headers=HDRS)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def supa_rpc(fn, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f'{SUPA}/rest/v1/rpc/{fn}', data=data, headers=HDRS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def supa_patch(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f'{SUPA}{path}', data=data, headers={**HDRS, 'Prefer': 'return=minimal'})
    req.get_method = lambda: 'PATCH'
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Chrome/124', 'Accept-Language': 'pt-BR'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='replace')

def parse_page(html):
    txt = re.sub(r'<[^>]+>', '', html)
    txt = re.sub(r'&[a-zA-Z0-9#]+;', ' ', txt)
    txt = re.sub(r'\s+', ' ', txt)
    dims = {}

    # Formato 1: "Tamanho total aproximado (CxL): Nome L cm x W cm - ..."
    t1 = re.search(r'Tamanho\s+total\s+aproximado\s*\(CxL\)\s*:?\s*(.+?)(?=\s*Peso\s+aproximado|\Z)', txt, re.I|re.DOTALL)
    if t1:
        for seg in re.split(r'\s*[–—]\s*|\s+[-]\s+', t1.group(1)):
            m = re.match(r'^(.{2,40}?)\s+(\d+[,.]?\d*)\s*cm\s*[x×]\s*(\d+[,.]?\d*)\s*cm', seg.strip(), re.I)
            if m:
                n = m.group(1).strip()
                nk = norm(n)
                if not any(ex in nk for ex in EXCLUDE_NAMES):
                    dims[nk] = {'name': n, 'l': round(float(m.group(2).replace(',','.'))*10), 'w': round(float(m.group(3).replace(',','.'))*10)}

    # Formato 2: "Medidas Nome (A x L): NNN cm x NNN cm"
    for m in re.finditer(r'Medidas?\s+([A-Za-zÀ-ú][A-Za-zÀ-ú ]{1,25}?)\s+\([AaCcLl]\s*[x×]\s*[AaCcLl]\)\s*:?\s*(\d+[,.]?\d*)\s*cm\s*[x×]\s*(\d+[,.]?\d*)\s*cm', txt, re.I):
        n = m.group(1).strip()
        nk = norm(n)
        if nk not in EXCLUDE_NAMES and 'aproximad' not in nk and 'gravac' not in nk:
            dims[nk] = {'name': n, 'l': round(float(m.group(2).replace(',','.'))*10), 'w': round(float(m.group(3).replace(',','.'))*10)}

    # Formato 3: Altura / Largura gerais
    ha = re.search(r'Altura\s*:\s*(\d+[,.]?\d*)\s*cm', txt, re.I)
    la = re.search(r'Largura\s*:\s*(\d+[,.]?\d*)\s*cm', txt, re.I)
    kit_gen = None
    if ha and la:
        kit_gen = {'l': round(float(ha.group(1).replace(',','.'))*10), 'w': round(float(la.group(1).replace(',','.'))*10)}

    peso_m = re.search(r'Peso\s+aproximado\s*\(g\)\s*:?\s*(\d+)', txt, re.I)
    kit_peso = int(float(peso_m.group(1))) if peso_m else None
    return dims, kit_gen, kit_peso

def match(comp, dims, kit_gen):
    cn = norm(comp['component_name'])
    ct = comp.get('component_type_code', '') or ''
    best = None; score = 0
    for dn, d in dims.items():
        s = 0
        w1 = cn.split()[0] if cn.split() else cn
        dw1 = dn.split()[0] if dn.split() else dn
        if dn[:len(w1)] == w1[:len(dn)] or cn[:len(dw1)] == dw1[:len(cn)]: s += 3
        for k, ts in TYPE_MAP.items():
            if k in dn and ct in ts: s += 5; break
        if s > score: score = s; best = d
    if score >= 2: return best
    # Fallback: kit_gen para qualquer componente
    if kit_gen: return {'l': kit_gen['l'], 'w': kit_gen['w'], 'name': '_kit_geral'}
    return None

def run():
    print(f"[XBZ-DIMS] dry={DRY} limit={LIM}")
    # Buscar kits XBZ com componentes missing
    comps = supa_get(f'/rest/v1/product_kit_components?select=id,component_name,component_type_code,kit_product_id,is_packaging&enrichment_status=eq.missing&limit={LIM*6}')
    if not comps: print("Nenhum missing"); return

    kit_ids = list({c['kit_product_id'] for c in comps})[:LIM]
    ids_str = ','.join(f'"{k}"' for k in kit_ids)
    prods = supa_get(f'/rest/v1/products?select=id,supplier_reference,sku,supplier_id&id=in.({ids_str})')
    # Filtrar apenas XBZ (supplier_id = d6718a29-e954-4c1b-bd84-03ea24884900)
    XBZ_SUPPLIER = 'd6718a29-e954-4c1b-bd84-03ea24884900'
    kit_map = {p['id']: p['supplier_reference'] or p['sku'] for p in prods if p.get('supplier_id') == XBZ_SUPPLIER}

    by_kit = {}
    for c in comps:
        if c['kit_product_id'] in kit_map:
            by_kit.setdefault(c['kit_product_id'], []).append(c)

    stats = dict(kits=0, matches=0, promoted=0, skip=0, err=0)
    for kit_id, ks in list(by_kit.items())[:LIM]:
        ref = kit_map[kit_id]
        try:
            html = fetch(f'https://www.xbzbrindes.com.br/{ref}')
            dims, kit_gen, kit_peso = parse_page(html)
            per_peso = round(kit_peso / len(ks)) if kit_peso and kit_peso > 0 else None
            stats['kits'] += 1
            matched = [(c, match(c, dims, kit_gen)) for c in ks]
            good = [(c, m) for c, m in matched if m]
            stats['matches'] += len(good); stats['skip'] += len(ks) - len(good)
            print(f"  {ref}: {len(ks)}c → {len(dims)}segs → {len(good)}ok peso={kit_peso}", flush=True)

            if not DRY:
                for c, m in good:
                    raw_id = supa_rpc('fn_extract_dimensions_from_text', {
                        'p_kit_component_id': c['id'],
                        'p_source_text': f'xbz:{ref}:{m["name"]}',
                        'p_extracted_data': {'unit':'mm','length_mm':m['l'],'width_mm':m['w'],
                            'weight_g':per_peso,'is_packaging':c['is_packaging'],
                            'shape_type':'flat','source_field':'xbz_site'},
                        'p_confidence': 0.80
                    })
                    if raw_id and isinstance(raw_id, str):
                        pad_id = supa_rpc('fn_standardize_kit_component', {'p_raw_id': raw_id})
                        if pad_id:
                            supa_patch(f'/rest/v1/kit_component_padronizacao?id=eq.{pad_id}',
                                {'padronizacao_status':'approved','reviewed_at':'now()'})
                            supa_rpc('fn_promote_kit_component_padronizacao', {'p_pad_id': pad_id})
                            stats['promoted'] += 1
            time.sleep(0.3)
        except Exception as e:
            print(f"  ✗ {ref}: {e}")
            stats['err'] += 1
    print('\nResultado:', stats)

run()
