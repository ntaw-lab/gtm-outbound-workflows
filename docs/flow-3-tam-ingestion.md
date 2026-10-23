# Flow 3: TAM ingestion

Loads raw companies into HubSpot, from any CSV export or from a LinkedIn company search, without creating duplicates or paying twice for data refreshed recently. Every company enters the pipeline with `tam_status = new`.

- **Export:** [workflows/flow-3-tam-ingestion.json](../workflows/flow-3-tam-ingestion.json) (19 nodes)
- **Trigger:** n8n form with two modes. Upload a CSV, or leave it empty and fill in a search (keywords, locations, LinkedIn industry IDs, company sizes, number of pages).
- **Reads:** HubSpot companies by `tam_domain`
- **Writes:** HubSpot companies (batch upsert), Slack

## Steps

| Step | Nodes | What happens |
|---|---|---|
| 1. Normalize | `1c` | Reads the form fields by label, resolves the mode (`csv`, `search` or `empty`), applies defaults and a safety cap on the number of companies |
| 2a. CSV mode | `2a`, `2b` | Parses the CSV, then maps columns whatever the tool that produced it: several known header names per field (up to ten), domain derived from the website when missing, employee ranges such as "11-50" turned into a number. Rows without a domain are dropped |
| 2b. Search mode | `2c`, `2d` | Runs an Apify LinkedIn company search actor and maps its output to the same shape as the CSV mode |
| 3. Pre-lookup | `3.5a`, `3.5b` | Looks each domain up in HubSpot (one call every 250 ms) and attaches the existing record, if any |
| 4. Freshness check | `3.5c`, `3.5d` | Known companies refreshed less than 30 days ago are skipped: only their `tam_last_scrap` date is updated |
| 5. Prepare | `4.5a` | Builds the HubSpot payload: maps free-text industries to the HubSpot industry enum (exact table, then keyword fallbacks, empty when unknown), sets `tam_status = new`, sets `tam_first_seen` only for new companies, and splits the payload into chunks of 100 |
| 6. Upsert | `4.5b` | `POST /crm/v3/objects/companies/batch/upsert` with `idProperty = tam_domain`, one chunk every 2 seconds |
| 7. Report | `M_merge`, `E_format_done`, Slack nodes | Counts parsed, skipped and pushed companies and posts a summary |

## Design notes

- **One shape for every source.** Both modes end in the same normalized object (`company_name`, `domain`, `employee_count`, `industry`, `hq_country`...), so everything after step 2 is shared. Adding a source means writing one mapping node.
- **The domain is the key.** HubSpot's batch upsert needs a unique-value property as its key, and the standard `domain` property cannot play that role. The flow writes a normalized copy of the domain into the custom unique property `tam_domain` and upserts on it.
- **Throttling is built into the nodes** (n8n batching options), which keeps the flow under HubSpot's rate limits without retry logic.

## Code to read

- [map-csv-columns.js](../code/flow-3-tam-ingestion/map-csv-columns.js): tolerant CSV mapping
- [prepare-company-payload.js](../code/flow-3-tam-ingestion/prepare-company-payload.js): industry mapping and chunked upsert payload
