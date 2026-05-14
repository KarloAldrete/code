---
name: customer-review
description: "Pull a deep single-customer brief from PostHog combining identity, top events, support/sales interactions, revenue (MRR / ARR / projection), recent session summaries, and ICP fit. Trigger when the user asks to review, deep-dive, brief, snapshot, or pull a 360 on a specific customer, account, company, or paying user — phrases like 'review Acme Corp', 'tell me everything about customer X', 'pull a customer brief', 'account snapshot for Y', 'before my call with Z', 'how is customer X doing', 'health check on org Y', 'is account X happy', '360 on customer X', 'customer review: X', 'walk me through customer Y'."
---

# Customer review

## What this skill does

Builds a paste-ready, single-customer brief from PostHog data — the kind a CS, account, or product lead would otherwise stitch together by hand the morning of a renewal call or QBR.

Each run covers one customer (most often a B2B company tracked as a `group`, sometimes an individual paying user tracked as a `person`) and outputs:

1. **Identity & plan** — who they are, their plan, signup date, owner, active-user count
2. **Engagement** — most-triggered events (excluding pageview / autocapture noise), with the user able to flag the ones they actually care about
3. **Support & sales interactions** — PostHog surveys / feedback events plus anything pulled from a connected CRM or support MCP (HubSpot, Intercom, Zendesk, etc.)
4. **Revenue** — current MRR / ARR, a 6-month trend, and a 12-month projection when historical data is available
5. **Recent sessions (10, ranked)** — the most *interesting* of their recent recordings, prioritising sessions with errors or unusual activity
6. **ICP fit** — a per-criterion checklist scoring how close the customer matches the ICP the user describes

The brief is sized to drop into a memo, Notion page, or pre-read with no further editing.

---

## Before you start

Make sure the PostHog MCP is connected. If it isn't, tell the user:
> "You'll need the PostHog MCP connected to use this skill. Run `npx @posthog/wizard mcp add` to set it up, then restart Claude Code."

No API keys or project IDs are needed — the MCP handles authentication.

If the user mentions an external CRM or support tool (HubSpot, Salesforce, Intercom, Zendesk, Front, Linear) the corresponding MCP must also be connected for that section to populate. Auto-detect which of those are present at runtime and pre-fill the prompt in `Gather context`.

---

## Gather context

Ask the questions below **one at a time, in order**. After each question, wait for the user's reply (an answer, "skip", or "use the default") before moving to the next. Do not batch them into a single combined prompt — the setup should feel conversational, not like a form.

Rules:
- Each question is its own short message. Keep it to 1–3 lines of prose plus any clarifying examples.
- If the user gives a multi-part answer that resolves more than one question, accept it and skip ahead — never re-ask something they've already answered.
- If a question is marked *optional* and the user says "skip" (or equivalent), record it as skipped and move on without pushing back.
- If a question is *required* and the user tries to skip it (e.g. ICP description), explain briefly why it's needed and offer a minimal version (e.g. "even one line is enough — what kind of customer is your sweet spot?"). If they still decline, drop the dependent section from the final brief and continue.
- Do not start running queries until every question has been answered or explicitly skipped.

**Question 1 — Customer identifier** (required)
Who do they want to review? Accept any of:
- Company name (e.g. "Acme Corp")
- Domain (e.g. "acme.com")
- Email address (for person-level)
- Stripe customer ID (`cus_xxx`)
- PostHog group key or person ID

Resolve the identifier to a PostHog key before proceeding. Try in order:

```sql
-- Group match by name / domain (run for each defined group_type_index in turn)
SELECT key, group_properties.name AS name, group_type_index
FROM groups
WHERE (group_properties.name ILIKE '%{input}%' OR group_properties.domain ILIKE '%{input}%' OR key ILIKE '%{input}%')
LIMIT 10
```

```sql
-- Person match by email
SELECT id, argMax(properties.email, version) AS email
FROM persons
WHERE properties.email ILIKE '%{input}%'
GROUP BY id
LIMIT 10
```

If a single candidate comes back, confirm it with the user in one short line ("Looks like you mean *Acme Corp* (`acme_corp_id`) — right?"). If multiple, list the top 5 with key fields (name, domain, plan, MRR if known, signup date) and ask the user to pick. If zero, ask the user to confirm spelling or provide the explicit key.

