// Extracted from workflows/flow-2-persona-enricher.json, Code node "10.96 T1 priority + T4 fallback override".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

const all = $input.all();

const byCompany = {};
for (const item of all) {
  const slug = item.json._company_slug || item.json._company_hs_id || '__unknown__';
  if (!byCompany[slug]) byCompany[slug] = [];
  byCompany[slug].push(item);
}

const T1_TIER = '1_cro_vp_sales';
const T2_TIER = '2_director_of_sales';
const T3_TIER = '3_revops_lead';
const T4_TIER = '4_ceo_fallback';
const HIGHER_TIERS = new Set([T1_TIER, T2_TIER, T3_TIER]);

// Defense layer 3: even if Haiku assigned T4 to a technical co-founder, reject promotion.
const technicalRoleRegex = /(\bCTO\b|Chief\s+Technology|Chief\s+Product|Chief\s+Financial|Chief\s+Marketing|Chief\s+Operating|\bCPO\b|\bCFO\b|\bCMO\b|\bCOO\b|VP\s+(?:of\s+)?(?:Engineering|Product(?!\s+Marketing)|Tech|Marketing|Finance|People|HR|Operations)|Head\s+of\s+(?:Engineering|Product|Tech|Marketing|Finance|People|HR|Operations|Design)|Director\s+of\s+(?:Engineering|Product|Tech|Marketing|Finance|People|HR|Operations|Design))/i;

// "Head of GTM" pattern — T2 conditional (only if no T1 in company)
const gtmTitleRegex = /(Head\s+of\s+GTM|Head\s+of\s+Go[- ]?to[- ]?Market|Director\s+of\s+GTM|VP\s+(?:of\s+)?GTM)/i;

function getTitleHaystack(j) {
  const parts = [j.title, j.headline, j.currentPositions?.[0]?.position, j.currentPositions?.[0]?.title].filter(Boolean);
  return parts.join(' || ');
}
function isTechnicalRole(j) { return technicalRoleRegex.test(getTitleHaystack(j)); }
function isGtmTitle(j) { return gtmTitleRegex.test(getTitleHaystack(j)); }

const out = [];

for (const slug in byCompany) {
  const group = byCompany[slug];

  // Step 1: detect if a T1 (Head of Sales / CRO / etc.) is qualified in this company
  const hasT1Qualified = group.some(it => {
    const v = it.json._verdict || {};
    return v.is_persona && v.tier_key === T1_TIER;
  });

  // Step 2: if T1 exists, demote any qualified Head of GTM (T2 conditional) to disqualified
  if (hasT1Qualified) {
    for (const item of group) {
      const v = item.json._verdict || {};
      if (v.is_persona && v.tier_key === T2_TIER && isGtmTitle(item.json)) {
        item.json._verdict = {
          ...v,
          is_persona: false,
          _t2_gtm_demoted: true,
          reason: '[T2 GTM DEMOTED] Head of GTM/Go-to-Market désactivé car un T1 (Head of Sales/CRO/etc.) est qualifié dans la même company. Priorité : toujours T1 > Head of GTM. Original: ' + (v.reason || '')
        };
      }
    }
  }

  // Step 3: existing T4 fallback override (skip if any HIGHER_TIER qualified, including just-demoted T2-GTM still considered if was qualified)
  const hasHigherQualified = group.some(it => {
    const v = it.json._verdict || {};
    return v.is_persona && HIGHER_TIERS.has(v.tier_key);
  });

  if (!hasHigherQualified) {
    const t4Cands = group
      .filter(it => it.json._verdict?.tier_key === T4_TIER)
      .filter(it => !isTechnicalRole(it.json))
      .sort((a, b) => (b.json._verdict?.score || 0) - (a.json._verdict?.score || 0));

    if (t4Cands.length > 0) {
      const chosen = t4Cands[0];
      const orig = chosen.json._verdict || {};
      chosen.json._verdict = {
        ...orig,
        is_persona: true,
        _t4_fallback_promoted: true,
        reason: '[T4 FALLBACK PROMOTED] No T1/T2/T3 qualified in company. CEO/Founder selected as decision-maker fallback (technical co-founders excluded). Original Haiku verdict: ' + (orig.reason || ''),
      };
    }
  }
  out.push(...group);
}
return out;
