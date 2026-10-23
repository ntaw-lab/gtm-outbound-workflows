# Code nodes

The main JavaScript Code nodes, extracted from the [workflow exports](../workflows/) so they are easy to read on GitHub. They run inside n8n, where `$input`, `$json` and `$('Node name')` are globals. The JSON exports remain the source of truth.

| File | What it does |
|---|---|
| **Flow 1, research brief** | |
| [profile-resolver.js](flow-1-research-brief/profile-resolver.js) | Uses the scraped profile, or rebuilds it from the data sent by Flow 2 when the URL cannot be scraped |
| [merge-email-result.js](flow-1-research-brief/merge-email-result.js) | Ends the email waterfall: finds the email and the provider from the shape of the response |
| [prep-contact-props.js](flow-1-research-brief/prep-contact-props.js) | Cleans the job title for mail merge and builds the HubSpot contact properties |
| **Flow 2, persona enricher** | |
| [detect-in-house-team.js](flow-2-persona-enricher/detect-in-house-team.js) | Counts SDRs, BDRs, AEs and CSMs per company and flags in-house GTM or RevOps engineers |
| [filter-titles.js](flow-2-persona-enricher/filter-titles.js) | Keeps sales decision-makers in the target market who still work at the company |
| [build-model-context.js](flow-2-persona-enricher/build-model-context.js) | Builds a compact profile and the list of colleagues at the same company for the model |
| [parse-persona-verdict.js](flow-2-persona-enricher/parse-persona-verdict.js) | Parses and re-checks the persona verdict, flags doubtful cases for Sonnet |
| [tier-priority-override.js](flow-2-persona-enricher/tier-priority-override.js) | One decision-maker per account: sales leader first, founder fallback, no technical founders |
| **Flow 3, TAM ingestion** | |
| [map-csv-columns.js](flow-3-tam-ingestion/map-csv-columns.js) | Maps any CSV export to one company shape and derives the domain |
| [prepare-company-payload.js](flow-3-tam-ingestion/prepare-company-payload.js) | Maps industries to the HubSpot enum and builds batch upserts of 100 |
| **Flow 4, company qualifier** | |
| [parse-haiku-verdict.js](flow-4-company-qualifier/parse-haiku-verdict.js) | Parses and re-checks the company verdict, flags doubtful cases for Sonnet |
| [parse-sonnet-override.js](flow-4-company-qualifier/parse-sonnet-override.js) | Applies the Sonnet review and keeps the audit trail |
| [prepare-batch-update.js](flow-4-company-qualifier/prepare-batch-update.js) | Writes readable reasons and builds batch updates of 100 |
| **Flow 5, Lemlist push** | |
| [filter-by-tier.js](flow-5-lemlist-push/filter-by-tier.js) | Routes each contact to its campaign by persona tier and applies the guards |
| [merge-lemlist-response.js](flow-5-lemlist-push/merge-lemlist-response.js) | Joins the Lemlist answer back to the contact by email |
