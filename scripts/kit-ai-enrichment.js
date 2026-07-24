#!/usr/bin/env node
// Kit AI Enrichment Pipeline
// SUPABASE_URL=... SUPABASE_SERVICE_KEY=... BATCH_SIZE=50 DRY_RUN=true node kit-ai-enrichment.js
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic();
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');

async function run() {
  const { data } = await supabase.from('product_kit_components')
    .select('id,component_name,component_type_code')
    .eq('enrichment_status','missing')
    .not('component_type_code','is',null)
    .limit(BATCH_SIZE);
  for (const comp of data) {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 300,
      messages: [{ role: 'user', content: `Retorne JSON com dimensões típicas em MM para componente de brinde: "${comp.component_name}" tipo "${comp.component_type_code}". Campos: shape_type, length_mm, width_mm, height_mm, diameter_mm, weight_g, confidence` }]
    });
    try {
      const dims = JSON.parse(msg.content[0].text.match(/\{[\s\S]*\}/)[0]);
      if (!DRY_RUN) {
        const { data: rawId } = await supabase.rpc('fn_extract_dimensions_from_text', { p_kit_component_id: comp.id, p_source_text: comp.component_name, p_extracted_data: dims, p_confidence: dims.confidence || 0.7 });
        if (rawId) {
          const { data: padId } = await supabase.rpc('fn_standardize_kit_component', { p_raw_id: rawId });
          if (padId) {
            await supabase.from('kit_component_padronizacao').update({ padronizacao_status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', padId);
            await supabase.rpc('fn_promote_kit_component_padronizacao', { p_pad_id: padId });
          }
        }
      }
      console.log(`OK: ${comp.component_name}`);
    } catch(e) { console.error(`ERR: ${comp.component_name}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 200));
  }
}
run().catch(console.error);
