---
name: board-metrics-pack
description: "Generate a board-ready monthly finance pack — MRR, ARR, NRR, GRR, logo churn, MRR movement (new / expansion / contraction / churn), revenue concentration, and a PostHog-specific 'quiet revenue' overlay that flags paying customers with no product usage. Trigger when the user asks for board metrics, a monthly board pack, an investor update, the finance numbers, a revenue summary, an MRR snapshot, ARR/MRR/NRR/GRR, net revenue retention, gross revenue retention, logo churn, dollar churn, revenue concentration, quiet revenue, paying-but-not-using customers, MoM revenue growth, or 'put together the metrics for the board meeting'."
---

# Board metrics pack

## What this skill does

Builds the recurring CFO/board reporting view a finance lead would otherwise stitch together by hand from Stripe and a spreadsheet — plus a PostHog-specific overlay that no billing tool can produce on its own.

Each run produces a board-ready Markdown report with:

1. **Headline numbers** — MRR, ARR, MoM growth, paying customer count, ARPA
2. **MRR movement** — new / expansion / contraction / churned / net new (the decomposition every board deck opens with)
3. **Retention** — Net Revenue Retention (NRR) and Gross Revenue Retention (GRR), plus logo churn
4. **Concentration** — top 10 customers as % of MRR, with a board-flag threshold
5. **Engagement overlay (PostHog-only)** — splits current MRR into *engaged $* (customers actually using the product) vs *quiet $* (paying but silent). Quiet revenue is the leading indicator that pure Stripe data can't see and is usually the most actionable section of the pack for CS.

The output is sized to paste into a monthly memo or board pre-read with no further editing.

---

## Before you start

Make sure the PostHog MCP is connected. If it isn't, tell the user:
> "You'll need the PostHog MCP connected to use this skill. Run `npx @posthog/wizard mcp add` to set it up, then restart Claude Code."

No API keys or project IDs are needed — the MCP handles authentication.

---

## Gather context

Before running any analysis, collect the following. Ask all of these in a single message so the user isn't interrupted mid-task.

**1. Reporting period** (required)
Board metrics are reported on *closed* periods — never on a month-in-progress, since mid-period numbers always understate. Default:
> "I'll report on the last completed calendar month vs the month before that. Prefer quarterly (last completed quarter vs prior quarter) or a custom window?"

Do not silently default — always confirm.

**2. Customer unit** (required)
Are "customers" tracked as a **group** (e.g. `organization`, `customer`) or as identified **persons**? B2B products typically use groups; B2C products usually treat each person as a customer.

If the user isn't sure, check what group types are defined and which have data:
```sql
SELECT index, count() AS group_count
FROM groups
GROUP BY index
ORDER BY group_count DESC
```
The column is `index` on the analytics `groups` table — not `group_type_index`. Map each index back to the project's defined group types (the project metadata lists them in order — index 0 is the first defined group type) and confirm with the user. From here on, every query uses either `groups.{group_type}.id` (events side) or filters `groups.index = {n}` (groups side) as the customer key — pick once and use it everywhere.

**3. Revenue source** (required)
Where does MRR live? Three common shapes:

**Option A — Data warehouse (preferred when available).** A Stripe (or equivalent billing) connection in PostHog's data warehouse. Typical tables: `stripe.subscriptions`, `stripe.invoices`, `stripe.customers`, or an internal billing-system mirror (e.g. `prod_postgres_billing_invoice` with a per-customer `mrr` column and `period_start`/`period_end`). This is the source of truth and handles upgrades / downgrades / cancellations cleanly. Confirm the table and the MRR column with the user — typically a pre-computed `mrr` column, or `plan.amount` divided by `plan.interval_count` normalized to monthly.

⚠ **Cross-source sanity check before committing.** Many projects have *both* a Stripe-direct subscription table (e.g. `prod_stripe_subscription`) and an internal billing mirror (e.g. `prod_postgres_billing_invoice`). The internal mirror is often materially incomplete — it may only cover one billing pathway (e.g. self-serve via the in-product billing flow), missing enterprise-direct, partner-billed, or legacy customers. Before committing to a source, run:

```sql
SELECT
  (SELECT uniq(customer_id) FROM prod_stripe_subscription WHERE status = 'active' AND livemode = true) AS active_subs_customers,
  (SELECT uniq(customer_id) FROM prod_postgres_billing_invoice WHERE toDate(period_start) <= toDate('{snapshot}') AND toDate(period_end) >= toDate('{snapshot}') AND mrr > 0) AS invoice_sample_customers
```

