// Extracted from workflows/flow-4-company-qualifier.json, Code node "5.4 Prepare batch update payload".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const today = new Date().toISOString().split('T')[0];
const all = $input.all();
const inputs = [];
for (const item of all) {
  const j = item.json;
  const v = j._verdict || {};
  if (!j.hs_id) continue;
  const bk = v.score_breakdown || {};
  const breakdownStr = (typeof bk.industry_pts === 'number')
    ? 'Industry ' + (bk.industry_pts||0) + ' + Country ' + (bk.country_pts||0) + ' + Size ' + (bk.size_pts||0) + ' + Signals ' + (bk.signals_pts||0) + ' = ' + (v.score||0)
    : '';
  const sonnetTag = v._reviewed_by === 'sonnet' ? ' [🤖 SONNET REVIEW]' : '';
  const disqTag = v.disqualif_number ? ' [Disqualif #' + v.disqualif_number + ']' : '';
  const richReason = '*Score:* ' + (v.score || 0) + sonnetTag + disqTag
    + (breakdownStr ? '\n*Breakdown:* ' + breakdownStr : '')
    + (v.reason ? '\n\n*Verdict:* ' + v.reason : '')
    + '\n\n*Company scoring date:* ' + today;
  inputs.push({
    id: j.hs_id,
    properties: {
      tam_status: v.is_icp ? 'qualified' : 'disqualified',
      score_icp: v.score || 0,
      qualified_reason: v.is_icp ? richReason : '',
      disqualif_reason: v.is_icp ? '' : richReason,
    },
  });
}
const CHUNK = 100;
const out = [];
for (let i = 0; i < inputs.length; i += CHUNK) {
  out.push({ json: { body: { inputs: inputs.slice(i, i + CHUNK) } } });
}
return out;
