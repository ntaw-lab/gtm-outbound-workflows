// Extracted from workflows/flow-1-research-brief.json, Code node "12a. Prep contact props".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const profile = $('3. Apify — Scrape Profile').first().json || {};
const company = $('4. Apify — Scrape Company').first().json || {};
const merge = $('9d. Merge email result').first().json || {};
const body = $('1. Webhook /brief').first().json?.body || {};
let b = {};
try {
  const briefRaw = $('10. Generate Brief (Claude Sonnet)').first().json.content[0].text || '{}';
  const m = briefRaw.match(/\{[\s\S]*\}/);
  b = m ? JSON.parse(m[0]) : {};
} catch(e) { b = {}; }

const cp = (profile.currentPosition && profile.currentPosition[0]) || {};
const loc = profile.location || {};
const parsed = loc.parsed || {};
const city = parsed.city || loc.city || '';
const country = parsed.country || parsed.countryFull || loc.country || '';

function getJobTitle() {
  const positions = profile.currentPosition || [];
  const targetCo = (body.persona_company || company.name || '').toLowerCase().trim();
  if (targetCo && positions.length) {
    const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const match = positions.find(p => {
      const pco = norm(p.companyName || p.company);
      return pco && (pco.includes(norm(targetCo)) || norm(targetCo).includes(pco));
    });
    if (match) return match.position || match.title || '';
  }
  if (positions[0]) return positions[0].position || positions[0].title || '';
  return body.persona_title || '';
}

const jobtitle = getJobTitle();

function cleanJobtitle(t) {
  if (!t) return '';
  const GEOS = ['International','Worldwide','Global','EMEA','APAC','LATAM','Europe','France','UK','US','USA','Spain','Germany','Italy','Benelux','North America','South America','Asia','MENA','DACH','Nordics','Enterprise Segment','Enterprise'];
  t = t.split(/\s*[@|]\s*/, 1)[0].trim();
  // V2: include regular hyphen (with spaces around) — strips "- On recrute !" etc.
  t = t.split(/\s+[-–—]\s+/, 1)[0].trim();
  t = t.replace(/\s*\([^)]*\)/g, '').trim();
  t = t.replace(/^(Co[- ]?Founder|Founder|Co[- ]?Fondateur|Fondateur|Co[- ]?fondatrice|Fondatrice)\s*[&,/]\s*/i, '').trim();
  if (/(Sales|Revenue|RevOps|GTM|CRO|CSO|VP|Director|Head|Chief|Manager|Founder|CEO|Commercial|Directeur|Directrice|Vente|Responsable|Fondateur)/i.test(t)) {
    t = t.split(/\s*[&\/,]\s+/, 1)[0].trim();
  }
  const geoLeading = new RegExp('^(?:' + GEOS.join('|') + ')\\s+', 'i');
  t = t.replace(geoLeading, '').trim();
  const geoTrailing = new RegExp('\\s+(?:' + GEOS.join('|') + ')$', 'i');
  t = t.replace(geoTrailing, '').trim().replace(geoTrailing, '').trim();
  t = t.replace(/Vice[- ]?President(?:\s+of)?/gi, 'VP of');
  t = t.replace(/VP\s+of\s+of\s+/gi, 'VP of ');
  t = t.replace(/Vice[- ]?Président(?:e)?(?:\s+(?:du|de la|de))?/gi, 'VP');
  // V2: normalize "VP Sales" → "VP of Sales" when "of" is missing
  t = t.replace(/^VP\s+(?!of\s)([A-Z])/, 'VP of $1');
  t = t.replace(/^[\s\-–—,;:]+|[\s\-–—,;:]+$/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

const tier = body.flow2_tier || '';
let job_title_lemlist = '';
if (tier !== '4_ceo_fallback') {
  job_title_lemlist = cleanJobtitle(jobtitle) || jobtitle;
}

let ricePreview = '';
if (b.rice) {
  const r = b.rice;
  ricePreview = 'R:' + (r.reward?.score ?? '?') + ' I:' + (r.ideology?.score ?? '?') + ' C:' + (r.coercion?.score ?? '?') + ' E:' + (r.ego?.score ?? '?') + ' | Score:' + (b.score ?? '?') + ' | Dom:' + (b.rice_dominant || '?') + ' | DISC:' + (b.disc_profile || '?') + ' | Tier:' + (b.tier || '?') + ' | Prio:' + (b.priority || '?');
}

const today = new Date().toISOString().slice(0,10);
const url = body.url || profile.linkedinUrl || '';

const sc = body.flow2_sales_count || {};
const salesSummary = (sc.sdr || sc.bdr || sc.csm || sc.ae)
  ? '[Sales team détectée chez ' + (company.name || body.persona_company || 'company') + ' sur ' + (sc.total_employees_scraped || '?') + ' employés scrapés Apify] SDR: ' + (sc.sdr || 0) + ' | BDR: ' + (sc.bdr || 0) + ' | AE: ' + (sc.ae || 0) + ' | CSM: ' + (sc.csm || 0)
  : '[Sales team Apify scrap] aucun SDR/BDR/AE/CSM détecté dans les ' + (sc.total_employees_scraped || 0) + ' employés scrapés';

const flow2Reason = String(body.flow2_reason || '');
const t4Tag = body.flow2_t4_promoted ? '[T4 FALLBACK PROMOTED] ' : '';
const qualifiedReason = t4Tag + flow2Reason + '\n' + salesSummary;

const props = {
  email: merge.email || '',
  firstname: profile.firstName || '',
  lastname: profile.lastName || '',
  company: company.name || body.persona_company || '',
  jobtitle: jobtitle,
  job_title_lemlist: job_title_lemlist,
  city: city,
  country: country,
  hs_linkedin_url: url,
  tam_linkedin_url: url,
  score_persona: Number(body.flow2_score || 0),
  qualified_reason: qualifiedReason,
  disqualif_reason: '',
  persona_tier: body.flow2_tier || '',
  persona_status: 'qualified',
  rice_preview: ricePreview,
  tam_last_scrap: today,
  outbound_status: 'not_started',
  flow1_last_brief_date: today};

return [{ json: { inputs: [{ idProperty: 'email', id: merge.email || '', properties: props }] } }];