If `invoice_sample_customers` is materially smaller than `active_subs_customers` (e.g. 10×+ smaller), the invoice source is a *sample*, not the population. Either (a) compute MRR from `prod_stripe_subscription.plan` JSON for full coverage, (b) bridge billing IDs via a customer-mapping table (e.g. `prod_postgres_billing_customertostripecustomer`), or (c) report the headline from a forecast / ARR-aggregate table and explicitly scope the per-customer sections as a sample. Always cross-check the implied headline against the forecast table if one exists — a +9% MoM forecast against a −30% MoM sample is a clear signal you're on the wrong source.

⚠ **Annual-invoice gotcha.** If the source is invoice-based (one row per billing period), the natural "invoice covers snapshot date" rule — `period_start <= snapshot AND period_end >= snapshot` — silently drops annual customers between renewal events. An annual subscription paid 2025-04-01 with `period_end = 2026-04-01` won't be caught by a 2026-04-30 snapshot, so the customer falsely shows up in the *churn* bucket. Symptoms: implausibly high churn count, NRR / GRR well below 100%, MoM growth deeply negative. Mitigations: (a) prefer a forecasting / active-subscription table if one exists (e.g. `prod_postgres_billing_historicalforecast`), (b) ladder the snapshot date back by ~30 days when an annual renewal hasn't yet been issued, or (c) join against a subscription-state table (`prod_stripe_subscription` filtered to `status = 'active'`) and use the invoice only for MRR amounts. Always pressure-test the headline against an internal source before publishing.

⚠ **HogQL column remapping on warehouse tables.** Some Stripe-sourced columns are auto-remapped in HogQL. The most common: `prod_stripe_subscription.customer` (the Stripe customer ID, a `cus_xxx` string) is exposed as **`customer_id`** in HogQL queries — even though the raw schema returned by `read-data-warehouse-schema` lists it as `customer`. Queries against `customer` will fail with `Unable to resolve field: customer. Did you mean: customer_id?`. If a column name from `info` / schema discovery doesn't resolve, try the `_id` suffix variant before assuming the column is missing. Similar remaps can apply to other reserved-name columns (`user`, `account`, `source`).

**Option B — Group / person property.** A field like `groups.customer.mrr`, `groups.organization.arr`, or `persons.properties.mrr`. Discover candidates with:

```sql
SELECT DISTINCT arrayJoin(JSONExtractKeys(properties)) AS property_key
FROM groups
WHERE index = {index}
LIMIT 1000
SETTINGS max_rows_to_read = 100000
```
(For persons, swap `groups`/`index` for `persons` and drop the `WHERE` clause.) The bare `arrayJoin(JSONExtractKeys(...))` pattern OOMs on any sizeable project because it materializes every property key for every row before deduping. The `SETTINGS max_rows_to_read` cap + the explicit `LIMIT` keep it bounded; if the user has very few groups, raise the limit.

**Option C — External source.** Revenue lives outside PostHog entirely — another connected MCP (Stripe MCP, QuickBooks MCP, HubSpot MCP, a custom internal billing MCP), a CSV / spreadsheet the user can drop into the workspace, or a pasted table. Use this when the user says "the numbers are in Stripe directly", "I have a spreadsheet", "pull it from QuickBooks", or no warehouse / property option fits.

How to handle:
1. Ask the user *which* external source and confirm it's available — list the connected MCPs they have, or ask them to attach the file.
2. Fetch the per-customer MRR list once (one tool call to the external MCP, or one read of the file) into a working table of `(customer_id, customer_name, mrr)`. If the user is at the start of a period comparison, fetch the prior period's snapshot too.
3. The **customer ID must match the PostHog customer key from step 2** — usually a Stripe customer ID, an email, or a domain. If the external source uses a different identifier, ask the user for the mapping field before proceeding (e.g. "Stripe uses `cus_xxx`, but PostHog groups are keyed by org slug — which group property holds the Stripe ID?"). This is the most common failure mode.
4. Hold the fetched table in memory for the run. Every downstream query that needs MRR joins against this table on `customer_id` instead of running a `{mrr_expr}` SQL fragment.
5. The engagement overlay (Query F) still runs in PostHog as written; you join its `customer_id` output against the in-memory MRR table client-side rather than in SQL.

