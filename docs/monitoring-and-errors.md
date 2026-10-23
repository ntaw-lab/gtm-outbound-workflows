# Monitoring and errors

An outbound engine that runs on schedules needs to be watched without opening n8n. Everything is visible in Slack.

## Two Slack channels

- **Briefs channel**, for people: research brief summaries (Flow 1), Lemlist previews and enrollments (Flow 5), newly detected companies (Flow 0b).
- **Monitoring channel**, for operations: each stage of each run, alerts and errors.

## What each run reports

The flows report in the same four parts:

1. **Start:** the run ID and the batch size. Flows 2 and 4 also count the records left in their queue and stop when it is empty.
2. **Stages:** counts after each expensive step (companies fetched, people kept by the filters, verdicts after scoring, records pushed).
3. **Result:** for scored records, one line each with the score, the breakdown, a review mark when Sonnet re-judged it, and the reason. A short legend explains the breakdown letters.
4. **Alerts:** an empty Apify result, no contact to push, a persona without an email.

Two n8n settings make this practical:

- `executeOnce` on notification nodes: one message per run, not one per item.
- `onError: continueRegularOutput` on most monitoring nodes: a Slack failure does not stop the pipeline.

## Central error handler

[workflows/error-handler.json](../workflows/error-handler.json) is a two-node workflow: an Error Trigger and a Slack message with the workflow name, the execution ID, the failing node, the error type and message, the start time and the execution mode. It was set as the error workflow of Flows 2 to 5 (workflow settings, Error workflow), so any failure lands in the monitoring channel with enough context to open the right execution.
