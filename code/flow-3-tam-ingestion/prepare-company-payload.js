// Extracted from workflows/flow-3-tam-ingestion.json, Code node "4.5a Prepare Company payload".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const today = new Date().toISOString().split('T')[0];

// Mapping freshdata industry strings → HubSpot native industry enum
function mapIndustryToHS(industry) {
  if (!industry) return '';
  const i = String(industry).toLowerCase();
  // Exact mappings (priority)
  const map = {
    'software development': 'COMPUTER_SOFTWARE',
    'desktop computing software products': 'COMPUTER_SOFTWARE',
    'embedded software products': 'COMPUTER_SOFTWARE',
    'computer networking products': 'COMPUTER_NETWORKING',
    'data security software products': 'COMPUTER_NETWORK_SECURITY',
    'computer hardware': 'COMPUTER_HARDWARE',
    'computer games': 'COMPUTER_GAMES',
    'information technology and services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'information technology & services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'internet': 'INTERNET',
    'telecommunications': 'TELECOMMUNICATIONS',
    'financial services': 'FINANCIAL_SERVICES',
    'banking': 'BANKING',
    'insurance': 'INSURANCE',
    'real estate': 'REAL_ESTATE',
    'marketing and advertising': 'MARKETING_AND_ADVERTISING',
    'human resources': 'HUMAN_RESOURCES',
    'staffing and recruiting': 'STAFFING_AND_RECRUITING',
    'management consulting': 'MANAGEMENT_CONSULTING',
    'logistics and supply chain': 'LOGISTICS_AND_SUPPLY_CHAIN',
    'transportation/trucking/railroad': 'TRANSPORTATION_TRUCKING_RAILROAD',
    'retail': 'RETAIL',
    'hospitality': 'HOSPITALITY',
    'restaurants': 'RESTAURANTS',
    'food & beverages': 'FOOD_BEVERAGES',
    'health, wellness and fitness': 'HEALTH_WELLNESS_AND_FITNESS',
    'hospital & health care': 'HOSPITAL_HEALTH_CARE',
    'medical practice': 'MEDICAL_PRACTICE',
    'medical devices': 'MEDICAL_DEVICES',
    'pharmaceuticals': 'PHARMACEUTICALS',
    'biotechnology': 'BIOTECHNOLOGY',
    'education management': 'EDUCATION_MANAGEMENT',
    'e-learning': 'ELEARNING',
    'government administration': 'GOVERNMENT_ADMINISTRATION',
    'public policy': 'PUBLIC_POLICY',
    'legal services': 'LEGAL_SERVICES',
    'law practice': 'LAW_PRACTICE',
    'automotive': 'AUTOMOTIVE',
    'electrical/electronic manufacturing': 'ELECTRICAL_ELECTRONIC_MANUFACTURING',
    'mechanical or industrial engineering': 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING',
    'oil & energy': 'OIL_ENERGY',
    'renewables & environment': 'RENEWABLES_ENVIRONMENT',
    'utilities': 'UTILITIES',
    'mining & metals': 'MINING_METALS',
    'construction': 'CONSTRUCTION',
    'farming': 'FARMING',
    'apparel & fashion': 'APPAREL_FASHION',
  };
  if (map[i]) return map[i];
  // Heuristic fallbacks
  if (i.includes('software')) return 'COMPUTER_SOFTWARE';
  if (i.includes('saas') || i.includes('cloud')) return 'COMPUTER_SOFTWARE';
  if (i.includes('network')) return 'COMPUTER_NETWORKING';
  if (i.includes('security')) return 'COMPUTER_NETWORK_SECURITY';
  if (i.includes('it services') || i.includes('information technology')) return 'INFORMATION_TECHNOLOGY_AND_SERVICES';
  return '';  // unmapped → leave empty (HubSpot won't reject)
}

const allInputs = $input.all().map(item => {
  const j = item.json;
  const dom = String(j.domain || '').toLowerCase().trim();
  const isNew = !j._existing;
  const props = {
    tam_domain: dom,
    domain: dom,
    name: j.company_name || '',
    website: j.website || '',
    numberofemployees: (typeof j.employee_count === 'number') ? j.employee_count : null,
    description: ((j.description || '') + '').slice(0, 5000),
    linkedin_company_page: j.linkedin_url || '',
    tam_status: 'new',
    tam_last_scrap: today,
    persona_enrichment_status: '',
    tam_industry: j.industry || '',  // custom free text
    country: j.hq_country || '',
    state: j.hq_region || '',
    city: j.hq_city || '',
  };
  // Native HubSpot industry enum (only set if mappable)
  const hsIndustry = mapIndustryToHS(j.industry);
  if (hsIndustry) props.industry = hsIndustry;
  if (isNew) props.tam_first_seen = today;
  return { idProperty: 'tam_domain', id: dom, properties: props };
});

const CHUNK = 100;
const out = [];
for (let i = 0; i < allInputs.length; i += CHUNK) {
  out.push({ json: { body: { inputs: allInputs.slice(i, i + CHUNK) } } });
}
return out;
