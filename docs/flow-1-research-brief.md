# Flow 1: research brief

Turns one LinkedIn profile URL into a research brief that a salesperson reads before the first message: what motivates the person, how they communicate, how to open the conversation, and a first email draft. It also finds the email address and creates the CRM record.

- **Export:** [workflows/flow-1-research-brief.json](../workflows/flow-1-research-brief.json) (42 nodes)
- **Trigger:** webhook `POST /webhook/brief-pipeline`, called by [Flow 2](flow-2-persona-enricher.md) for each qualified persona, or by a Slack slash command (`/brief` + LinkedIn URL) through a small listener service that is not part of this repo
- **Writes:** Notion brief page, HubSpot contact and note, Slack summary
- **Prompt:** [prompts/research-brief.md](../prompts/research-brief.md)

## Steps

| Step | Nodes | What happens |
|---|---|---|
| 1. Parse | `1`, `2` | Extracts the profile slug and the Slack channel and thread to answer in |
| 2. Skip recent briefs | `2.5` to `2.7` | Looks the profile up in HubSpot by LinkedIn URL. If it was briefed less than 30 days ago, posts the date and the HubSpot link to Slack and stops |
| 3. Profile | `2.8`, `3a`, `3` | Scrapes the profile with Apify. Some URLs carry an encoded LinkedIn ID instead of a public slug and cannot be scraped this way: the resolver then rebuilds the profile from the data Flow 2 sent with the request |
| 4. Company and posts | `4`, `7.5`, `8`, `8b` | Scrapes the current company page, then up to 3 posts from the last 6 months. The posts are aggregated into one item, so everything after runs once per brief instead of once per post |
| 5. Email waterfall | `9a` to `9f`, `9d` | Hunter (domain and name), then FullEnrich, then Lusha (LinkedIn URL), then Surfe (asynchronous: request, wait 8 s, fetch). Each provider is only called if the previous one found nothing. Node `9d` recognizes which provider answered from the shape of the response |
| 6. Brief | `9.6`, `10` | One Sonnet call, temperature 0, with the rubric as the cached prefix and the profile, company, posts and email result as data (truncated to 15,000 characters) |
| 7. Notion | `11.a`, `11.b`, `11`, `11u.1` to `11u.7` | Looks the lead up by LinkedIn URL. New lead: creates the page. Known lead: updates the properties and icon, deletes the old content blocks one by one and appends the new brief, because Notion has no endpoint to replace a page's content |
| 8. Email gate | `11.5`, `M_email_guard` | No email found: Slack alert and a "NO-GO" entry in the Notion run log. No HubSpot contact is created without an email |
| 9. HubSpot | `12a`, `12`, `12b` | Builds the contact properties, batch-upserts the contact by email, then attaches the full brief as an HTML note |
| 10. Slack | `13` | Posts the summary where the request came from: new or updated brief, company and size, role, email and provider, Notion link, score, motivation, style, tier, priority, the top 3 rapport openers, the recommended angle and the email draft |

## What the brief contains

The model returns one JSON object. Explicit counting rubrics at temperature 0 keep the brief consistent from one run to the next, and every score can be traced back to the cues found:

- **RICE motivation** (Reward, Ideology, Coercion, Ego): each axis scored 0 to 5 by counting literal cues in the headline, about section and posts, with quotes as evidence and a dominant axis
- **DISC communication style**: primary and secondary style from counted behavioral cues, always flagged "to confirm in conversation"
- **Rapport openers**: 4 to 6 topics, each tied to a quote
- **Approach plan**: one cell of a 4 x 4 matrix (DISC style x dominant motivation), three steps (foundation, alignment, open question) and three pitfalls for this style
- **First email**: 60 to 100 words, in the prospect's language, with no invented numbers
- **Score, tier and priority** for the sales team

The same JSON feeds four outputs: Notion blocks (11 and 11u.1), the HubSpot HTML note (12b), the Slack summary (13) and a one-line `rice_preview` property in HubSpot (12a).

## Contact properties worth noting

Node `12a` prepares the CRM record:

- **Job title for mail merge.** LinkedIn titles are noisy ("VP Sales EMEA @ Company | We're hiring!"). The cleaner cuts what follows `@`, `|` or a spaced dash, removes parentheses, a leading "Founder &", geographic prefixes and suffixes, and normalizes "Vice President" to "VP of". The result goes into `job_title_lemlist`, left empty for founders.
- **Reason and team context.** `qualified_reason` keeps the Flow 2 verdict and adds the SDR, BDR, AE and CSM counts found at the company, which tells the salesperson how the team is built before the call.
- **Statuses.** `persona_status = qualified` and `outbound_status = not_started` put the contact in the queue of [Flow 5](flow-5-lemlist-push.md).

## Code to read

- [profile-resolver.js](../code/flow-1-research-brief/profile-resolver.js): scrape result or fallback to the upstream payload
- [merge-email-result.js](../code/flow-1-research-brief/merge-email-result.js): provider detection at the end of the waterfall
- [prep-contact-props.js](../code/flow-1-research-brief/prep-contact-props.js): job title cleaning and CRM properties
