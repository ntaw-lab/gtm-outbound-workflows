// Extracted from workflows/flow-2-persona-enricher.json, Code node "7.5 Detect concurrence interne".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const all = $input.all();
const concurrenceTitles = [
  /\bGTM\s+Engineer\b/i, /\bGTM\s+Specialist\b/i,
  /\bRevOps\s+Engineer\b/i, /Revenue\s+Operations\s+Engineer/i,
  /Sales\s+Ops\s+Engineer/i, /Sales\s+Operations\s+Engineer/i,
  /\bGrowth\s+Engineer\b/i, /\bGrowth\s+Manager\b/i, /\bGrowth\s+Lead\b/i, /\bAutomation\s+Engineer\b/i,
  /Marketing\s+Automation\s+(Lead|Manager|Engineer)/i,
];
const sdrPattern = /\bSDR\b|Sales\s+Development\s+Representative|Sales\s+Development(?!\s+(Director|Manager|Lead|Head))/i;
const bdrPattern = /\bBDR\b|Business\s+Development\s+Representative/i;
const csmPattern = /\bCSM\b|Customer\s+Success\s+Manager|Customer\s+Success\s+Specialist|Customer\s+Success\s+Associate|Customer\s+Success\s+Representative/i;
const aePattern = /\bAE\b|Account\s+Executive/i;

function isConcurrence(title) {
  if (!title) return false;
  return concurrenceTitles.some(r => r.test(title));
}
function getCompanyUrl(j) {
  const cp = (j.currentPositions && j.currentPositions[0]) || {};
  return (cp.companyLinkedinUrl || cp.companyUrl || j.currentCompany?.linkedinUrl || j.currentCompany?.url || '').toLowerCase();
}
function extractSlug(url) {
  return (url.split('/company/')[1] || '').split('/')[0].split('?')[0];
}
function getTitle(j) {
  return [j.title, j.headline, j.currentPositions?.[0]?.position, j.currentPositions?.[0]?.title].filter(Boolean).join(' || ');
}

const companies = $('6.5 Aggregate companies for batch').first().json.companies || [];
const compByUrl = {};
for (const c of companies) {
  const slug = extractSlug(String(c.url || '').toLowerCase());
  if (slug) compByUrl[slug] = c;
}

const concurrenceCompanies = new Set();
const salesCountByCompany = {};

for (const item of all) {
  const j = item.json;
  const title = getTitle(j);
  const slug = extractSlug(getCompanyUrl(j));
  if (!slug || !compByUrl[slug]) continue;

  if (!salesCountByCompany[slug]) {
    salesCountByCompany[slug] = { sdr: 0, bdr: 0, csm: 0, ae: 0, total_employees_scraped: 0 };
  }
  salesCountByCompany[slug].total_employees_scraped++;

  if (isConcurrence(title)) concurrenceCompanies.add(slug);
  if (sdrPattern.test(title)) salesCountByCompany[slug].sdr++;
  else if (bdrPattern.test(title)) salesCountByCompany[slug].bdr++;
  if (csmPattern.test(title)) salesCountByCompany[slug].csm++;
  if (aePattern.test(title) && !sdrPattern.test(title) && !bdrPattern.test(title)) salesCountByCompany[slug].ae++;
}

const out = [];
for (const item of all) {
  const j = item.json;
  const slug = extractSlug(getCompanyUrl(j));
  const sc = salesCountByCompany[slug] || { sdr: 0, bdr: 0, csm: 0, ae: 0, total_employees_scraped: 0 };
  out.push({
    json: {
      ...j,
      _company_has_concurrence: concurrenceCompanies.has(slug),
      _company_slug: slug,
      _company_sales_count: sc,
    }
  });
}
console.log('Concurrence: ' + concurrenceCompanies.size + ' | Sales counts: ' + JSON.stringify(salesCountByCompany));
return out;