Caveat: Option C means MRR data isn't in PostHog, so you can't save a recurring dashboard that auto-refreshes the headline / movement / concentration sections — only the engagement overlay can. Tell the user this up front if they ask about the dashboard follow-up.

The user must confirm a single MRR expression (Options A/B) **or** point at a specific external source (Option C) — every revenue query depends on it.

**4. Engagement signal — 1–2 valuable events** (required)
Events that represent real product value — not pageviews, not autocapture. These power the *engaged vs quiet revenue* overlay.

If the user isn't sure, suggest candidates from current activity:
```sql
SELECT event, count() AS cnt, uniq({customer_key}) AS distinct_customers
FROM events
WHERE timestamp >= now() - interval 30 day
  AND event NOT IN ('$pageview', '$pageleave', '$autocapture', '$identify', '$set', 'survey sent', '$feature_flag_called')
GROUP BY event
HAVING distinct_customers >= 5
ORDER BY cnt DESC
LIMIT 30
```
Ask: "Which 1–2 of these best represent a paying customer actually getting value? I'll use these to split engaged vs quiet revenue."

**5. Optional — segment field for NRR slicing**
If the user wants NRR / GRR sliced by plan, segment, or region, ask which property holds that (e.g. `groups.customer.plan`, `groups.customer.segment`). Skip if not provided.

---

## Run the analysis

Run each query separately using `execute-sql`. In the snippets below, substitute:
- `{customer_key}` → `groups.customer.id` (or whatever you confirmed in step 2) or `person_id`
- `{mrr_expr}` → the MRR expression confirmed in step 3 (e.g. `toFloat64OrNull(toString(group_properties.mrr))` or a Stripe-warehouse join result). **Option C (external source):** instead of substituting an expression, replace the `customer_mrr` CTE in each query with the in-memory table fetched in step 3, and do the customer-level join client-side after the engagement query returns.
- `{event_1}`, `{event_2}` → the valuable events from step 4
- `{period_start}`, `{period_end}` → start and end of the *current* period (the closed month or quarter)
- `{prior_start}`, `{prior_end}` → the prior period

For a "last completed month" run on 2026-05-13, current = April 2026, prior = March 2026.

⚠ **Production-data access policy.** Many PostHog projects gate the billing / invoice / Stripe data warehouse tables behind a "production read" policy that blocks queries returning per-customer revenue (customer names + MRR rows). Aggregate queries (totals, bucket sums, percentile shares) typically pass; named per-customer lists (top-10 by MRR, named quiet-revenue list) typically get denied with a message like "Production Read requiring explicit user authorization."

**Default to aggregate-only.** Queries A, B, C, D, and the bucket totals in F are aggregate and should run unprompted. For Query E (concentration) and the named quiet-revenue list in Query F's output, return aggregate share-of-MRR percentiles (top-1 / top-5 / top-10 / top-20) first; only attempt the named per-customer list if the user explicitly authorizes it. If a denial fires mid-run, do not retry — surface the boundary in *Signals worth noting* and tell the user how to grant access (typically a settings change on the warehouse source) if they want the named detail.

### Query A — Revenue snapshot (current period)

```sql
WITH customer_mrr AS (
  SELECT
    key AS customer_id,
    {mrr_expr} AS mrr
  FROM groups
  WHERE group_type_index = {group_type_index}
    AND {mrr_expr} > 0
)
SELECT
  sum(mrr)        AS total_mrr,
  sum(mrr) * 12   AS total_arr,
  count()         AS paying_customers,
  avg(mrr)        AS arpa
FROM customer_mrr
```

For person-level analyses, swap `groups`/`group_properties` for `persons`/`properties` and remove the `group_type_index` filter. For data-warehouse-backed revenue, replace the CTE with a query against `stripe.subscriptions` filtered to `status = 'active'` at the period end.

### Query B — MRR movement decomposition

The core of every board deck. For each customer, classify their period-over-period MRR change.

