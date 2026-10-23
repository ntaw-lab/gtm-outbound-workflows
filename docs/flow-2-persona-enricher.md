# Flow 2: persona enricher

For each qualified company, finds the people worth contacting, scores them and keeps one decision-maker per account. Each qualified persona then gets a research brief from [Flow 1](flow-1-research-brief.md).

- **Export:** [workflows/flow-2-persona-enricher.json](../workflows/flow-2-persona-enricher.json) (44 nodes)
- **Triggers:** schedule every hour from 06:00 to 15:00 (10 companies per run), n8n form, or webhook
- **Reads:** companies with `tam_status = qualified` and no `persona_enrichment_status`, oldest first
- **Writes:** `persona_enrichment_status = done`, disqualifications for companies with an in-house team, one Flow 1 call per qualified persona, Slack
- **Prompt:** [prompts/persona-scoring.md](../prompts/persona-scoring.md)

## Steps

| Step | Nodes | What happens |
|---|---|---|
| 1. Count and fetch | `1.5` to `1.8`, `2`, `2b` | Stops when no company is left, otherwise takes the next batch, capped at 10 companies (the limit of the Apify actor in all-at-once mode) |
| 2. Company URLs | `6.5` | Uses the LinkedIn page stored in HubSpot, or derives a URL from the domain. Companies without a usable URL are skipped and listed in Slack |
| 3. Scrape, pass A | `7` | Apify employees actor, filtered at the source on decision-maker titles (sales leaders, revenue and GTM heads, founders, plus a few sales titles) and on the target country |
| 4. Scrape, pass B | `6.6`, `7b` | Only for companies where pass A found someone: a second run on team titles (SDR, BDR, AE, CSM) and on in-house automation roles (GTM, RevOps and growth engineers). Skipping the companies that cannot qualify saves the cost of this second run |
| 5. Merge | `7c`, `7d`, `7e` | Merges both passes and dedupes on LinkedIn URL. If the actor returned nothing, a Slack alert fires and the companies stay in the queue for the next run |
| 6. Team analysis | `7.5` to `7.7` | Counts SDRs, BDRs, AEs and CSMs per company, and flags companies that already employ a GTM, RevOps, growth or automation engineer. Flagged companies are disqualified in HubSpot with the reason |
| 7. Close the batch | `14b`, `14c` | Marks every company of the batch `persona_enrichment_status = done` |
| 8. Filter people | `8` | Keeps sales decision-makers based in the target market who still work at one of the batch companies (matched on company name or LinkedIn slug). Excludes managers of SDR or sales ops teams, senior individual contributors and technical or non-sales executives. Caps the list at 200 |
| 9. Build context | `9.6` | Builds a compact profile for the model and the list of colleagues at the same company, capped at 60 |
| 10. Score | `10` | One Haiku call per person, temperature 0, rubric as the cached prefix |
| 11. Normalize and review | `10.5` to `10.95` | Same pattern as [Flow 4](flow-4-company-qualifier.md): parse, cap each criterion, recompute the score, flag doubts, Sonnet review |
| 12. Business rules | `10.96` | One decision-maker per company (rules below) |
| 13. Hand off | `11`, `13` | One `POST` to Flow 1 per qualified persona, with the profile data and the Flow 2 verdict (score, tier, reason, team counts). Up to 3 attempts, 5 s apart; a failed call does not stop the batch |
| 14. Report | `Merge_final`, `E_format_done` | Slack summary: companies of the batch, disqualified companies, one line per persona with score, tier and breakdown |

## Persona rubric

| Criterion | Points | How |
|---|---|---|
| Title fit | 40 | T1 sales leader (CRO, VP Sales, Head of Sales) 40, T2 sales director or Head of GTM 30, T3 RevOps lead 25, T4 founder of a company under 50 people with no sales leader 5 |
| Tenure in the role | 20 | under 6 months 20, 6 to 12 months 10: a newly hired leader is the most open to new methods |
| No in-house GTM engineer | 15 | none in the company's employee list 15, otherwise 0 |
| Automation and AI signals | 25 | 5 per literal signal in the posts, headline or about section |

A persona qualifies at 50 points with a tier and no hard disqualification (investor or advisor, recruiter, left the company, outside the target market, not a decision-maker).

Doubtful verdicts go to Sonnet: disqualifications #1 to #3, scores between 40 and 55, and people scored with no tier although their headline contains sales or leadership words.

## Business rules after scoring

Node `10.96` groups the verdicts by company and applies two rules that a per-person prompt cannot see:

1. **Sales leaders first.** If a T1 sales leader qualified, a qualified Head of GTM in the same company is demoted. One account gets one message, to the person who owns the number.
2. **Founder fallback.** If no T1 to T3 person qualified, the best-scored founder is promoted, unless the founder's title is technical (CTO, CPO and similar). This exclusion is checked three times, as defense in depth: in the title filter, in the prompt and here.

## Code to read

- [detect-in-house-team.js](../code/flow-2-persona-enricher/detect-in-house-team.js): team counts and in-house engineer detection
- [filter-titles.js](../code/flow-2-persona-enricher/filter-titles.js): title, location and current-employer filters
- [build-model-context.js](../code/flow-2-persona-enricher/build-model-context.js): per-company context for the model
- [parse-persona-verdict.js](../code/flow-2-persona-enricher/parse-persona-verdict.js): verdict normalization and doubt rules
- [tier-priority-override.js](../code/flow-2-persona-enricher/tier-priority-override.js): one decision-maker per account
