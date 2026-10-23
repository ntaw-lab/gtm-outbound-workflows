// Extracted from workflows/flow-4-company-qualifier.json, Code node "5.6 Parse Haiku verdict".
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
      if (obj && typeof obj === 'object' && 'is_icp' in obj) return obj;
    } catch (e) {}
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    try { return JSON.parse(text.substring(blocks[i][0], blocks[i][1])); } catch (e) {}
  }
  return null;
}
function clamp(n, min, max) { const x = typeof n === 'number' ? n : 0; return Math.max(min, Math.min(max, x)); }
function sizePtsFromCount(emp) {
  if (!emp || emp < 1) return 0;
  if (emp <= 10) return 0;
  if (emp <= 50) return 15;
  if (emp <= 200) return 20;
  if (emp <= 500) return 5;
  return 0;
}

const all = $input.all();
const out = [];
for (let i = 0; i < all.length; i++) {
  const item = all[i];
  const t = item.json?.content?.[0]?.text || '';
  const v = findLastValidJson(t) || {};
  const orig = $('2b. Split companies → items').itemMatching(i)?.json || {};
  const empCount = Number(orig.numberofemployees || 0);

  const bk = v.score_breakdown || {};
  const industry_pts = clamp(bk.industry_pts, 0, 40);
  const country_pts = clamp(bk.country_pts, 0, 25);
  const size_pts_haiku = clamp(bk.size_pts, 0, 20);
  const size_pts_computed = sizePtsFromCount(empCount);
  const size_pts = empCount > 0 ? size_pts_computed : size_pts_haiku;
  const signals_pts = clamp(bk.signals_pts, 0, 15);

  const disqNum = v.disqualif_number && /^[1-5]$/.test(String(v.disqualif_number).trim()) ? String(v.disqualif_number).trim() : null;
  const sum = industry_pts + country_pts + size_pts + signals_pts;
  const score = disqNum ? 0 : sum;
  const is_icp = !disqNum && score >= 50;

  // Doubt flag — extended V3.8 to catch more false positives:
  // (a) ANY disqualif #2 or #5 (no sum threshold, since Haiku can also undervalue industry on healthcare/govtech)
  // (b) Score 40-55 sans disqualif (close to threshold)
  // (c) Industry undervalued (0 or 10 pts) but HQ France/EU detected + size in 11-500 range
  //     → suspicious that valid SaaS B2B got tagged as 'consulting/IT services'
  const _doubt = (
    disqNum === '1' && sum >= 50 ||  // V3.9: B2C marketplace claims souvent fausses sur SaaS B2B pour brands B2C
    disqNum === '2' ||
    disqNum === '5' ||
    (!disqNum && score >= 40 && score <= 55) ||
    (industry_pts <= 10 && country_pts >= 10 && empCount >= 11 && empCount <= 500)
  );

  out.push({
    json: {
      ...orig,
      _verdict: {
        is_icp, score,
        score_breakdown: { industry_pts, country_pts, size_pts, signals_pts },
        reason: v.reason || '',
        has_gtm_engineer: v.has_gtm_engineer === true,
        disqualif_number: disqNum,
        _doubt,
        _audit: {
          haiku_score: typeof v.score === 'number' ? v.score : null,
          haiku_is_icp: v.is_icp === true,
          haiku_breakdown: bk,
          numberofemployees: empCount,
          size_corrected: empCount > 0 && size_pts_haiku !== size_pts_computed,
          breakdown_sum_no_disq: sum,
        },
      },
    },
  });
}
return out;