```sql
WITH
  current_mrr AS (
    SELECT customer_id, mrr AS mrr_current
    FROM /* same source as Query A, snapshotted at {period_end} */
  ),
  prior_mrr AS (
    SELECT customer_id, mrr AS mrr_prior
    FROM /* same source as Query A, snapshotted at {prior_end} */
  ),
  joined AS (
    SELECT
      coalesce(c.customer_id, p.customer_id) AS customer_id,
      coalesce(p.mrr_prior, 0)   AS mrr_prior,
      coalesce(c.mrr_current, 0) AS mrr_current
    FROM current_mrr c
    FULL OUTER JOIN prior_mrr p USING (customer_id)
  )
SELECT
  multiIf(
    mrr_prior = 0 AND mrr_current > 0, 'new',
    mrr_prior > 0 AND mrr_current = 0, 'churn',
    mrr_current > mrr_prior,           'expansion',
    mrr_current < mrr_prior,           'contraction',
                                       'existing'
  ) AS movement,
  count() AS customer_count,
  sum(mrr_current - mrr_prior) AS net_change,
  sum(mrr_current) AS mrr_end,
  sum(mrr_prior)   AS mrr_start
FROM joined
GROUP BY movement
ORDER BY movement
```

Important: if the revenue source is a group property, you can only get a *current* snapshot — there's no historical record. To get a true `mrr_prior`, the user needs either (a) a data-warehouse-backed source with historical subscription data, or (b) a previously-saved snapshot. If neither exists, tell the user up front: the MRR-movement section will use the current month's customer set only and tag the output with `⚠ prior-period MRR not available — movement reflects current snapshot only`. The retention math (Query C) will be similarly capped.

### Query C — Retention (NRR / GRR)

Computed from Query B's output. As formulas, not SQL:

- `nrr = (mrr_start + expansion_$ − contraction_$ − churn_$) / mrr_start`
- `grr = (mrr_start − contraction_$ − churn_$) / mrr_start`

Where:
- `mrr_start` = sum of `mrr_prior` for customers that existed at the start of the prior period (i.e. excludes `new`)
- `expansion_$` = `net_change` for the `expansion` bucket
- `contraction_$` = `−net_change` for the `contraction` bucket (positive number)
- `churn_$` = sum of `mrr_prior` for the `churn` bucket

If a trailing-12-month series is feasible (data-warehouse-backed only), run Query B once per month for the last 12 months and produce a sparkline-style trend.

### Query D — Logo churn

```sql
WITH
  start_customers AS (
    SELECT DISTINCT customer_id
    FROM /* current_mrr source, snapshotted at {prior_end} */
    WHERE mrr_prior > 0
  ),
  end_customers AS (
    SELECT DISTINCT customer_id
    FROM /* current_mrr source, snapshotted at {period_end} */
    WHERE mrr_current > 0
  )
SELECT
  (SELECT count() FROM start_customers) AS start_count,
  (SELECT count() FROM start_customers WHERE customer_id NOT IN (SELECT customer_id FROM end_customers)) AS churned_count
```

`logo_churn_pct = churned_count / start_count`.

### Query E — Revenue concentration

**Step 1 (run unprompted) — aggregate share-of-MRR only, no names:**

```sql
WITH customer_mrr AS (
  /* same as Query A */
),
ranked AS (
  SELECT mrr, row_number() OVER (ORDER BY mrr DESC) AS rnk
  FROM customer_mrr
),
totals AS (
  SELECT sum(mrr) AS total_mrr FROM customer_mrr
)
SELECT
  sumIf(mrr, rnk = 1)  / (SELECT total_mrr FROM totals) AS top1_pct,
  sumIf(mrr, rnk <= 5) / (SELECT total_mrr FROM totals) AS top5_pct,
  sumIf(mrr, rnk <= 10) / (SELECT total_mrr FROM totals) AS top10_pct,
  sumIf(mrr, rnk <= 20) / (SELECT total_mrr FROM totals) AS top20_pct,
  sumIf(mrr, rnk <= 50) / (SELECT total_mrr FROM totals) AS top50_pct
FROM ranked
```

Flag `⚠ concentration risk` if `top10_pct > 40%`, and `⚠ single-customer risk` if `top1_pct > 15%`.

**Step 2 (only if the user explicitly authorizes named per-customer detail):**

```sql
WITH customer_mrr AS (
  /* same as Query A, but also select customer_name from the join */
)
SELECT customer_name, mrr,
       mrr / (SELECT sum(mrr) FROM customer_mrr) AS pct_of_mrr
FROM customer_mrr
ORDER BY mrr DESC
LIMIT 10
```

If the named query is denied by a production-read policy, do not retry — note in *Signals worth noting* that the user needs to authorize the warehouse source to surface named customers.

### Query F — Engagement overlay (the PostHog-only section)

For each paying customer, count valuable events in the current period. Anything > 0 = engaged; 0 = quiet.

