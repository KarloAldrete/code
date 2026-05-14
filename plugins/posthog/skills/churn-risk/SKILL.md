---
name: churn-risk
description: "Identify paying customers at risk of churn from PostHog usage data. Trigger when the user asks who's about to churn, which customers are using the product less, who's slipping, who's going dark, wants a churn watchlist, asks about declining usage or accounts, mentions 'churn risk', 'at-risk accounts', 'shrinking customers', 'revenue at risk', or wants to find paying customers whose usage has dropped vs a previous period."
---

# Churn risk

## What this skill does

Flags paying customers whose product usage has dropped, scores each one out of 100, and estimates revenue at risk.

For every paying customer the skill compares two windows (last 30 days vs the prior 30 days by default) across:

1. **Total events triggered** — broad activity signal
2. **Active users per customer** — distinct `person_id`s emitting events for that customer (group-level analyses only — for person-level customers this is always 1)
3. **Two valuable events** chosen by the user — the strongest signal that real value is still being delivered

Output is two ranked tables — one by churn risk score, one by revenue at risk — plus a signals block highlighting false positives and the largest absolute exposures.

Important: a drop in total events alone is a weak signal. If valuable events and active users are steady, the customer is probably fine. The scoring algorithm explicitly down-weights and flags these cases so you don't waste CS bandwidth chasing noise. Conversely, a drop in active users while events look healthy often means a team is shrinking (seats lost, champion left) — a strong signal that valuable-event volume isn't yet showing because the remaining users are working harder.

---

## Before you start

Make sure the PostHog MCP is connected. If it isn't, tell the user:
> "You'll need the PostHog MCP connected to use this skill. Run `npx @posthog/wizard mcp add` to set it up, then restart Claude Code."

No API keys or project IDs are needed — the MCP handles authentication.

---

## Gather context

Before running any analysis, collect the following. Ask all of these in a single message so the user isn't interrupted mid-task.

**1. Customer unit** (required)
Are "customers" tracked as a **group** (e.g. `organization`, `customer`) or as identified **persons**? B2B products typically use groups; B2C products usually treat each person as a customer.

If the user isn't sure, check what group types are defined and which have data:
```sql
SELECT group_type_index, count() AS group_count
FROM groups
GROUP BY group_type_index
ORDER BY group_count DESC
```
Map the indexes back to the project's defined group types and confirm with the user. From here on, every query in this skill uses either `groups.{group_type}.id` or `person_id` as the customer key — pick once and use it everywhere.

**2. Paying-customer filter** (required)
Which property identifies a paying customer? Discover candidates by listing top group/person property keys:

For groups:
```sql
SELECT DISTINCT arrayJoin(JSONExtractKeys(group_properties)) AS property_key
FROM groups
WHERE group_type_index = {group_type_index}
LIMIT 100
```

For persons:
```sql
SELECT DISTINCT arrayJoin(JSONExtractKeys(properties)) AS property_key
FROM persons
LIMIT 100
```

Common patterns to suggest:
- `groups.customer.plan != 'free'`
- `groups.organization.is_paying = true`
- `groups.customer.subscription_status = 'active'`
- A join against a Stripe data warehouse table (e.g. `stripe.customers` where `delinquent = false` and `subscription_status = 'active'`)

Confirm the exact filter expression with the user before continuing — every subsequent query depends on it.

**3. Revenue field** (required for the revenue-at-risk table)
Which property holds MRR, ARR, or contract value? Use the same property-discovery query. Common patterns: `groups.customer.mrr`, `groups.organization.arr`, or a Stripe data warehouse join (sum of active subscription `plan.amount`).

If no revenue field exists, the skill still runs but skips the revenue table and tells the user revenue at risk could not be calculated.

**4. Two valuable events** (required)
Two events that represent real product value — not pageviews, not autocapture. Examples: "exported report", "ran analysis", "published campaign", "created pipeline".

If the user isn't sure, suggest candidates from current paying-customer activity:
```sql
SELECT event, count() AS cnt, uniq({customer_key}) AS distinct_customers
FROM events
WHERE timestamp >= now() - interval 30 day
  AND {paying_filter}
  AND event NOT IN ('$pageview', '$pageleave', '$autocapture', '$identify', '$set', 'survey sent', '$feature_flag_called')
GROUP BY event
HAVING distinct_customers >= 5
ORDER BY cnt DESC
LIMIT 30
```
Replace `{customer_key}` with `groups.customer.id` (or your chosen group key) or `person_id`. Replace `{paying_filter}` with the filter confirmed in step 2.

