# Setup

How to run the workflows on your own n8n instance.

## 1. Requirements

- n8n, self-hosted or cloud, with the Apify community node (`@apify/n8n-nodes-apify`)
- Accounts: Anthropic, Apify, HubSpot, Notion, Slack, Lemlist, and at least one email finder (Hunter, FullEnrich, Lusha or Surfe)

## 2. Credentials

Create the credentials **before** importing, with exactly these names: n8n links nodes to existing credentials by name on import. Otherwise, select the credential in each node after import.

| Credential name | n8n type | Setup | Used by |
|---|---|---|---|
| `Anthropic API (x-api-key)` | Header Auth | header `x-api-key` = API key | Flows 1, 2, 4 |
| `HubSpot private app (Bearer)` | Header Auth | header `Authorization` = `Bearer <private app token>` | Flows 0b, 1, 2, 3, 4, 5 |
| `Notion integration (Bearer)` | Header Auth | header `Authorization` = `Bearer <integration secret>` | Flow 1 |
| `Apify` | Apify API | API token | Flows 1, 2, 3 |
| `Slack bot` | Slack API | bot token, bot invited to both channels | all flows |
| `Hunter (api_key query)` | Query Auth | query parameter `api_key` | Flow 1 |
| `FullEnrich (Bearer)` | Header Auth | header `Authorization` = `Bearer <key>` | Flow 1 |
| `Lusha (api_key header)` | Header Auth | header `api_key` = key | Flow 1 |
| `Surfe (Bearer)` | Header Auth | header `Authorization` = `Bearer <key>` | Flow 1 |
| `Lemlist (Basic auth)` | Basic Auth | empty user, API key as password | Flow 5 |

## 3. HubSpot

Give the private app read and write access to companies, contacts and notes, then create the custom properties listed in [architecture.md](architecture.md#hubspot-data-model). `tam_domain` must be a **unique value** property: the batch upsert of Flow 3 uses it as its key.

## 4. Notion

Create two databases and share them with the integration.

- **Leads:** `Name` (title), `LinkedIn URL` (URL), `Title`, `Company`, `Location`, `Intent Signals` (text), `Email` (email), `Score` (number), `RICE Dominant`, `DISC Profile`, `Tier`, `Priority`, `Source`, `Status` (select)
- **Run log:** `Run` (title), `Run ID`, `Commentaire` (text), `Items évalués` (number), `Statut`, `Type`, `Workflow source` (select), `Date run` (date), `Tags` (multi-select)

## 5. Import and replace the placeholders

Import [error-handler.json](../workflows/error-handler.json) first, then the six flows (Workflows, Import from file). Replace the placeholders, either in the JSON files before import or in the nodes after:

| Placeholder | Where | Value |
|---|---|---|
| `YOUR_N8N_HOST` | Flow 2, node `13` | your n8n domain, for the call to Flow 1 |
| `YOUR_SLACK_CHANNEL_ID_BRIEFS` | Flows 0b, 1, 2, 5 | ID of the channel for briefs and enrollments |
| `YOUR_SLACK_CHANNEL_ID_MONITORING` | Flows 1 to 5, error handler | ID of the monitoring channel |
| `YOUR_NOTION_LEADS_DATABASE_ID` | Flow 1, nodes `11` and `11.a` | Leads database ID |
| `YOUR_NOTION_RUN_LOG_DATABASE_ID` | Flow 1, node `M_email_guard Notion log` | Run log database ID |
| `YOUR_HUBSPOT_PORTAL_ID` | Flow 1, node `2.7` | HubSpot account ID, for the link to the contact |
| `YOUR_LEMLIST_CAMPAIGN_ID_SALES_LEADERS`, `YOUR_LEMLIST_CAMPAIGN_ID_FOUNDERS` | Flow 5, node `2` | campaign IDs, or an empty string to disable a group |
| `<SENDER_NAME>`, `<SENDER_LINKEDIN_URL>` | Flow 1, node `10` (prompt) | email signature |

## 6. Market settings

The exports target French B2B SaaS companies with 11 to 200 employees. To change the market, edit:

- Flow 3 form defaults (locations, LinkedIn industry IDs, company sizes)
- Flow 4, nodes `5` and `5.8`: the `ICP location`, `size_min` and `size_max` lines sent after the prompt, and the size table in the prompt. The parsers `5.6` and `5.9` recompute the size points with the same table
- Flow 2, nodes `7` and `7b`: the LinkedIn geo ID in `locations` (`105015875` is France)
- Flow 2, node `8`: the location regex, and disqualification #4 in the persona prompt

## 7. Activate and test

1. In the settings of Flows 2 to 5, set **Error workflow** to the error handler.
2. Test in pipeline order with small batches: Flow 3 with a 5-row CSV, Flow 4 with a batch of 5, Flow 2 with a batch of 1, check the brief produced by Flow 1, then Flow 5 in `preview` mode.
3. Activate the schedules once each step looks right in Slack.