**Step 1 (run unprompted) — aggregate bucket totals only:**

```sql
WITH
  customer_mrr AS (
    /* same as Query A, snapshotted at {period_end} */
  ),
  engagement AS (
    SELECT
      {customer_key} AS customer_id,
      count() AS valuable_events
    FROM events
    WHERE timestamp >= {period_start}
      AND timestamp <  {period_end}
      AND event IN ('{event_1}', '{event_2}')
      AND {customer_key} != ''
    GROUP BY customer_id
  ),
  joined AS (
    SELECT
      m.mrr,
      if(coalesce(e.valuable_events, 0) > 0, 'engaged', 'quiet') AS bucket
    FROM customer_mrr m
    LEFT JOIN engagement e ON m.customer_id = e.customer_id
  )
SELECT bucket, count() AS customer_count, sum(mrr) AS bucket_mrr
FROM joined
GROUP BY bucket
ORDER BY bucket
```

For group-level analyses on the events side, `{customer_key}` is typically `properties.$group_0` (or `$group_1`/`$group_2`/… depending on which group index the customer unit maps to) — *not* the same expression used on the `groups` table. Confirm the right `$group_N` index for the chosen group type.

This produces `engaged_count`, `quiet_count`, `engaged_$`, `quiet_$`. Compute `quiet_pct_of_mrr` client-side.

**Step 2 (only if the user explicitly authorizes named detail):** select the top 10 quiet customers by MRR with names, mirroring Query E step 2. If denied by a production-read policy, do not retry — flag in *Signals worth noting*.

---

## Compute the metrics & assemble the pack

Most of the assembly is straight arithmetic over the six query results:

- **MoM growth %** = `(total_mrr_current − total_mrr_prior) / total_mrr_prior` (from Query A run twice).
- **Net new MRR** = sum of `net_change` across all buckets in Query B.
- **NRR / GRR**: as defined in Query C.
- **Logo churn %**: as defined in Query D.
- **Top-10 concentration %**: `sum(pct_of_mrr)` across Query E rows.
- **Quiet revenue %**: `quiet_$ / total_mrr` from Query F.

If the data-warehouse-backed history isn't available, mark the MRR-movement and retention sections with `⚠ snapshot-only — historical comparison limited` and skip the 12-month trend.

---

## Output format

Render a single Markdown block the user can paste straight into a board pre-read.

```
**Board metrics — {Period} (vs {Prior period})**

**Headline**
| Metric | Value | MoM |
|--------|-------|-----|
| MRR | ${mrr_current:,} | {mom_growth_pct}% |
| ARR | ${arr_current:,} |  |
| Paying customers | {customer_count} | {customer_mom}% |
| ARPA | ${arpa:,} | {arpa_mom}% |

**MRR movement**
| Bucket | Customers | $ change |
|--------|-----------|----------|
| New | {n_new} | +${exp_new:,} |
| Expansion | {n_exp} | +${exp_exp:,} |
| Contraction | {n_con} | −${exp_con:,} |
| Churn | {n_churn} | −${exp_churn:,} |
| **Net new MRR** |  | **${net_new:+,}** |

**Retention**
- Net Revenue Retention (NRR): **{nrr_pct}%**
- Gross Revenue Retention (GRR): **{grr_pct}%**
- Logo churn: **{logo_churn_pct}%** ({churned_count} of {start_count})

**Concentration — top 10 customers**
| Rank | Customer | MRR | % of total |
|------|----------|-----|------------|
| 1 | {name} | ${mrr:,} | {pct}% |
| ... |
| **Top 10 cumulative** |  |  | **{top10_pct}%** |

**Engagement overlay (PostHog)**
- Engaged: {engaged_count} customers, ${engaged_$:,} ({engaged_pct}% of MRR)
- **Quiet: {quiet_count} customers, ${quiet_$:,} ({quiet_pct}% of MRR)** ← paying but no `{event_1}` / `{event_2}` this period

Top 10 quiet-revenue customers:
| Customer | MRR |
|----------|-----|
| {name} | ${mrr:,} |
| ... |

**Signals worth noting**
• {n_summary} headline observations — e.g. "NRR fell from 112% → 104%, driven mostly by contraction in Enterprise"
• Concentration: top customer is {top1_pct}% of MRR {⚠ if >15%}
• Quiet revenue: ${quiet_$:,} of MRR has no product usage this period — flag for CS review
• {anything from segment slice if step 5 was provided}
```

