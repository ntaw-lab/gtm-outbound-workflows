# Flow 5: Lemlist push

Enrolls qualified contacts into the right Lemlist campaign for their persona tier, then marks them as sent in HubSpot. A preview mode shows exactly who would be enrolled before anything is sent.

- **Export:** [workflows/flow-5-lemlist-push.json](../workflows/flow-5-lemlist-push.json) (19 nodes)
- **Triggers:**
  - webhook `POST /webhook/flow5-push-lemlist` with `mode` (`preview` by default, `batch` or `single`), `tier` (`all`, `sales` or `ceo`), `email` for single mode and `batch_size` (100 at most)
  - daily schedule at 11:00 in `batch` mode, all tiers, 100 contacts
- **Reads:** contacts with `persona_status = qualified` and `outbound_status = not_started`, oldest first
- **Writes:** Lemlist leads, `outbound_status = sent` and `outbound_sequence_id` in HubSpot, Slack

## Steps

| Step | Nodes | What happens |
|---|---|---|
| 1. Normalize | `2`, `3`, `3b` | Reads the parameters, sets the run ID and the two campaign IDs, posts a start message with the mode (dry run or live) |
| 2. Fetch | `4` | Searches HubSpot for the queue, or for one contact by email in single mode |
| 3. Route | `5` | Tiers 1 to 3 (sales leaders, sales directors, RevOps leads) go to the sales leaders campaign, tier 4 (founders) to the founders campaign. Contacts without an email, a LinkedIn URL or a target campaign are skipped. The list is trimmed to the batch size |
| 4. Stop if empty | `5.5`, `5.6` | Posts an abort message when nothing matches |
| 5a. Preview | `6`, `10`, `11` | Dry run: posts the list of contacts that would be enrolled (name, title, company, campaign, tier). Nothing is sent |
| 5b. Live | `7`, `7.5`, `7.7` | Adds each lead to its campaign with Lemlist deduplication on, joins the Lemlist answer back to the contact by email, then updates the lead's fields (cleaned job title, names, company, LinkedIn URL) |
| 6. Close the loop | `8`, `9`, `12` | Sets `outbound_status = sent` and the campaign ID on each HubSpot contact (500 ms apart), then posts the list of enrolled contacts |

## Design notes

- **Preview by default.** A manual call without `mode` only previews. Sending requires an explicit `batch` or `single` mode.
- **Join on a business key.** After an HTTP node, n8n can lose the link between an output item and the input item that produced it. Node `7.5` rebuilds it by email instead of relying on item order.
- **Campaign per persona.** A founder of a 20-person company and a VP Sales do not get the same message. The tier computed in Flow 2 decides the campaign, and an empty campaign ID simply disables that group.
- **Authentication.** Lemlist uses HTTP Basic auth with an empty user name and the API key as password, stored as an n8n credential.

## Code to read

- [filter-by-tier.js](../code/flow-5-lemlist-push/filter-by-tier.js): routing and guards
- [merge-lemlist-response.js](../code/flow-5-lemlist-push/merge-lemlist-response.js): join by email after the HTTP call
