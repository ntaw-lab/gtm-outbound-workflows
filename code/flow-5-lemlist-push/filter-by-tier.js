// Extracted from workflows/flow-5-lemlist-push.json, Code node "5. Filter by tier + prepare items".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const params = $('2. Normalize Input').first().json;
const search = $input.first().json;
const all = search.results || [];

const SALES_TIERS = new Set(['1_cro_vp_sales', '2_director_of_sales', '3_revops_lead']);
const CEO_TIERS = new Set(['4_ceo_fallback']);

const out = [];
for (const c of all) {
  const p = c.properties || {};
  const tier_key = p.persona_tier || '';
  const isSales = SALES_TIERS.has(tier_key);
  const isCeo = CEO_TIERS.has(tier_key);

  // Apply tier filter
  if (params.tier === 'sales' && !isSales) continue;
  if (params.tier === 'ceo' && !isCeo) continue;
  // 'all' = accept both

  // Skip if no email or no LinkedIn URL (Lemlist needs email for the lead key)
  if (!p.email) continue;
  if (!p.tam_linkedin_url) continue;

  const target_campaign = isSales ? params.campaign_direction_sales :
                          isCeo ? params.campaign_ceo_fallback : null;
  if (!target_campaign) continue;

  out.push({
    json: {
      hs_id: c.id,
      email: p.email,
      firstName: p.firstname || '',
      lastName: p.lastname || '',
      companyName: p.company || '',
      jobTitle: p.job_title_lemlist || p.jobtitle || '',
      linkedinUrl: p.tam_linkedin_url || '',
      persona_tier: tier_key,
      score_persona: p.score_persona || 0,
      target_campaign,
      target_campaign_label: isSales ? 'Direction Sales' : 'CEO Fallback',
      mode: params.mode,
      is_dry_run: params.is_dry_run,
      run_id: params.run_id,
    }
  });
}
// Enforce batch_size cap (HS API floor is 10, so we trim post-filter)
const maxOut = Number(params.batch_size) || 10;
return out.slice(0, maxOut);
