#!/usr/bin/env python3
"""Asia Import - Batch extraction de dimensões dos kits via API MCP Worker"""
import urllib.request, re, json, sys, time

SUPA = 'https://doufsxqlfjyuvxuezpln.supabase.co'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM4NjY0MywiZXhwIjoyMDgyOTYyNjQzfQ.97elRH8MIOfybKMog91JStBOzVx4elcgMTQH0Fw68N8'
ASIA_MCP = 'https://asia-import-mcp.adm01.workers.dev/mcp'
DRY = '--dry' in sys.argv
HDRS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}

# TYPE_MAP: mapeamento de slug de propriedade para component_type_code
SLUG_TYPE = {
    'anel': ['ANEL_SALVA_GOTAS'], 'anel-corta': ['ANEL_SALVA_GOTAS'],
    'bico': ['BICO_DOSADOR'], 'bico-dosador': ['BICO_DOSADOR'],
    'saca-rolha': ['SACA_ROLHAS'], 'rolha': ['ROLHA_VACUO','SACA_ROLHAS'],
    'vedador': ['ROLHA_VACUO'],
    'faca': ['FACA','FACA_TRINCHAR'], 'garfo': ['GARFO'],
    'tabua': ['TABUA'], 'tábua': ['TABUA'], 'chaira': ['CHAIRA'],
    'caneta': ['CANETA'], 'lapiseira': ['LAPISEIRA'],
    'caderno': ['CADERNO'], 'régua': ['REGUA'], 'regua': ['REGUA'],
    'caixa': ['CAIXA'], 'estojo': ['CAIXA','ESTOJO_NYLON'],
    'garrafa': ['GARRAFA'], 'coqueteleira': ['COQUETELEIRA'],
    'copo': ['COPO'], 'chaveiro': ['CHAVEIRO'],
    'pegador': ['PEGADOR'], 'pinca': ['PEGADOR'],
    'socador': ['SOCADOR'], 'pilao': ['SOCADOR'],
    'palito': ['FERRAMENTAS'], 'espátula': ['ESPATULA'], 'espatula': ['ESPATULA'],
    'porta-cartao': ['PORTA_CARTAO'], 'porta-cartão': ['PORTA_CARTAO'],
}

def parse_dim_valor(valor):
    """Parsear valor de dimensão do Asia. Formatos: 'LxWcm', 'ø Dcm', 'L,L x W,Wcm' etc."""
    v = valor.strip()
    weight_g = None
    l_mm = w_mm = d_mm = h_mm = None
    
    # Peso
    if 'kg' in v.lower():
        kg_m = re.search(r'(\d+[,.]?\d*)\s*kg', v, re.I)
        if kg_m: weight_g = round(float(kg_m.group(1).replace(',','.'))*1000)
        return {'weight_g': weight_g}
    
    # Cilíndrico: ø D x H ou ø D
    cyl = re.search(r'ø\s*(\d+[,.]?\d*)\s*(?:x|X|×)?\s*(\d+[,.]?\d*)?\s*cm', v, re.I)
    if cyl:
        d_mm = round(float(cyl.group(1).replace(',','.'))*10)
        h_mm = round(float(cyl.group(2).replace(',','.'))*10) if cyl.group(2) else None
        return {'diameter_mm': d_mm, 'height_mm': h_mm, 'shape_type': 'cylindrical'}
    
    # 3D: L x W x H cm
    r3 = re.match(r'(\d+[,.]?\d*)\s*[x×]\s*(\d+[,.]?\d*)\s*[x×]\s*(\d+[,.]?\d*)\s*cm', v, re.I)
    if r3:
        l_mm = round(float(r3.group(1).replace(',','.'))*10)
        w_mm = round(float(r3.group(2).replace(',','.'))*10)
        h_mm = round(float(r3.group(3).replace(',','.'))*10)
        return {'length_mm': l_mm, 'width_mm': w_mm, 'height_mm': h_mm}
    
    # 2D: L x W cm
    r2 = re.match(r'(\d+[,.]?\d*)\s*[x×]\s*(\d+[,.]?\d*)\s*cm', v, re.I)
    if r2:
        l_mm = round(float(r2.group(1).replace(',','.'))*10)
        w_mm = round(float(r2.group(2).replace(',','.'))*10)
        return {'length_mm': l_mm, 'width_mm': w_mm}
    
    return None

def match_slug_to_comp(slug, comps):
    """Mapear slug de propriedade para componente do kit."""
    slug_n = slug.replace('dimensao-','').replace('dimensão-','')
    matched = []
    for c in comps:
        ct = c.get('component_type_code','') or ''
        cn = c.get('component_name','').lower()
        for key, types in SLUG_TYPE.items():
            if key in slug_n and ct in types:
                matched.append(c); break
        else:
            if slug_n in cn or cn[:min(len(slug_n),8)] in slug_n:
                matched.append(c)
    return matched[:1]  # retornar melhor match

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
    req = urllib.request.Request(f'{SUPA}{path}', data=data, headers={**HDRS,'Prefer':'return=minimal'})
    req.get_method = lambda: 'PATCH'
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status

