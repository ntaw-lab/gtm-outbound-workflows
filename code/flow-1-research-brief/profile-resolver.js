// Extracted from workflows/flow-1-research-brief.json, Code node "3. Apify — Scrape Profile".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

// Profile resolver — forward Apify output if non-empty,
// else build profile from Flow 2 webhook payload (encoded LinkedIn URL case).
const apifyOut = $input.all();
const body = $('1. Webhook /brief').first().json?.body || {};
const persona = body.persona_data || {};

// Path 1 : Apify returned data (URL was a valid slug)
if (apifyOut.length > 0 && apifyOut[0].json?.firstName) {
  return apifyOut;
}

// Path 2 : Apify returned 0 (encoded URL or unfindable). Build fallback from webhook payload.
if (!persona.firstName) {
  // No fallback data either → return empty (downstream nodes will skip naturally)
  console.log('Profile resolver : no Apify data + no persona_data in webhook → empty');
  return [];
}

console.log('Profile resolver : Apify failed, using persona_data from Flow 2 webhook payload');

return [{ json: {
  firstName: persona.firstName,
  lastName: persona.lastName,
  summary: persona.summary || '',
  headline: persona.headline || '',
  currentPosition: persona.currentPosition || [],
  location: persona.location || {},
  pictureUrl: persona.pictureUrl || '',
  linkedinUrl: persona.linkedinUrl || body.url || '',
  // Flag for downstream nodes that may want to know this is a fallback
  _profile_source: 'flow2_webhook_fallback',
}}];
