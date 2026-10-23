# Flow 4: company qualifier

Scores every new company against the ideal customer profile and writes a status, a score and a readable reason to HubSpot. Claude Haiku scores every company; Claude Sonnet reviews only the doubtful verdicts.

- **Export:** [workflows/flow-4-company-qualifier.json](../workflows/flow-4-company-qualifier.json) (25 nodes)
- **Triggers:** daily schedule at 07:00 (50 companies), n8n form, or webhook (`POST` with `batch_size`, answers `ok` immediately)
- **Reads:** companies with `tam_status = new` or no status, oldest `tam_first_seen` first
- **Writes:** `tam_status`, `score_icp`, `qualified_reason` or `disqualif_reason`, Slack
- **Prompt:** [prompts/company-scoring.md](../prompts/company-scoring.md)

## Steps

| Step | Nodes | What happens |
|---|---|---|
| 1. Count | `1c`, `1.5` to `1.8` | Counts the companies left to score, posts it to Slack and stops when it is zero |
| 2. Fetch | `2`, `2b` | Takes the next batch from HubSpot, oldest first, one item per company |
| 3. Score | `5` | One Haiku call per company, temperature 0, 250 ms apart, 30 s timeout. The rubric is the cached prefix, the company record follows (truncated to 8,000 characters) |
| 4. Normalize | `5.6` | Parses and re-checks the verdict (rules below) and flags doubtful cases |
| 5. Review | `5.7` to `5.95` | Doubtful verdicts go to Sonnet with the Haiku verdict attached as an audit request. Sonnet's verdict goes through the same checks and replaces Haiku's. Both branches are merged |
| 6. Write | `5.4`, `5.5` | One batch update per 100 companies, 2 s apart. The reason holds the score, the breakdown, the verdict text, a review tag and the date |
| 7. Report | Slack nodes | One line per company: status, score, breakdown, a robot icon when Sonnet reviewed it, and the first words of the reason |

## Scoring rubric

| Criterion | Points | How |
|---|---|---|
| Industry | 40 | pure B2B SaaS 40, software or IT services with some SaaS 25, tech services 10, consulting, agencies, hardware 0 |
| HQ country | 25 | target country 25, clear local presence 10, none 0 |
| Size | 20 | 11-50 employees 15, 51-200 20, 201-500 5, otherwise 0 |
| Growth signals | 15 | 5 per literal signal in the description (Series A, hiring sales roles, international expansion...) |

A company qualifies at **50 points** with no hard disqualification. The 5 hard disqualifications form a closed list (B2C marketplace, company operating in an excluded sector, holding company, closed or acquired company, open-source ERP sold as services), and the model must cite one by number.

## The code checks the model

The parser in node `5.6` does not trust the model's own total or its yes or no:

1. It keeps the last valid JSON block that contains `is_icp`. Models sometimes return two blocks after correcting themselves.
2. It caps each criterion at its maximum.
3. It recomputes the size points from the employee count stored in HubSpot when there is one. Counting is something code does better than a model.
4. It accepts a disqualification only if it is a number from 1 to 5.
5. It computes the score as the sum of the points (0 when disqualified) and qualifies the company only if the score is 50 or more.

The model's original score and verdict are kept in an `_audit` object, with a flag when the size points had to be corrected.

## When Sonnet reviews

A verdict is flagged as doubtful when:

- the disqualification is #2 (excluded sector) or #5 (open-source ERP), both error-prone for software vendors that serve those sectors
- the disqualification is #1 (B2C marketplace) while the points add up to 50 or more, a frequent false positive for B2B software sold to consumer brands
- there is no disqualification and the score is between 40 and 55
- the industry got 10 points or less, but the company is in the target market and has 11 to 500 employees, a sign that a software vendor was scored as a services firm

Sonnet gets the same rubric plus the Haiku verdict, with the instruction to check it and correct it. Its result is parsed by the same rules, tagged `[SONNET REVIEW]`, and the audit object records whether Haiku was wrong.

## Code to read

- [parse-haiku-verdict.js](../code/flow-4-company-qualifier/parse-haiku-verdict.js): verdict normalization and doubt rules
- [parse-sonnet-override.js](../code/flow-4-company-qualifier/parse-sonnet-override.js): review merge and audit trail
- [prepare-batch-update.js](../code/flow-4-company-qualifier/prepare-batch-update.js): readable reasons and chunked HubSpot update