Present the results and ask: "Which two of these best represent real product value? I'll use these as the strong-signal metric — they outweigh raw event volume in the risk score."

**5. Time windows** (default: last 30 days vs prior 30 days)
Confirm even briefly:
> "I'll compare the last 30 days vs the 30 days before that. Want a different window? Common alternatives: 14d/14d for fast-moving products, 60d/60d or 90d/90d for low-frequency products."

Do not silently default — always confirm.

---

## Run the analysis

Run each query separately using `execute-sql`. In the snippets below, substitute:
- `{customer_key}` → `groups.customer.id` (or whatever you confirmed in step 1) or `person_id`
- `{paying_filter}` → the filter from step 2
- `{event_1}`, `{event_2}` → the two valuable events from step 4
- Window length (`30 day`) → whatever the user confirmed in step 5

### Query A — Total events, current vs prior window

```sql
WITH
  current_window AS (
    SELECT {customer_key} AS customer_id, count() AS events_current
    FROM events
    WHERE timestamp >= now() - interval 30 day
      AND {paying_filter}
    GROUP BY customer_id
  ),
  prior_window AS (
    SELECT {customer_key} AS customer_id, count() AS events_prior
    FROM events
    WHERE timestamp >= now() - interval 60 day
      AND timestamp <  now() - interval 30 day
      AND {paying_filter}
    GROUP BY customer_id
  )
SELECT
  coalesce(c.customer_id, p.customer_id) AS customer_id,
  coalesce(p.events_prior, 0)   AS events_prior,
  coalesce(c.events_current, 0) AS events_current,
  if(p.events_prior > 0,
     (c.events_current - p.events_prior) / p.events_prior,
     NULL) AS pct_change_total
FROM current_window c
FULL OUTER JOIN prior_window p USING (customer_id)
```

### Query B — Active users per customer, current vs prior window

**Skip this query for person-level analyses** — for person-level customers, active users per customer is always 1 and contributes nothing to the score.

```sql
WITH
  current_window AS (
    SELECT {customer_key} AS customer_id, uniq(person_id) AS active_users_current
    FROM events
    WHERE timestamp >= now() - interval 30 day
      AND {paying_filter}
    GROUP BY customer_id
  ),
  prior_window AS (
    SELECT {customer_key} AS customer_id, uniq(person_id) AS active_users_prior
    FROM events
    WHERE timestamp >= now() - interval 60 day
      AND timestamp <  now() - interval 30 day
      AND {paying_filter}
    GROUP BY customer_id
  )
SELECT
  coalesce(c.customer_id, p.customer_id) AS customer_id,
  coalesce(p.active_users_prior, 0)   AS active_users_prior,
  coalesce(c.active_users_current, 0) AS active_users_current,
  if(p.active_users_prior > 0,
     (c.active_users_current - p.active_users_prior) / p.active_users_prior,
     NULL) AS pct_change_active_users
FROM current_window c
FULL OUTER JOIN prior_window p USING (customer_id)
```

### Query C — Valuable events, current vs prior window

Same shape as Query A but filtered to the two valuable events.

```sql
WITH
  current_window AS (
    SELECT {customer_key} AS customer_id, count() AS valuable_current
    FROM events
    WHERE timestamp >= now() - interval 30 day
      AND event IN ('{event_1}', '{event_2}')
      AND {paying_filter}
    GROUP BY customer_id
  ),
  prior_window AS (
    SELECT {customer_key} AS customer_id, count() AS valuable_prior
    FROM events
    WHERE timestamp >= now() - interval 60 day
      AND timestamp <  now() - interval 30 day
      AND event IN ('{event_1}', '{event_2}')
      AND {paying_filter}
    GROUP BY customer_id
  )
SELECT
  coalesce(c.customer_id, p.customer_id) AS customer_id,
  coalesce(p.valuable_prior, 0)   AS valuable_prior,
  coalesce(c.valuable_current, 0) AS valuable_current,
  if(p.valuable_prior > 0,
     (c.valuable_current - p.valuable_prior) / p.valuable_prior,
     NULL) AS pct_change_valuable
FROM current_window c
FULL OUTER JOIN prior_window p USING (customer_id)
```

### Query D — Customer metadata + revenue

For groups:
```sql
SELECT
  key AS customer_id,
  group_properties.name AS customer_name,
  group_properties.plan AS plan,
  toFloat64OrNull(toString(group_properties.{revenue_field})) AS mrr
FROM groups
WHERE group_type_index = {group_type_index}
  AND {paying_filter}
```

For persons, swap `groups`/`group_properties` for `persons`/`properties` and use `id` as the customer_id.