**Question 2 — Customer unit** (often inferable from question 1 — if so, just confirm in one line and don't pose this as a separate ask)
Is this customer being analyzed as a **group** (B2B account) or as an identified **person** (B2C user)? If unclear, check what group types exist:

```sql
SELECT group_type_index, count() AS group_count
FROM groups
GROUP BY group_type_index
ORDER BY group_count DESC
```

Map the indexes back to the project's defined group types and confirm with the user. From here on, every query uses either `groups.{group_type}.id` (events side) or `person_id` as the customer key — pick once and use it everywhere.

**Question 3 — Time window** (default: last 90 days for events, last 12 months for revenue history)
Confirm even briefly:
> "I'll use the last 90 days for events and sessions, and the last 12 months for revenue history. Want a different window? Common alternatives: 30d for fast-moving products, 180d for low-frequency B2B."

Do not silently default — always confirm.

**Question 4 — Revenue source** (skippable — if the user says skip, drop the revenue section from the brief)
Where does MRR live? Three common shapes (same as the `board-metrics-pack` skill):

**Option A — Data warehouse (preferred when available).** A Stripe (or equivalent billing) connection in PostHog's data warehouse. Typical tables: `stripe.subscriptions`, `stripe.invoices`, `stripe.customers`, or an internal billing mirror (e.g. `prod_postgres_billing_invoice` with per-customer `mrr` and `period_start`/`period_end`). Confirm the table and MRR column.

⚠ **HogQL column remapping on warehouse tables.** `prod_stripe_subscription.customer` (the Stripe customer ID, a `cus_xxx` string) is exposed as **`customer_id`** in HogQL queries — even though the raw schema returned by `read-data-warehouse-schema` lists it as `customer`. Queries against `customer` will fail with `Unable to resolve field: customer. Did you mean: customer_id?`. If a column name from `info` / schema discovery doesn't resolve, try the `_id` suffix variant.

⚠ **Annual-invoice gotcha.** If the source is invoice-based, the natural "invoice covers snapshot date" rule (`period_start <= snapshot AND period_end >= snapshot`) silently drops annual customers between renewal events. If the customer pays annually, prefer a subscription-state table (`prod_stripe_subscription` filtered to `status = 'active'`) over an invoice table, or ladder the snapshot date back.

**Option B — Group / person property.** A field like `groups.customer.mrr`, `groups.organization.arr`, or `persons.properties.mrr`. Discover candidates with:

```sql
SELECT DISTINCT arrayJoin(JSONExtractKeys(properties)) AS property_key
FROM groups
WHERE index = {index}
LIMIT 1000
SETTINGS max_rows_to_read = 100000
```

Option B gives a current snapshot only — there's no historical record, so the **projection in section 4 will be skipped** with an explicit note.

**Option C — External source.** Revenue lives outside PostHog: another connected MCP (Stripe MCP, QuickBooks MCP, an internal billing MCP), a CSV / spreadsheet, or a pasted table. Ask which source, fetch the customer's MRR (and ideally last 6 monthly snapshots) once, and hold it in memory for the run. The customer ID in the external source **must match the PostHog customer key from step 1** — usually a Stripe customer ID, an email, or a domain.

The user must confirm a single MRR expression (Options A/B) **or** point at a specific external source (Option C) before continuing. If they have no revenue source at all, skip the revenue section with a note and continue.

**Question 5 — Support / sales sources** (optional — skip is fine)
PostHog will always be checked: surveys (`survey-list`), `survey sent` events, and feedback-shaped custom events (e.g. `feedback submitted`, `nps responded`, `intercom_message_received`).

Ask the user about external sources, pre-filling with the MCPs you've detected as connected:

> "I'll always pull PostHog surveys and feedback events for this customer. For deeper CRM / support history I can also use: {auto-detected MCPs e.g. HubSpot, Intercom, Zendesk}. Want me to pull from any of those, or attach a CSV / notes file? If you skip this, I'll mark the section *no external CRM connected* and continue."

Accept any subset, or "skip". Cache the user's answer.

**Question 6 — ICP description** (required for the ICP section — if the user truly can't describe it, skip the ICP section entirely)

Before asking, check whether the user has a saved ICP at `~/.posthog-work-skills/icp.md`:

- **If the file exists**, read it. Show the user the `summary` field from the YAML frontmatter in one short message and ask in one short line: *"I'll use your saved ICP for this brief. Override for this run?"* Accept one of:
  - *Use saved* (default) — use the saved ICP description as-is.
  - *Override with new description* — accept a new free-text description for this run only. Do **not** rewrite the saved file (point them at `/define-icp` if they want to update it permanently).
  - *Skip ICP section* — drop the ICP section from the final brief.
- **If the file does not exist**, ask the user to describe their ideal customer in plain language, and surface a one-line pointer: *"Tip: run `/define-icp` first to save your ICP once and reuse it across skills."*

Examples of a good plain-language description:
- "B2B SaaS, 10–200 employees, engineering or product teams"
- "Solo founders building consumer apps"
- "Enterprise retail using Salesforce"

Once you have the ICP description (saved, override, or fresh), discover what properties exist on the customer's record using:

```sql
-- Groups
SELECT DISTINCT arrayJoin(JSONExtractKeys(group_properties)) AS property_key
FROM groups
WHERE group_type_index = {group_type_index}
LIMIT 100
```

```sql
-- Persons
SELECT DISTINCT arrayJoin(JSONExtractKeys(properties)) AS property_key
FROM persons
LIMIT 100
```

Map each ICP criterion ("10–200 employees", "eng/product team", "B2B SaaS industry") to a concrete property on the customer record (`group_properties.employee_count`, `group_properties.team_function`, `group_properties.industry`). Confirm the mapping with the user before scoring — guesses here lead to wrong matches. If a criterion has no obvious property, mark it as `? unknown` rather than dropping it.

---

## Run the analysis

Run each section in order using `execute-sql` and the relevant MCP tools. In the snippets below, substitute:
- `{customer_key}` → `groups.{group_type}.id` (or whatever you confirmed in step 2) or `person_id`
- `{customer_id}` → the resolved key from step 1 (e.g. `'acme_corp'` or a Stripe `cus_xxx`)
- `{window}` → window length in days, confirmed in step 3 (default `90`)
- `{revenue_window}` → revenue history window in days (default `365`)
- `{mrr_expr}` → MRR expression from step 4 (Option A or B), or an in-memory join (Option C)

### Section 1 — Identity & metadata

For groups:
```sql
SELECT
  key AS customer_id,
  group_properties.name      AS customer_name,
  group_properties.plan      AS plan,
  group_properties.domain    AS domain,
  group_properties.country   AS country,
  group_properties.owner     AS owner,
  group_properties.created_at AS signup_date
FROM groups
WHERE group_type_index = {group_type_index}
  AND key = '{customer_id}'
```

For persons, swap `groups` / `group_properties` for `persons` / `properties` and use `id = '{customer_id}'`.

Adjust property names to match what's actually present on the record — discover them with the same `arrayJoin(JSONExtractKeys(...))` query from step 6 if you're unsure.

Then count distinct active users in the window (group-level only — for person-level customers this is always 1):

```sql
SELECT uniq(person_id) AS active_users
FROM events
WHERE timestamp >= now() - interval {window} day
  AND {customer_key} = '{customer_id}'
```

### Section 2 — Most-triggered events

Top 20 events for this customer over the window, excluding the standard noise list:

```sql
SELECT
  event,
  count()           AS cnt,
  uniq(person_id)   AS distinct_users,
  max(timestamp)    AS last_seen
FROM events
WHERE timestamp >= now() - interval {window} day
  AND {customer_key} = '{customer_id}'
  AND event NOT IN ('$pageview', '$pageleave', '$autocapture', '$identify', '$set', '$feature_flag_called', 'survey sent')
GROUP BY event
ORDER BY cnt DESC
LIMIT 20
```

Present the results and ask in one short line:
> "Which of these matter most to you? Flag 1–3 and I'll mark them in the brief and pull a per-week trend on each."

For each flagged event, pull a per-week count over the window:

```sql
SELECT toStartOfWeek(timestamp) AS week, count() AS cnt
FROM events
WHERE timestamp >= now() - interval {window} day
  AND {customer_key} = '{customer_id}'
  AND event = '{flagged_event}'
GROUP BY week
ORDER BY week
```

Use the per-week numbers to write a one-line trend caption per flagged event (e.g. "*exported report*: 240 → 180 → 110 over the last 3 weeks — declining"). If the user skips, omit the trend lines.

### Section 3 — Support & sales interactions

**PostHog side** (always):

```sql
-- Survey responses for this customer's persons
SELECT
  timestamp,
  properties.$survey_id    AS survey_id,
  properties.$survey_name  AS survey_name,
  properties.$survey_response AS response
FROM events
WHERE event = 'survey sent'
  AND timestamp >= now() - interval {window} day
  AND person_id IN (
    SELECT DISTINCT person_id FROM events
    WHERE {customer_key} = '{customer_id}'
      AND timestamp >= now() - interval {window} day
  )
ORDER BY timestamp DESC
LIMIT 50
```

Also scan for feedback-shaped custom events:

```sql
SELECT event, count() AS cnt, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - interval {window} day
  AND {customer_key} = '{customer_id}'
  AND (event ILIKE '%feedback%' OR event ILIKE '%support%' OR event ILIKE '%nps%' OR event ILIKE '%ticket%' OR event ILIKE '%chat%')
GROUP BY event
ORDER BY cnt DESC
LIMIT 20
```

Summarize: number of survey responses, latest response (truncated to ~100 chars), counts of feedback-shaped events.

**External side** (only if the user named a source in step 5):

- **HubSpot / Salesforce MCP**: search contacts by domain or company → list opportunities and engagements in the window → summarize counts and most recent activity. Pull deal stage, ACV, and last touch.
- **Intercom / Zendesk / Front MCP**: search conversations by email or domain in the window → count tickets, list the most recent 5 with subject and resolution status.
- **Linear MCP**: search issues by customer name in the window → count and list any with `customer` / `bug-report` labels.
- **File**: read the path the user attached and filter to rows matching the customer's name / domain / email.

If a tool call fails, surface the boundary in *Signals worth noting* and continue. Do not retry blindly.

If no external source was chosen and PostHog returned no survey or feedback rows, note the section as *No external CRM connected — PostHog only, no feedback recorded in the window* and continue.

### Section 4 — Revenue (MRR / ARR / projection)

**Current snapshot.**

For Option A (warehouse) — adjust table and column to what was confirmed:

```sql
SELECT sum(mrr) AS mrr
FROM prod_postgres_billing_invoice
WHERE customer_id = '{customer_stripe_id}'
  AND toDate(period_start) <= today()
  AND toDate(period_end)   >= today()
  AND mrr > 0
```

Or from `prod_stripe_subscription`:
```sql
SELECT sum(toFloat64OrNull(toString(plan.amount)) / 100.0 /
           if(plan.interval = 'year', 12, 1) *
           if(plan.interval = 'month', 1, 1)) AS mrr
FROM prod_stripe_subscription
WHERE customer_id = '{customer_stripe_id}'
  AND status = 'active'
  AND livemode = true
```

For Option B (group/person property):
```sql
SELECT {mrr_expr} AS mrr
FROM groups
WHERE group_type_index = {group_type_index}
  AND key = '{customer_id}'
```

For Option C, read from the in-memory table fetched in Gather context step 4.

`arr = mrr * 12`.

**6-month MRR history** (Option A only — required for the projection):

```sql
SELECT toStartOfMonth(period_start) AS month, sum(mrr) AS mrr
FROM prod_postgres_billing_invoice
WHERE customer_id = '{customer_stripe_id}'
  AND toDate(period_start) >= today() - interval 180 day
  AND mrr > 0
GROUP BY month
ORDER BY month
```

If there are fewer than 3 monthly data points, skip the projection.

**12-month projection** (compound growth based on recent trend):
1. From the 6 monthly snapshots, compute month-over-month growth ratios.
2. Take the **mean of the last 3 ratios** (smoother than a single month, more responsive than 6).
3. **Clamp to ±20%/month** so a single outlier doesn't blow up the forecast.
4. Project the current MRR forward 12 months at that compounding rate: `mrr_n+1 = mrr_n × (1 + clamped_rate)`.
5. Render as a small table (months 1–12 with projected MRR) plus a single caption line:
   > "Projected ARR in 12 months: ${projected_arr} ({+/-N%} vs current ARR of ${current_arr}). Based on a {clamped_rate*100}%/mo trend from the last 3 months."

If only a snapshot is available (Option B) or external (Option C without history), skip the projection and write:
> *Projection unavailable — only a single MRR snapshot is queryable. Connect billing history via the data warehouse for a trend-based forecast.*

### Section 5 — Recent sessions (10, ranked by interestingness)

1. Fetch ~30 most recent sessions for the customer's persons. Prefer `query-session-recordings-list` filtered to the customer's `person_id`s; fall back to `execute-sql` against the `sessions` table:

   ```sql
   SELECT
     session_id,
     min(timestamp) AS start_time,
     max(timestamp) AS end_time,
     dateDiff('second', min(timestamp), max(timestamp)) AS duration_seconds,
     countIf(event = '$exception')        AS exception_count,
     countIf(event = '$autocapture' AND properties.$event_type = 'click') AS click_count,
     countIf(event NOT IN ('$pageview', '$pageleave', '$autocapture', '$identify', '$set', '$feature_flag_called', 'survey sent')) AS action_count,
     any(person_id) AS person_id
   FROM events
   WHERE timestamp >= now() - interval {window} day
     AND {customer_key} = '{customer_id}'
     AND session_id != ''
   GROUP BY session_id
   ORDER BY start_time DESC
   LIMIT 30
   ```

2. Score each session:
   ```
   score = 3 × exception_count
         + 2 × console_error_count           (if available from session-recordings-list)
         + 1 × min(duration_seconds / 60, 30)
         + 1 × min(action_count / 5, 10)
   ```
   Take the top 10 by score. Break ties by recency (more recent wins).

3. For each of the top 10, fetch lightweight details (use `session-recording-get` if the session-recordings MCP tool surfaces it; otherwise re-query the events table for the session's top non-noise events). Summarize each session in 1–2 lines:
   - Date · user (email or fallback id) · duration · error count · one-line action summary (e.g. "viewed 3 dashboards, exported one report, hit a 500 on `/api/insights`")

4. After the table, offer:
   > "Want a full walk-through of any one of these? Drop me the session ID and I'll run `/posthog:investigating-replay` on it."

### Section 6 — ICP fit

For each ICP criterion mapped in Gather context step 6:

1. Read the customer's value from the `groups` / `persons` record (or from a connected enrichment source if mapped to one).
2. Classify:
   - ✅ **match** — value falls inside the criterion (e.g. ICP says 10–200 employees, customer is 80)
   - **~ partial** — close but not exact (customer is 250 employees against a 10–200 ICP; or industry adjacent but not identical)
   - ❌ **mismatch** — clearly outside (customer is 5,000 employees against a 10–200 ICP)
   - **? unknown** — property missing, null, or empty
3. Score: `match_count` / `total_criteria`, mapped to a band:
   - `>= 0.8` → **Strong match**
   - `0.5 – 0.79` → **Moderate match**
   - `< 0.5` → **Weak match**
   - All criteria unknown → **Unknown — not enough data**

Call out strong mismatch signals separately (a customer firmly outside ICP that's nonetheless paying / engaged is a product-strategy signal, not a CS one).

---

## Output format

Render a single Markdown brief, paste-ready into a memo or Notion page. Cap any table at 10 rows.

```
**Customer review — {customer_name}** ({customer_id} · {group_type or "person"}) — last {window} days

### Identity & plan
- Plan: {plan} · Signup: {signup_date} · Owner: {owner} · Region: {country}
- Active users (last {window}d): {active_users}    *(group-level only)*
- Primary contact: {email}    *(person-level only or owner email)*

### Engagement
| Event | Count | Distinct users | Last seen | Note |
|-------|-------|----------------|-----------|------|
| exported report | 4,210 | 18 | 2 days ago | ⭐ flagged · 240 → 110 over 3 weeks (declining) |
| ran analysis | 3,140 | 22 | today | — |
| ... | ... | ... | ... | ... |

### Support & sales interactions
- PostHog surveys: 3 responses across 2 surveys — latest: *"Still missing CSV export from the dashboards view"* (4 days ago)
- HubSpot: 2 open opportunities ($48k ACV combined), last touch 6 days ago by {owner}
- Intercom: 5 conversations in the window, 1 unresolved (subject: "Filter broken on Safari")
- *No external CRM connected — PostHog only* *(if applicable)*

### Revenue
- MRR: $4,500 → ARR: $54,000
- 6-month trend: $3,800 → $4,000 → $4,200 → $4,300 → $4,400 → $4,500
- Projected ARR in 12 months: $73,200 (+35% vs today). Based on a ~2.4%/mo trend from the last 3 months.
- *Projection unavailable — single MRR snapshot only* *(if applicable)*

### Recent sessions (top 10 by signal)
1. 2026-05-12 · jane@acme.com · 18m · 3 errors · viewed 4 dashboards, hit 500 on `/api/insights`, retried twice
2. 2026-05-10 · mike@acme.com · 6m · 0 errors · exported 2 reports, configured 1 new pipeline
3. ...

### ICP fit — 4 / 5 criteria · Strong match
| Criterion | Customer value | Match |
|-----------|----------------|-------|
| 10–200 employees | 80 | ✅ |
| B2B SaaS industry | SaaS | ✅ |
| Eng or product team | engineering | ✅ |
| Uses Salesforce | unknown | ? |
| North America | US | ✅ |

**Signals worth noting**
• Valuable event volume is down 50% over the last 3 weeks despite stable seat count — quiet-churn signal worth a CS check-in before renewal.
• 3 sessions with errors in the last week, all pointed at `/api/insights` — likely a real bug affecting this customer specifically.
• Strong ICP fit + steady revenue + open expansion opp → ripe for an expansion conversation if engagement recovers.
• Single survey response flagged a missing feature ("CSV export") that's already on the roadmap — easy win to mention on the call.
```

If a section has no data (e.g. no support sources connected), keep the H3 header and write a short italic note instead of omitting it — the structure should be predictable across runs.

---

## Interpreting the results

- **Strong ICP + steady valuable events + flat or growing revenue** → expansion conversation candidate. Loop in the AE; the renewal is likely safe.
- **Strong ICP + dropping engagement + recent error-heavy sessions** → urgent CS check-in. The product is breaking for them; renewal is at real risk.
- **Weak ICP + high engagement + paying** → product-strategy signal. Either the ICP definition is too narrow, or this customer is happy *despite* being outside your target — interview them.
- **High revenue + low engagement (quiet $)** → renewal risk even if the score looks fine. Pull the engagement section forward in the CS conversation.
- **High engagement + low revenue** → underpriced. Expansion / upsell candidate; check the plan vs usage.
- **Many error-heavy sessions concentrated on one surface** → a real bug actively hitting this customer. File or escalate; do not let CS take the blame for a product issue.
- **Mostly `?` unknown ICP criteria** → enrich the customer record (or rethink the ICP) before drawing conclusions. The brief is not actionable on ICP signal alone here.

---

## Optional follow-ups

Offer these after the brief is rendered:

- **Save a cohort** (`cohorts-create`) — the customer's persons, named e.g. `{customer_name} users — {Month Year}`. Useful for retention curves, survey targeting, or behaviour comparisons.
- **Open in PostHog** — link to `/persons/{id}` (person-level) or `/groups/{group_type_index}/{key}` (group-level).
- **Deep-dive a session** — point the user at `posthog:investigating-replay` with one of the session IDs surfaced in section 5.
- **Set a drop alert** — create an alert (`alert-create-for-insight`) on the customer's valuable-event count so a CS rep is paged if engagement drops sharply between now and renewal.
- **Build a customer dashboard** — a `dashboard-create` containing per-customer trend, revenue, and ICP-fit tiles, scoped to this customer for ongoing tracking.

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
         "skill_name": "customer-review",
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
   - `artifacts_created`: array of `"<type>:<id>"` strings for any PostHog entities created during this run (e.g. cohorts, alerts, dashboards from the optional follow-ups). Use `[]` if none.
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"Customer review for Acme Corp, last 90 days"`).
4. Confirm to the user with one short line, e.g. *"Thanks — logged your 3/4 rating."*

If the curl call returns a non-2xx response, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "Review Acme Corp for me"
- "Pull a customer brief on customer X"
- "Tell me everything about {company}"
- "Account snapshot for {company}"
- "Before my call with {company}, give me a brief"
- "Health check on {company}"
- "360 on customer X"
- "How's {customer email} doing?"
- "Walk me through {company}"
- "Customer review: {company}"
