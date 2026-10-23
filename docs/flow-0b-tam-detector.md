# Flow 0b: TAM detector

Companies can reach HubSpot without Flow 3, for example through a scraping tool's native HubSpot integration or a manual import. This small flow catches them every hour so they enter the same pipeline.

- **Export:** [workflows/flow-0b-tam-detector.json](../workflows/flow-0b-tam-detector.json) (6 nodes)
- **Trigger:** schedule, every hour
- **Reads:** HubSpot companies that have a domain but no `tam_status`
- **Writes:** `tam_status = new`, `tam_domain`, `tam_first_seen`, `tam_industry`, then a Slack message

## Steps

1. Search HubSpot for companies with a domain and no `tam_status`, newest first, 100 at a time.
2. Build one batch update: normalized domain, `tam_status = new`, today's date as `tam_first_seen`.
3. Stop if there is nothing to tag.
4. `POST /crm/v3/objects/companies/batch/update`, then post the count and a sample of names to Slack.

The next run of [Flow 4](flow-4-company-qualifier.md) scores them like any other new company.