Adjust the `{revenue_field}` name to match what the user confirmed. If the revenue field lives in a data warehouse table (e.g. Stripe), join it instead.

---

## Compute the risk score (0–100)

Combine the query results in your response (or as a final CTE) with this algorithm.

For each dimension, compute the decline ratio as `max(0, -pct_change)`, capped at `1.0`. A –70% drop becomes `0.7`; growth becomes `0`. Treat `NULL` (no prior activity) as `0`.

1. `decline_total`
2. `decline_active_users` (group-level only)
3. `decline_valuable`

**Weighted risk** depends on whether active users is available:

- **Group-level** (active users available): `(0.15 × decline_total) + (0.30 × decline_active_users) + (0.55 × decline_valuable)`
- **Person-level** (no active users dimension): `(0.25 × decline_total) + (0.75 × decline_valuable)`

Valuable events are always the strongest signal. For group-level analyses, active-user decline carries 2× the weight of raw event volume — a shrinking team is a meaningful churn signal even when remaining users keep activity up.

**Guards** (applied after the weighted sum):

4. **False-positive guard (`⚠ noisy`)**: if `decline_total >= 0.30` AND `decline_valuable <= 0.10` AND (for group-level) `decline_active_users <= 0.10`, multiply the weighted risk by `0.4` and flag. Reasoning: total event volume dropped but value actions AND seat count held steady — likely instrumentation noise, a seasonal pageview drop, or a heavy user on vacation, not real churn.
5. **Seat-loss flag (`⚠ seats lost`)** (group-level only): if `decline_active_users >= 0.30` AND `decline_valuable < 0.30`, flag the row. The team has lost users but the survivors are keeping value actions up — a champion may have left or seats were reduced. Score is not adjusted; this is a context flag for the CS team.
6. **Low-baseline guard**: if `events_prior < 50`, cap the score at `50` and flag `low baseline`. Small numbers swing wildly and aren't trustworthy.
7. `risk_score = round(weighted_risk × 100)`.
8. `revenue_at_risk = mrr × (risk_score / 100)`. If `mrr` is missing for a customer, leave it blank. If the revenue field wasn't available at all, skip this column and the second table.

---

## Output format

Render two tables and a signals block.

```
**Churn risk — last 30d vs prior 30d** ({customer_count} paying customers analyzed)

**Top 10 by churn risk**

For group-level analyses include the active users column. For person-level, omit it.

| Rank | Customer | Plan | MRR | Events (prior → current) | Active users (prior → current) | Valuable (prior → current) | Risk | Notes |
|------|----------|------|-----|--------------------------|--------------------------------|----------------------------|------|-------|
| 1 | Acme Corp | Enterprise | $4,500 | 12,400 → 3,100 (-75%) | 22 → 8 (-64%) | 320 → 60 (-81%) | 80 |  |
| 2 | BetaCo    | Pro        | $800   | 8,200 → 2,100 (-74%)  | 14 → 13 (-7%)  | 145 → 138 (-5%)           | 18   | ⚠ noisy |
| 3 | GammaInc  | Growth     | $2,200 | 18,000 → 17,500 (-3%) | 25 → 9 (-64%)  | 410 → 380 (-7%)           | 19   | ⚠ seats lost |
| 4 | ...       | ...        | ...    | ...                   | ...            | ...                       | ...  | ... |

**Top 10 by revenue at risk**

| Rank | Customer | Plan | MRR | Risk | Revenue at risk |
|------|----------|------|-----|------|-----------------|
| 1 | BigCo | Enterprise | $12,000 | 62 | $7,440 |
| 2 | ...   | ...        | ...     | ... | ...    |

**Signals worth noting**
• Total revenue at risk across the top 10: $X
• {n} customers flagged ⚠ noisy — total volume down but value actions and active users steady; likely false positives, deprioritize
• {n} customers flagged ⚠ seats lost — active users down ≥30% while valuable activity holds; champion may have left or seats reduced; worth a CS check-in even if the score is moderate
• {n} customers with low baseline — too little prior activity to score confidently
• Largest absolute MRR at risk: {customer} (${amount})
• {n} customers with valuable events down while total events held — quiet early-churn signal, worth a closer look even if risk score is moderate
```

Cap each table at 10 rows. If revenue data isn't available, omit the MRR column from table 1, skip table 2, and note this explicitly.

---

## Interpreting the results

