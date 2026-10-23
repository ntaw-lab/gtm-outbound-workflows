// Extracted from workflows/flow-5-lemlist-push.json, Code node "7.5 Merge Lemlist + filter data".
// Runs inside n8n: $input, $json and $('Node name') are n8n globals.

// Merge Lemlist response with original filter data (preserved by email key).
// This avoids relying on $('5...').item which loses pairedItem context after HTTP node.

const filterData = $('5. Filter by tier + prepare items').all() || [];
const byEmail = {};
for (const it of filterData) {
  const j = it.json || {};
  if (j.email) byEmail[j.email] = j;
}

const out = [];
for (const item of $input.all()) {
  const lemlistResp = item.json || {};
  const email = lemlistResp.email || '';
  const orig = byEmail[email] || {};
  out.push({
    json: {
      ...orig,
      lemlist_response: lemlistResp,
      lemlist_lead_id: lemlistResp._id,
      lemlist_contact_id: lemlistResp.contactId,
      lemlist_campaign_id: lemlistResp.campaignId,
    }
  });
}
return out;
