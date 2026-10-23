// Extracted from workflows/flow-2-persona-enricher.json, Code node "9.6 Pre-build Haiku context".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

// Pre-build per-company employees context. KEY FIX: filter employees by
// target company slug, so Haiku doesn't see cross-company contaminated data
// (Apify returns some employees from other companies via LinkedIn cross-matches).

const allEmployees = $('7d. Dedup employees').all() || [];

function extractSlug(url) {
  return ((url || '').toLowerCase().split('/company/')[1] || '').split('/')[0].split('?')[0];
}
function getEmployeeCompanySlug(j) {
  const cp = (j.currentPositions && j.currentPositions[0]) || {};
  return extractSlug(cp.companyLinkedinUrl || cp.companyUrl || j.currentCompany?.linkedinUrl || j.currentCompany?.url || '');
}

// Group all employees by their CURRENT company slug (= the slug visible in their currentPositions)
const employeesBySlug = {};
for (const e of allEmployees) {
  const j = e.json || {};
  const slug = getEmployeeCompanySlug(j);
  if (!slug) continue;
  if (!employeesBySlug[slug]) employeesBySlug[slug] = [];
  employeesBySlug[slug].push({
    title: (j.title || j.headline || j.currentPositions?.[0]?.position || '').slice(0, 100),
    name: ((j.firstName || '') + ' ' + (j.lastName || '')).trim()
  });
}

// Cap each company list to 60 (avoid prompt bloat)
for (const slug in employeesBySlug) {
  employeesBySlug[slug] = employeesBySlug[slug].slice(0, 60);
}

const out = [];
for (const item of $input.all()) {
  const j = item.json;

  // Get THIS persona's company slug → fetch only employees of THAT company
  const personaSlug = j._company_slug || '';
  const companyEmployees = employeesBySlug[personaSlug] || [];

  const profileForHaiku = {
    firstName: j.firstName,
    lastName: j.lastName,
    headline: j.headline,
    location: typeof j.location === 'object' ? (j.location?.linkedinText || j.location?.parsed?.text) : j.location,
    currentPositions: (j.currentPositions || []).slice(0, 3).map(p => ({
      position: p.position || p.title,
      companyName: p.companyName,
      dateRange: p.dateRange,
      duration: p.duration,
    })),
    about: (j.about || '').slice(0, 1500),
    _company_name: j._company_name,
    _company_hs_id: j._company_hs_id,
    _company_slug: j._company_slug,
    linkedinUrl: j.linkedinUrl,
  };

  out.push({
    json: {
      ...j,
      _profileForHaiku: JSON.stringify(profileForHaiku),
      _employeesJson: JSON.stringify(companyEmployees),
      _employeesCount: companyEmployees.length
    }
  });
}
return out;