- **All three metrics down sharply** → strongest churn signal. Reach out fast — these are the conversations CS should have this week.
- **Total down, valuable + active users steady (`⚠ noisy`)** → don't panic. Often instrumentation changes, sampling, a power user on vacation, or a one-off integration script that stopped firing. Investigate the data source before alarming the account team.
- **Active users down, valuable per-user steady (`⚠ seats lost`)** → the team shrank but survivors are still getting value. Often a champion left, a project ended, or seats were trimmed at renewal. Won't necessarily churn but is a strong expansion-risk signal — losing seats now usually means a smaller contract next renewal.
- **Valuable down, total + active users steady** → the quietest and often *earliest* real churn signal. Users are still showing up but have stopped doing the actions that matter. Prioritize these even when the risk score is moderate.
- **Active users + valuable down together, total flat** → classic disengagement: fewer people coming back, and the ones who do are doing less. Treat as high-priority even if total events look fine.
- **All three up** → not a risk; potentially an expansion conversation.
- **Low baseline** → don't act on the score alone. Pull the customer's full history before drawing any conclusion.

---

## Optional follow-ups

Offer these after the tables are rendered:

- **Save a cohort** (`cohorts-create`) — "At-risk customers — {Month Year}", containing the top 10–25 by risk score. For person-level analyses this is a real PostHog cohort; for group-level, hand the user the list of customer IDs to load into their CS tool.
- **Build a recurring dashboard** (`dashboard-create` + `insight-create`) — track this over time:
  - Total revenue at risk per week
  - Count of customers flagged at-risk per week
  - Trend of total + valuable events for each top-risk customer
  - Count of `⚠ noisy` flags (instrumentation watchdog — a sustained rise here usually means a tracking bug, not a churn wave)

---

## Evaluation

After delivering the report, offer the user a quick rating so we can improve this skill over time. This step is **optional** — if the user dismisses the selector, end the turn normally and do **not** send an event.

1. Say one short line — *"One last thing — quick rating? You can add notes on your selection, or skip."* — then call the `AskUserQuestion` tool with **exactly one** question:
   - `question`: `"How useful was this?"`
   - `header`: `"Rating"`
   - `multiSelect`: `false`
   - `options` (in this order):
     1. label `"Very useful (4)"`, description `"Solved the problem end-to-end."`
     2. label `"Useful (3)"`, description `"Mostly helpful, minor gaps."`
     3. label `"OK (2)"`, description `"Some value but notable issues."`
     4. label `"Not useful (1)"`, description `"Did not help."`

   Do **not** add a "Skip" option — the UI provides one automatically.

2. Read the response:
   - If the user picked a chip, map the label to a rating: `"Very useful (4)" → 4`, `"Useful (3)" → 3`, `"OK (2)" → 2`, `"Not useful (1)" → 1`. Pull optional free-text feedback from `annotations["How useful was this?"].notes` (empty string if absent).
   - If the user picked "Other", treat the typed text as feedback. If it contains a number 1–4, use that as the rating; otherwise treat the response as feedback-only and **do not** send an event.
   - If the user dismissed the selector / skipped, end the turn normally and do **not** send an event.

3. If a rating was captured, fire a `work_skill_rated` event on PostHog project 2 by running this curl via the Bash tool (fill in `<rating>`, `<feedback>`, `<artifacts>`, `<input_summary>`):

   ```bash
   curl -s -X POST https://us.i.posthog.com/i/v0/e/ \
     -H 'Content-Type: application/json' \
     -d '{
       "api_key": "sTMFPsFhdP1Ssg",
       "event": "work_skill_rated",
       "distinct_id": "<operator-email-or-work-skills-anonymous>",
       "properties": {
         "skill_name": "churn-risk",
         "rating": <rating>,
         "rating_scale": "1-4",
         "feedback": "<feedback>",
         "mode": null,
         "artifacts_created": <artifacts>,
         "input_summary": "<input_summary>"
       }
     }'
   ```

   - `distinct_id`: the operator email from the active-environment system reminder if available; otherwise `"work-skills-anonymous"`.
   - `artifacts_created`: array of `"<type>:<id>"` strings for any PostHog entities created during this run (e.g. cohorts, dashboards, insights from the optional follow-ups). Use `[]` if none.
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"Churn risk for top 30 customers, last 30 days"`).
4. Confirm to the user with one short line, e.g. *"Thanks — logged your 3/4 rating."*

If the curl call returns a non-2xx response, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "Who's about to churn?"
- "Which paying customers are using us less than before?"
- "Give me a churn watchlist"
- "Which accounts are going dark?"
- "Show me revenue at risk"
- "Find shrinking customers"
- "Who's slipping?"
- "Build a churn-risk dashboard"