Cap the concentration and quiet-revenue tables at 10 rows each. If the engagement overlay was skipped (no valuable events confirmed), omit that section and note it explicitly in *Signals worth noting*. If historical revenue isn't available, omit MRR movement and retention rather than show misleading numbers.

---

## Interpreting the results

- **NRR > 110%** — best-in-class SaaS. Expansion is outpacing churn; the existing book of business is compounding.
- **NRR 100–110%** — healthy. The base is growing without new logos.
- **NRR 90–100%** — warning sign. Expansion isn't covering losses; growth has to come entirely from new logos.
- **NRR < 90%** — leaky bucket. Investigate contraction and churn drivers before adding more sales spend.
- **GRR < 85%** — product-fit or contract-structure issue. GRR ignores expansion, so it's the cleanest read on whether customers are *staying*.
- **Top-10 concentration > 40%** — board-level risk. Losing one of these customers materially changes the year. Flag.
- **Single customer > 15% of MRR** — even bigger risk; should be a named item in the board memo.
- **Quiet revenue > 20% of MRR** — meaningful pre-churn exposure. The customers are still paying but have stopped using the product; renewal conversations are coming and the team isn't ready for them. This is the section finance should hand to CS *first* every month.
- **Quiet revenue rising MoM** — leading indicator that next quarter's churn will be worse than this quarter's. Don't wait for the contraction bucket to confirm it.

---

## Optional follow-ups

Offer these after the report is rendered:

- **Save a "quiet revenue" cohort** — top quiet-revenue customers by MRR, handed off to CS. For person-level analyses this is a real PostHog cohort via `cohorts-create`; for group-level, hand the user the list of customer IDs to load into their CS tool.
- **Build a recurring board dashboard** (`dashboard-create` + `insight-create`):
  - MRR + ARR over time
  - Net new MRR per month (stacked: new / expansion / contraction / churn)
  - NRR and GRR trend (trailing 12 months)
  - Logo churn per month
  - Quiet revenue $ + % of MRR per month
- **Email subscription** — wire the dashboard to a monthly email digest for the finance team via PostHog Subscriptions, so the pack lands in inboxes on the first business day of every month.

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

3. If a rating was captured, fire a `work_skill_rated` event on PostHog project 2 by running this curl via the Bash tool (fill in `<rating>`, `<feedback>`, `<mode>`, `<artifacts>`, `<input_summary>`):

   ```bash
   curl -s -X POST https://us.i.posthog.com/i/v0/e/ \
     -H 'Content-Type: application/json' \
     -d '{
       "api_key": "sTMFPsFhdP1Ssg",
       "event": "work_skill_rated",
       "distinct_id": "<operator-email-or-work-skills-anonymous>",
       "properties": {
         "skill_name": "board-metrics-pack",
         "rating": <rating>,
         "rating_scale": "1-4",
         "feedback": "<feedback>",
         "mode": <mode>,
         "artifacts_created": <artifacts>,
         "input_summary": "<input_summary>"
       }
     }'
   ```

   - `distinct_id`: the operator email from the active-environment system reminder if available; otherwise `"work-skills-anonymous"`.
   - `mode`: which optional sub-steps ran. Use one of: `"core"` (report only), `"cohort_created"` (quiet-revenue cohort saved), `"dashboard_created"` (recurring board dashboard built), `"subscription_set_up"` (monthly email digest wired). If multiple ran, pass the most material one (artifact-creating modes beat `"core"`; prefer `"dashboard_created"` over `"cohort_created"` over `"subscription_set_up"`). Use `null` only if you genuinely can't classify.
   - `artifacts_created`: array of `"<type>:<id>"` strings for any PostHog entities created during this run (e.g. `["cohort:1234","dashboard:567","insight:89","subscription:12"]`). Use `[]` if none.
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"April 2026 monthly board pack, Postgres billing source"`).
4. Confirm to the user with one short line, e.g. *"Thanks — logged your 3/4 rating."*

If the curl call returns a non-2xx response, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "Put together the metrics for the board meeting"
- "Give me a monthly board pack"
- "What's our MRR and NRR right now?"
- "Build the investor update numbers"
- "Show me MRR movement for last month"
- "How much revenue is at risk from quiet customers?"
- "What's our revenue concentration?"
- "How much of our MRR isn't actually using the product?"
- "Generate the finance numbers"
- "Net revenue retention and gross revenue retention for last quarter"