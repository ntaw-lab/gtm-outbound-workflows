// Extracted from workflows/flow-2-persona-enricher.json, Code node "10.5 Parse persona verdict".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

function findLastValidJson(text) {
  if (!text) return null;
  const blocks = []; let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') { depth--; if (depth === 0 && start >= 0) { blocks.push([start, i + 1]); start = -1; } }
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(text.substring(blocks[i][0], blocks[i][1]));
      if (obj && typeof obj === 'object' && 'is_persona' in obj) return obj;
    } catch (e) {}
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    try { return JSON.parse(text.substring(blocks[i][0], blocks[i][1])); } catch (e) {}
  }
  return null;
}
function clamp(n, min, max) { const x = typeof n === 'number' ? n : 0; return Math.max(min, Math.min(max, x)); }

const all = $input.all();
const out = [];
for (let i = 0; i < all.length; i++) {
  const item = all[i];
  const t = item.json?.content?.[0]?.text || '';
  const v = findLastValidJson(t) || {};
  const orig = $('8. Filter title (FR + target titles)').itemMatching(i)?.json || {};

  const bk = v.score_breakdown || {};
  const tier_pts = clamp(bk.tier_pts, 0, 40);
  const tenure_pts = clamp(bk.tenure_pts, 0, 20);
  const concurrence_pts = clamp(bk.concurrence_pts, 0, 15);
  const signals_pts = clamp(bk.signals_pts, 0, 25);
  const sum = tier_pts + tenure_pts + concurrence_pts + signals_pts;

  const disqNum = v.disqualif_number && /^[1-5]$/.test(String(v.disqualif_number).trim()) ? String(v.disqualif_number).trim() : null;
  const tier = (typeof v.tier === 'number' && v.tier >= 1 && v.tier <= 4) ? v.tier : null;
  const score = disqNum ? 0 : sum;
  const is_persona = !disqNum && score >= 50 && tier !== null;

  // Doubt criteria for Sonnet review (V2)
  // (a) Disqualif #1, #2, #3 cited (Haiku safety bias on investor/recruiter/left-company)
  // (b) Score 40-55 sans disqualif (close to threshold)
  // (c) tier_pts <= 0 mais headline contient 'Sales' / 'Revenue' (potentielle erreur classification tier)
  const headline = String(orig.headline || orig.title || '').toLowerCase();
  const headlineHasSalesKeyword = /sales|revenue|cro|chief|vp|director|head of/i.test(headline);
  const _doubt = (
    disqNum === '1' ||
    disqNum === '2' ||
    disqNum === '3' ||
    (!disqNum && score >= 40 && score <= 55) ||
    (tier_pts <= 0 && headlineHasSalesKeyword)
  );

  const tier_keys = { 1: '1_cro_vp_sales', 2: '2_director_of_sales', 3: '3_revops_lead', 4: '4_ceo_fallback' };

  out.push({
    json: {
      ...orig,
      _verdict: {
        is_persona, score, tier,
        tier_key: tier ? tier_keys[tier] : '',
        score_breakdown: { tier_pts, tenure_pts, concurrence_pts, signals_pts },
        reason: v.reason || '',
        rice_preview: v.rice_preview || '',
        disqualif_number: disqNum,
        tenure_months: typeof v.tenure_months === 'number' ? v.tenure_months : null,
        _doubt,
        _audit: {
          haiku_score: typeof v.score === 'number' ? v.score : null,
          haiku_is_persona: v.is_persona === true,
          haiku_breakdown: bk,
          breakdown_sum_no_disq: sum,
        },
      },
    },
  });
}
return out;