def asia_detalhe(ref):
    payload = json.dumps({'jsonrpc':'2.0','method':'tools/call','params':{'name':'asia_detalhe_produto','arguments':{'referencia':ref}},'id':1}).encode()
    req = urllib.request.Request(ASIA_MCP, data=payload, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        resp = json.loads(r.read())
    content = resp.get('result',{}).get('content',[{}])
    return json.loads(content[0]['text']) if content else {}

def run():
    print(f"[ASIA-DIMS] dry={DRY}")
    # Buscar kits Asia com componentes missing
    comps = supa_get('/rest/v1/product_kit_components?select=id,component_name,component_type_code,kit_product_id,is_packaging&enrichment_status=eq.missing&limit=500')
    if not comps: print('Sem missing'); return
    
    kit_ids = list({c['kit_product_id'] for c in comps})
    ids_str = ','.join(f'"{k}"' for k in kit_ids)
    prods = supa_get(f'/rest/v1/products?select=id,supplier_reference&id=in.({ids_str})&supplier_id=eq.d2734e23-d633-4819-bb15-e51aa44e2118')
    kit_map = {p['id']: p['supplier_reference'] for p in prods}
    
    by_kit = {}
    for c in comps:
        if c['kit_product_id'] in kit_map:
            by_kit.setdefault(c['kit_product_id'],[]).append(c)
    
    stats = dict(kits=0, props=0, promoted=0, skip=0, err=0)
    
    for kit_id, ks in by_kit.items():
        ref = kit_map[kit_id]
        try:
            prod = asia_detalhe(ref)
            props = prod.get('propriedades', [])
            dims_cm = prod.get('dimensoes_cm', {})
            peso_kg = prod.get('peso_kg')
            stats['kits'] += 1
            
            # Por componente via propriedades
            kit_dims = {}
            for p in props:
                slug = p.get('slug','')
                if 'dimensao' in slug and slug != 'dimensao-produto' and slug != 'dimensao-caixa':
                    d = parse_dim_valor(p.get('valor',''))
                    if d: kit_dims[slug] = d
            
            # Kit geral como fallback
            kit_gen = None
            if dims_cm:
                kit_gen = {
                    'height_mm': round(dims_cm.get('altura',0)*10) or None,
                    'width_mm':  round(dims_cm.get('largura',0)*10) or None,
                    'length_mm': round(dims_cm.get('comprimento',0)*10) or None,
                    'weight_g':  round(peso_kg*1000) if peso_kg else None
                }
            
            per_peso = round(peso_kg*1000/len(ks)) if peso_kg else None
            print(f"  {ref}: {len(ks)}c {len(kit_dims)}props peso={peso_kg}kg", flush=True)
            
            for c in ks:
                dim_found = None
                ct = c.get('component_type_code','') or ''
                cn = c.get('component_name','').lower()
                
                # Tentar via propriedades nomeadas
                for slug, d in kit_dims.items():
                    for key, types in SLUG_TYPE.items():
                        if key in slug and ct in types:
                            dim_found = {**d, 'source': f'asia_prop:{slug}'}; break
                    if dim_found: break
                
                # Fallback: kit geral
                if not dim_found and kit_gen:
                    dim_found = {**kit_gen, 'source': 'asia_kit_geral'}
                
                if not dim_found:
                    stats['skip'] += 1; continue
                
                stats['props'] += 1
                if not DRY:
                    raw_id = supa_rpc('fn_extract_dimensions_from_text', {
                        'p_kit_component_id': c['id'],
                        'p_source_text': f'asia:{ref}:{dim_found.get("source","")}',
                        'p_extracted_data': {
                            'unit':'mm',
                            'length_mm':   dim_found.get('length_mm'),
                            'width_mm':    dim_found.get('width_mm'),
                            'height_mm':   dim_found.get('height_mm'),
                            'diameter_mm': dim_found.get('diameter_mm'),
                            'weight_g':    dim_found.get('weight_g', per_peso),
                            'is_packaging': c['is_packaging'],
                            'shape_type':  dim_found.get('shape_type','rectangular'),
                            'source_field': 'asia_api'
                        },
                        'p_confidence': 0.85
                    })
                    if raw_id and isinstance(raw_id, str):
                        pad_id = supa_rpc('fn_standardize_kit_component', {'p_raw_id': raw_id})
                        if pad_id:
                            supa_patch(f'/rest/v1/kit_component_padronizacao?id=eq.{pad_id}',
                                {'padronizacao_status':'approved','reviewed_at':'now()'})
                            supa_rpc('fn_promote_kit_component_padronizacao', {'p_pad_id': pad_id})
                            stats['promoted'] += 1
            
            time.sleep(0.5)
        except Exception as e:
            print(f"  ✗ {ref}: {e}"); stats['err'] += 1
    
    print('\nResultado:', stats)

run()
