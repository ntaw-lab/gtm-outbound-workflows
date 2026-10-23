// Extracted from workflows/flow-1-research-brief.json, Code node "9d. Merge email result".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

// Merge enrichment results into single email/provider pair
// Last upstream node feeds $input — figure out which provider by shape
const j = $input.first().json;
let email = null, provider = 'none';
if (j?.data?.email) { email = j.data.email; provider = 'hunter'; }
else if (j?.datas?.[0]?.contact?.emails?.[0]?.email) { email = j.datas[0].contact.emails[0].email; provider = 'fullenrich'; }
else if (j?.datas?.[0]?.email) { email = j.datas[0].email; provider = 'fullenrich'; }
else if (j?.contacts?.['1']?.data?.emailAddresses?.[0]?.email) { email = j.contacts['1'].data.emailAddresses[0].email; provider = 'lusha'; }
else if (j?.people?.[0]?.emails?.[0]?.email) { email = j.people[0].emails[0].email; provider = 'surfe'; }
else if (j?.people?.[0]?.email) { email = j.people[0].email; provider = 'surfe'; }
return [{ json: { email, provider, raw: j } }];
