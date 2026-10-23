// Extracted from workflows/flow-2-persona-enricher.json, Code node "8. Filter title (FR + target titles)".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const targetRegexes = [
  /\bCRO\b/i, /Chief\s+Revenue\s+Officer/i, /Chief\s+Sales\s+Officer/i,
  /VP\s+(?:of\s+)?Sales/i, /VP\s+(?:of\s+)?Revenue/i,
  /Head\s+of\s+Sales/i, /Head\s+of\s+Revenue/i, /Head\s+of\s+RevOps/i, /Head\s+of\s+GTM/i, /Head\s+of\s+Go[- ]?to[- ]?Market/i,
  /Director\s+of\s+Sales/i, /\bSales\s+Director\b/i,
  /Director\s+of\s+RevOps/i, /VP\s+(?:of\s+)?RevOps/i, /Director\s+of\s+GTM/i, /VP\s+(?:of\s+)?GTM/i, /Revenue\s+Operations\s+Manager/i, /\bRevOps\s+Manager\b/i,
  /\bCEO\b/i, /\bFounder\b/i, /\bCo-?founder\b/i,
];
const denyRegexes = [
  /SDR\s+Manager/i, /BDR\s+Manager/i, /Sales\s+Development\s+Manager/i,
  /Sales\s+Operations\s+Manager/i, /Sales\s+Ops\s+Manager/i, /Outbound\s+Manager/i,
  /\bSenior\s+AE\b/i, /\bSenior\s+SDR\b/i, /\bSenior\s+BDR\b/i,
];
const technicalRoleRegexes = [
  /\bCTO\b/i, /Chief\s+Technology\s+Officer/i,
  /\bCPO\b/i, /Chief\s+Product\s+Officer/i,
  /\bCFO\b/i, /Chief\s+Financial\s+Officer/i,
  /\bCMO\b/i, /Chief\s+Marketing\s+Officer/i,
  /\bCOO\b/i, /Chief\s+Operating\s+Officer/i,
  /VP\s+(?:of\s+)?Engineering/i, /VP\s+(?:of\s+)?Product(?!\s+Marketing)/i,
  /VP\s+(?:of\s+)?Tech/i, /VP\s+(?:of\s+)?Marketing/i, /VP\s+(?:of\s+)?Finance/i,
  /VP\s+(?:of\s+)?People/i, /VP\s+(?:of\s+)?HR/i, /VP\s+(?:of\s+)?Operations/i,
  /Head\s+of\s+(?:Engineering|Product|Tech|Marketing|Finance|People|HR|Operations|Design)/i,
  /Director\s+of\s+(?:Engineering|Product|Tech|Marketing|Finance|People|HR|Operations|Design)/i,
];
const frRegex = /(France|Paris|Lyon|Marseille|Bordeaux|Toulouse|Lille|Nantes|Rennes|Strasbourg|Nice|Grenoble|Montpellier|Sophia[- ]?Antipolis|Aix[- ]?en[- ]?Provence|Île[- ]?de[- ]?France|Hauts[- ]?de[- ]?France)/i;

function norm(s) { return String(s || '').toLowerCase().trim(); }
function getCurrentPos(j) {
  return (j.currentPositions && j.currentPositions[0]) || (j.currentPosition && j.currentPosition[0]) || {};
}
function getTitleHaystack(j) {
  const cp = getCurrentPos(j);
  const parts = [j.title, j.headline, cp.position, cp.title].filter(Boolean);
  return parts.join(' || ');
}
function getLocation(j) {
  if (typeof j.location === 'string') return j.location;
  return j.location?.linkedinText || j.location?.parsed?.text || j.locationName || '';
}
function getCountryCode(j) {
  if (typeof j.location === 'object') {
    return (j.location?.countryCode || j.location?.parsed?.countryCode || '').toUpperCase();
  }
  return '';
}
function getCompanyName(j) {
  const cp = getCurrentPos(j);
  return norm(cp.companyName || cp.company || j.currentCompany?.name);
}
function getCompanyUrl(j) {
  const cp = getCurrentPos(j);
  return norm(cp.companyLinkedinUrl || cp.companyUrl || j.currentCompany?.linkedinUrl || j.currentCompany?.url);
}
function extractSlug(url) {
  return (String(url).split('/company/')[1] || '').split('/')[0].split('?')[0];
}

function isSalesTitle(haystack) {
  return targetRegexes.some(r => r.test(haystack))
      && !denyRegexes.some(r => r.test(haystack))
      && !technicalRoleRegexes.some(r => r.test(haystack));
}

const out = [];
const seen = new Set();
const companies = $('6.5 Aggregate companies for batch').first().json.companies;

let dropped_left_company = 0;
let dropped_no_title = 0;
let dropped_not_sales = 0;
let dropped_not_fr = 0;

for (const item of $input.all()) {
  const j = item.json;
  if (j._company_has_concurrence === true) continue;

  const titleHaystack = getTitleHaystack(j);
  if (!titleHaystack) { dropped_no_title++; continue; }

  const loc = getLocation(j);
  const cc = getCountryCode(j);
  const linkedinUrl = j.linkedinUrl || j.profileUrl || '';
  if (!linkedinUrl || seen.has(linkedinUrl)) continue;
  if (!isSalesTitle(titleHaystack)) { dropped_not_sales++; continue; }

  const isFR = (loc && frRegex.test(loc)) || cc === 'FR';
  if (!isFR) { dropped_not_fr++; continue; }

  // Match employee back to a batch company. Try company name first (more reliable
  // when the actor returns numeric IDs in companyLinkedinUrl), fallback to slug.
  const empCoName = getCompanyName(j);
  const empCoSlug = extractSlug(getCompanyUrl(j));
  const matched = companies.find(c => {
    const cName = norm(c.name);
    const cSlug = extractSlug(c.url);
    if (cName && empCoName && (cName === empCoName || cName.includes(empCoName) || empCoName.includes(cName))) return true;
    if (cSlug && empCoSlug && cSlug === empCoSlug) return true;
    return false;
  });

  if (!matched) {
    dropped_left_company++;
    continue;
  }

  seen.add(linkedinUrl);
  out.push({ json: { ...j, linkedinUrl, _company_hs_id: matched.hs_id, _company_name: matched.name } });
}

console.log('Filter stats — dropped: no_title=' + dropped_no_title + ', not_sales=' + dropped_not_sales + ', not_fr=' + dropped_not_fr + ', left_company=' + dropped_left_company + ' | passed=' + out.length);

return out.slice(0, 200);
