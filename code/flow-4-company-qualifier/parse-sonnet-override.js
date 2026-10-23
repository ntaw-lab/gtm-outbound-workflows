// Extracted from workflows/flow-4-company-qualifier.json, Code node "5.9 Parse Sonnet + Override".
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
  return null;
}
function clamp(n, min, max) { const x = typeof n === 'number' ? n : 0; return Math.max(min, Math.min(max, x)); }
function sizePtsFromCount(emp) {
  if (!emp || emp < 1) return 0;
  if (emp <= 10) return 0; if (emp <= 50) return 15; if (emp <= 200) return 20; if (emp <= 500) return 5;
  return 0;
}

const all = $input.all();
const out = [];
for (let i = 0; i < all.length; i++) {
  const item = all[i];
  const t = item.json?.content?.[0]?.text || '';
  const v = findLastValidJson(t) || {};
  // Get original company data — IF TRUE branch passes the item with _verdict from Haiku
  // We need the company props from the input that triggered this
  // Actually the input item.json contains the Sonnet HTTP response, not the original.
  // In n8n, when an HTTP node receives input, the output by default contains the response.
  // We need to access the original via $('5.6 Parse Haiku verdict').itemMatching() — but with branch filter, indices differ.
  // Solution: pass through the original by setting "Append a property" in the HTTP node, OR use $('5.7 IF...').
  // Simpler: itemMatching against the IF TRUE output
  const orig = $('5.7 IF doubt → Sonnet').itemMatching(i)?.json || {};
  const empCount = Number(orig.numberofemployees || 0);

  const bk = v.score_breakdown || {};
  const industry_pts = clamp(bk.industry_pts, 0, 40);
  const country_pts = clamp(bk.country_pts, 0, 25);
  const size_pts_sonnet = clamp(bk.size_pts, 0, 20);
  const size_pts_computed = sizePtsFromCount(empCount);
  const size_pts = empCount > 0 ? size_pts_computed : size_pts_sonnet;
  const signals_pts = clamp(bk.signals_pts, 0, 15);

  const disqNum = v.disqualif_number && /^[1-5]$/.test(String(v.disqualif_number).trim()) ? String(v.disqualif_number).trim() : null;
  const sum = industry_pts + country_pts + size_pts + signals_pts;
  const score = disqNum ? 0 : sum;
  const is_icp = !disqNum && score >= 50;

  // Build new verdict OVERRIDING Haiku's
  out.push({
    json: {
      ...orig,
      _verdict: {
        is_icp, score,
        score_breakdown: { industry_pts, country_pts, size_pts, signals_pts },
        reason: '[SONNET REVIEW] ' + (v.reason || ''),
        has_gtm_engineer: v.has_gtm_engineer === true,
        disqualif_number: disqNum,
        _doubt: false,  // resolved
        _reviewed_by: 'sonnet',
        _audit: {
          ...(orig._verdict?._audit || {}),
          sonnet_score: typeof v.score === 'number' ? v.score : null,
          sonnet_is_icp: v.is_icp === true,
          sonnet_breakdown: bk,
          haiku_was_wrong: orig._verdict?.is_icp !== is_icp,
        },
      },
    },
  });
}
return out;
