# Lessons learned

What building and running this engine taught me, grouped by topic. Each point maps to something visible in the workflows.

## Working with the models

1. **Make the model show its math, then check it in code.** The prompts ask for a points breakdown, not just a verdict. The parsers cap each criterion, recompute what code can compute (size points from the employee count) and apply the threshold themselves. See [parse-haiku-verdict.js](../code/flow-4-company-qualifier/parse-haiku-verdict.js).
2. **Close the lists.** Disqualifications are a numbered, closed list, and the model must cite a number. "Rule zero: do not invent rules" stops the model from adding exclusion criteria of its own, and the parser ignores any reason outside the list.
3. **Teach with anti-examples.** A recurring confusion was between a software vendor that serves a sector and a company that operates in it (software for clinics versus a clinic). A short list of "do not disqualify" examples in the prompt addresses it directly.
4. **Escalate instead of upgrading everything.** Haiku handles the volume. Sonnet only sees the verdicts that match known error patterns or sit close to the threshold, and gets the Haiku verdict to audit. The doubt rules were added one by one, as error patterns showed up in the runs.
5. **Parse defensively.** Even with "one JSON block only", a model sometimes corrects itself and returns two. The parsers take the last valid block that contains the expected key.
6. **Put cross-record rules in code.** "One decision-maker per account" cannot be decided by a prompt that sees one person at a time. It runs after scoring, on the group of verdicts for each company. See [tier-priority-override.js](../code/flow-2-persona-enricher/tier-priority-override.js).

## Working with n8n

1. **The expression parser has limits.** A classic `(function(){ ... })()` breaks inside `{{ }}` while an arrow function works, and a regex literal with escaped slashes broke when the workflow was saved through the API. The reliable pattern: build complex payloads in a Code node and send `{{ JSON.stringify($json.body) }}`.
2. **Item pairing breaks after HTTP nodes and IF branches.** `$('Node').item` can point to the wrong record. Re-join on a business key (email in Flow 5) or use `itemMatching` against the branch output (Flows 2 and 4).
3. **Control the fan-out.** A node that returns one item per post makes every following node run once per post. Aggregate early, and use `executeOnce` on notifications.
4. **Code nodes cannot call authenticated helpers** in the task runner of the n8n version I used. Authenticated calls go through HTTP Request nodes with credentials.
5. **Treat workflows as code.** Changing them through the REST API in small steps, with a JSON snapshot before each major change, gave me a history I could diff and roll back.

## Working with the data

1. **LinkedIn data is messy.** The employees actor returns some people who work elsewhere, so the context sent to the model is rebuilt per company from the LinkedIn slug, and people are matched back to their company by name or slug. Some profile URLs carry an encoded ID that cannot be scraped by slug: Flow 1 falls back to the data sent by Flow 2.
2. **Tool limits shape the design.** The employees actor handles 10 companies per run in all-at-once mode, which sets the batch size of Flow 2.
3. **Scrape in two passes.** A cheap, targeted pass first, and the wider pass only where it can pay off.
4. **Choose the CRM keys first.** A normalized domain in a custom unique property for companies, the email for contacts. No contact is created without an email.
5. **Notion has no "replace content" endpoint.** Updating a brief means deleting the old blocks and appending the new ones, and looking the page up by LinkedIn URL first to avoid duplicates.
