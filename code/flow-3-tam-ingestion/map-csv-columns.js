// Extracted from workflows/flow-3-tam-ingestion.json, Code node "2b. Map CSV columns + cap".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const max = $('1c. Normalize Input').first().json.max_companies || 9999;
const items = $input.all();
const out = [];
function pick(j, names) {
  for (const n of names) {
    if (j[n] !== undefined && j[n] !== null && j[n] !== '') return j[n];
  }
  return '';
}
function parseEmpRange(v) {
  if (typeof v === 'number') return v;
  if (!v) return null;
  const m = String(v).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  const single = String(v).match(/(\d+)/);
  return single ? Number(single[1]) : null;
}
let dropped = 0;
for (const item of items) {
  if (out.length >= max) break;
  const j = item.json || {};
  const name = pick(j, ['companyName', 'company_name', 'Company Name', 'name', 'company', 'Company']);
  const website = pick(j, ['website', 'companyUrl', 'Website', 'company_website', 'companyWebsite', 'site_web']);
  const linkedinUrl = pick(j, ['linkedinUrl', 'companyLinkedinUrl', 'company_linkedin_url', 'profileUrl', 'sales_nav_url', 'companySalesNavigatorUrl', 'company_url', 'navigationUrl', 'sales_link', 'linkedin_url']);
  const cleanWebsite = website && !String(website).includes('linkedin.com/redir') ? website : '';
  const fromWebsite = String(cleanWebsite || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const rawDomain = pick(j, ['domain', 'companyDomain', 'company_domain', 'Domain']) || fromWebsite || '';
  const domain = String(rawDomain).toLowerCase().trim();
  if (!domain) { dropped++; continue; }
  const empCount = parseEmpRange(pick(j, ['employeeCount', 'employee_count', 'staffCount', 'numberOfEmployees', 'employees']));
  const empRange = pick(j, ['companySize', 'employeeRange', 'staffRange', 'company_employee_range', 'sizeRange', 'employee_range']);
  const industry = pick(j, ['industry', 'companyIndustry', 'Industry', 'company_industry']);
  const description = pick(j, ['description', 'companyDescription', 'about', 'tagline', 'company_description', 'About']);
  const company_id = pick(j, ['companyId', 'company_id', 'vmid', 'companyVmid']);
  // Location fields
  const hq_country = pick(j, ['hq_country', 'country', 'companyCountry', 'Country']);
  const hq_city = pick(j, ['hq_city', 'city', 'companyCity', 'City']);
  const hq_region = pick(j, ['hq_region', 'state', 'region', 'companyRegion']);
  out.push({ json: {
    company_name: name,
    website: cleanWebsite,
    linkedin_url: linkedinUrl,
    domain,
    employee_count: empCount || (empRange ? parseEmpRange(empRange) : null),
    employee_range: empRange,
    industry,
    description,
    company_id,
    hq_country, hq_city, hq_region,
    _raw: j,
  }});
}
if (dropped > 0) console.log('Dropped (no domain): ' + dropped);
return out;
