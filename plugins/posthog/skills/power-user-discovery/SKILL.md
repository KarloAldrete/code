---
name: power-user-discovery
description: "Identify and profile power users from PostHog data. Trigger when the user asks who their most engaged users are, wants to find power users, asks about top users, heavy users, or most active users, wants to build a power user cohort, asks 'who uses the product most', 'who are our best users', 'find users to interview about advanced features', or mentions 'champion users', 'super users', or 'user champions'. Also trigger when the user wants to set up power user tracking or a power user dashboard."
---

# Power user discovery

## What this skill does

Surfaces the most engaged users in PostHog using a composite score across four behavioral dimensions:

1. **Frequency** — how often they log in (distinct active days)
2. **Depth** — how much time they spend in the app (session duration)
3. **Value actions** — how often they complete high-value events
4. **Feature breadth** — how many distinct event types they use (signals broad adoption beyond a single workflow)

The result is a ranked list of power users with a breakdown by dimension, saved as a cohort in PostHog for easy follow-up.

---

## Before you start

Make sure the PostHog MCP is connected. If it isn't, tell the user:
> "You'll need the PostHog MCP connected to use this skill. Run `npx @posthog/wizard mcp add` to set it up, then restart Claude Code."

No API keys or project IDs are needed — the MCP handles authentication.

### Conventions used throughout this skill

- **`{lookback_days}`** — the time window the user confirmed in the next section. Substitute literally into every `interval {lookback_days} day` in the SQL below. Do **not** leave any `interval 30 day` hardcoded.
- **`{noise_events}`** — the standard exclusion list of low-signal PostHog events. Substitute into every query that uses it:
  ```
  '$pageview', '$pageleave', '$autocapture', '$identify', '$set', '$unset',
  'survey sent', 'survey shown', 'survey dismissed',
  '$feature_flag_called', '$exception', '$opt_in', '$snapshot',
  '$performance_event', '$web_vitals', '$groupidentify'
  ```
  These are excluded from both "value event discovery" and "feature breadth" so passive instrumentation doesn't inflate breadth or drown out value events.
- **`{ym}`** — the year-month label in ISO format (`2026-05`), used for cohort and survey names. ISO is unambiguous and sorts naturally.
- **Person identity** — prefer `person.properties.email` over event-level `properties.email`. With person-on-events mode (active in this project), `person.properties.*` reflects the value at the time each event was ingested, not the person's current value. The email shown is therefore the most-recently-seen email per person, not necessarily their current email. Mention this in the final report if relevant.

---

## Gather context

Before running any analysis, collect the following. Ask all of these in a single message so the user isn't interrupted mid-task.

**1. Key value events** (required)
The events that represent high-value actions in the product — not pageviews or clicks, but the things a user does when they're getting real value. Examples: "exported report", "ran analysis", "published campaign", "created pipeline".

If the user isn't sure, help them find candidates using `execute-sql`. The `{active_days_threshold}` defaults to 5 for typical SaaS, but lower it (2–3) for low-frequency products (e.g. weekly-use tools) and raise it (8–10) for daily-use products.
```sql
SELECT event, count() AS cnt
FROM events
WHERE timestamp >= now() - interval {lookback_days} day
  AND event NOT IN ({noise_events})
  AND person_id IN (
    SELECT person_id FROM events
    WHERE timestamp >= now() - interval {lookback_days} day
    GROUP BY person_id HAVING uniq(toStartOfDay(timestamp)) >= {active_days_threshold}
  )
GROUP BY event
ORDER BY cnt DESC
LIMIT 30
```
Present the results and ask: "Which of these represent your most valuable user actions? Pick 1–5."

**2. Score weights & dimension exclusions** (required — confirm even briefly)
The composite score uses four dimensions with these default weights:

| Dimension | Default weight |
|---|---|
| Value actions | 35% |
| Frequency (active days) | 25% |
| Time in app | 25% |
| Feature breadth | 15% |

Ask the user:
> "I'll score users across value actions, frequency, time in app, and feature breadth with weights of 35 / 25 / 25 / 15. Would you like to adjust the weights or exclude any dimension? Defaults work for most products."

Guidance to offer if they're unsure:
- **Low-frequency products** (used once a week by design): bump value actions and feature breadth, reduce frequency.
- **High-frequency, shallow apps** (e.g. utilities): bump feature breadth, reduce time in app.
- **Collaboration-heavy / team-seat products**: the user may want to manually add a virality dimension (invites sent, mentions, shares) — ask for the relevant event if so.

If a dimension is excluded, redistribute its weight proportionally across the remaining dimensions so weights still sum to 100. Worked example: dropping breadth (15%) from the default split leaves 85% to distribute. Multiply each remaining weight by `100/85`: value 35→41.2, frequency 25→29.4, time 25→29.4. Confirm the final weights back to the user before running.

**3. Time window** (required — ask if not specified)
If the user hasn't mentioned a time period, ask before proceeding:
> "What time window should I use? For example: last 30 days, last 60 days, or a specific date range. I'll default to 30 days if you're not sure."

Common options:
- **30 days** — default, good for most products with regular usage
- **60–90 days** — better for newer products with less data, or lower-frequency use cases
- **Custom range** — use `timestamp BETWEEN '{start_date}' AND '{end_date}'` in queries

Do not silently default — always confirm the window with the user, even briefly ("Running the analysis over the last 30 days — let me know if you'd like a different period"). Users often have a specific sprint, quarter, or cohort window in mind. Once confirmed, this is `{lookback_days}` everywhere below.

**4. B2B account-level analysis** (optional)
If the project tracks groups (organizations, customers, workspaces), the "power user" is often actually a power *account*. Ask:
> "Are you a B2B product where multiple users share an account? If so, I can also rank by `customer` / `organization` — the most engaged accounts, not just individual users."

If yes, note which `$group_*` index maps to the desired group type (the system reminder lists defined group types for the project) and run the optional account-level pass at the end (see "Group-level analysis" below).

**5. Bot filter** (B2C products only)
The default queries identify users by email, which excludes most anonymous visitors. If the product is B2C and many real users don't have emails, drop the `email IS NOT NULL` filter and lean on the `$bot` property instead:
```
AND (properties.$bot IS NULL OR properties.$bot = false)
```
Mention this trade-off explicitly to the user before running.

---

## Run the analysis

Run each dimension as a separate query, then combine them into a composite score. The four per-dimension queries are **exploratory sanity checks** — the composite query at the end is the authoritative ranking. Use `execute-sql` for all of these.

### Dimension 1 — Login frequency (distinct active days)

```sql
SELECT
  person_id,
  argMax(person.properties.email, timestamp) AS email,
  argMax(person.properties.name, timestamp) AS name,
  uniq(toStartOfDay(timestamp)) AS active_days,
  uniq($session_id) AS session_count
FROM events
WHERE timestamp >= now() - interval {lookback_days} day
GROUP BY person_id
ORDER BY active_days DESC
LIMIT 50
```

### Dimension 2 — Time in app (sum of session durations)

Use the `sessions` table directly — PostHog already computes `$session_duration`, which is more accurate than recomputing from event timestamps and handles single-event sessions correctly.

```sql
SELECT
  person_id,
  round(sum(least($session_duration, 28800)) / 60, 0) AS total_minutes_in_app
FROM sessions
WHERE min_timestamp >= now() - interval {lookback_days} day
GROUP BY person_id
ORDER BY total_minutes_in_app DESC
LIMIT 50
```

The `least($session_duration, 28800)` cap (8 hours per session) filters out sessions where the tab was left open overnight.

### Dimension 3 — High-value event completions

Replace `{key_event_1}`, `{key_event_2}`, etc. with the events collected in the Gather context step.

```sql
SELECT
  person_id,
  count() AS valuable_event_count
FROM events
WHERE event IN ('{key_event_1}', '{key_event_2}')
  AND timestamp >= now() - interval {lookback_days} day
GROUP BY person_id
ORDER BY valuable_event_count DESC
LIMIT 50
```

### Dimension 4 — Feature breadth (distinct event types used)

```sql
SELECT
  person_id,
  uniq(event) AS distinct_event_types
FROM events
WHERE timestamp >= now() - interval {lookback_days} day
  AND event NOT IN ({noise_events})
GROUP BY person_id
ORDER BY distinct_event_types DESC
LIMIT 50
```

### Composite power score

Run this query to combine all four dimensions into a single normalized score. Default scoring weights:
- Value actions: **35%** — the strongest signal of a genuine power user
- Frequency: **25%** — habitual use matters
- Time in app: **25%** — depth of engagement
- Feature breadth: **15%** — broad adoption across the product

Use whatever weights the user confirmed in the context-gathering step.

Normalization uses the **95th percentile** rather than the raw max. Max-normalization is brittle: a single outlier (bot, internal account) crushes everyone else's score on that axis. Clipping at p95 spreads the top 25 across the score range more meaningfully.

```sql
WITH
  freq AS (
    SELECT
      person_id,
      argMax(person.properties.email, timestamp) AS email,
      argMax(person.properties.name, timestamp) AS display_name,
      uniq(toStartOfDay(timestamp)) AS active_days,
      uniq($session_id) AS session_count
    FROM events
    WHERE timestamp >= now() - interval {lookback_days} day
    GROUP BY person_id
  ),
  time_in_app AS (
    SELECT
      person_id,
      round(sum(least($session_duration, 28800)) / 60, 0) AS total_minutes
    FROM sessions
    WHERE min_timestamp >= now() - interval {lookback_days} day
    GROUP BY person_id
  ),
  value_actions AS (
    SELECT
      person_id,
      count() AS valuable_count
    FROM events
    WHERE event IN ('{key_event_1}', '{key_event_2}')
      AND timestamp >= now() - interval {lookback_days} day
    GROUP BY person_id
  ),
  breadth AS (
    SELECT
      person_id,
      uniq(event) AS distinct_types
    FROM events
    WHERE timestamp >= now() - interval {lookback_days} day
      AND event NOT IN ({noise_events})
    GROUP BY person_id
  ),
  combined AS (
    SELECT
      f.person_id,
      f.email,
      f.display_name,
      f.active_days,
      f.session_count,
      coalesce(t.total_minutes, 0) AS total_minutes,
      coalesce(v.valuable_count, 0) AS valuable_count,
      coalesce(b.distinct_types, 0) AS distinct_types
    FROM freq f
    LEFT JOIN time_in_app t USING (person_id)
    LEFT JOIN value_actions v USING (person_id)
    LEFT JOIN breadth b USING (person_id)
    WHERE f.email IS NOT NULL AND f.email != ''
  ),
  -- p95 normalization clips outliers so a single extreme user doesn't flatten everyone else.
  bounds AS (
    SELECT
      quantile(0.95)(active_days) AS p95_days,
      quantile(0.95)(total_minutes) AS p95_minutes,
      quantile(0.95)(valuable_count) AS p95_valuable,
      quantile(0.95)(distinct_types) AS p95_types
    FROM combined
  )
SELECT
  c.person_id,
  c.email,
  c.display_name,
  c.active_days,
  c.session_count,
  c.total_minutes,
  c.valuable_count,
  round(if(c.session_count > 0, c.valuable_count / c.session_count, 0), 2) AS value_actions_per_session,
  c.distinct_types,
  round(
    (least(if(b.p95_days > 0, c.active_days / b.p95_days, 0), 1) * 25) +
    (least(if(b.p95_minutes > 0, c.total_minutes / b.p95_minutes, 0), 1) * 25) +
    (least(if(b.p95_valuable > 0, c.valuable_count / b.p95_valuable, 0), 1) * 35) +
    (least(if(b.p95_types > 0, c.distinct_types / b.p95_types, 0), 1) * 15)
  , 1) AS power_score
FROM combined c
CROSS JOIN bounds b
ORDER BY power_score DESC
LIMIT 25
```

If the user excluded a dimension during context gathering, drop its CTE and the corresponding term from the score expression, then redistribute its weight proportionally across the remaining dimensions so the total still sums to 100 (see the worked example in the context-gathering step).

### Group-level analysis (optional, B2B)

If the user opted in to account-level ranking, run the composite once more grouped by the relevant `$group_*`. Replace `$group_1` with the index matching the group type (e.g. customer = `$group_1` if that's how the project is configured — confirm with the user).

```sql
WITH per_person_score AS (
  -- paste the composite SELECT above, but also project `$group_1 AS group_key`
  -- by adding `any($group_1) AS group_key` to the `freq` CTE
)
SELECT
  group_key,
  count(DISTINCT person_id) AS active_users,
  round(avg(power_score), 1) AS avg_power_score,
  round(sum(power_score), 1) AS total_power_score
FROM per_person_score
WHERE group_key != ''
GROUP BY group_key
ORDER BY total_power_score DESC
LIMIT 20
```

`total_power_score` ranks accounts by overall depth of engagement; `avg_power_score` ranks by per-seat intensity (better for fair comparison between small and large accounts).

---

## Output format

Present a summary in this structure:

```
**Power users — last {lookback_days} days**

**Top 10 by composite score**

| Rank | User | Active days | Time in app | Value actions | Breadth | Score |
|------|------|-------------|-------------|---------------|---------|-------|
| 1 | user@example.com | 22/30 | 4h 20m | 87 | 18 | 94.2 |
| 2 | ... | ... | ... | ... | ... | ... |

**Dimension leaders**
• Most frequent: [user] — logged in 28/30 days
• Most time in app: [user] — 9h 15m total
• Most value actions: [user] — 142 [event name] events
• Broadest usage: [user] — used 24 distinct event types
• Most concentrated: [user] — 8.3 value actions per session

**Flagged patterns**
[Auto-emit any of these that apply, based on the data:
 - User in top 5 by frequency but bottom half by value actions → likely passive/bot, recommend manual review
 - User in top 5 in all four dimensions → case-study candidate
 - p95 normalization clipped >3 users at 100 on the same axis → unusual concentration of activity, worth investigating]
```

Keep the table to 10 rows. `value_actions_per_session` already appears in "Dimension leaders" so it's omitted from the main table to keep it readable.

**Identified users only:** The composite query already filters out persons without an email so unidentified visitors and bots never reach the report (unless the user opted into the B2C bot-filter path during context-gathering). After running, note how many unidentified persons would have appeared in the raw ranking (compare a count of all top-25 candidates vs identified ones) and suggest the user check their `posthog.identify()` calls if the gap is large.

**Identity caveat:** Mention once that emails shown are the most-recent value PostHog saw on an event in the window. If a user changed email mid-window, you'll see the latest.

---

## Create a cohort

After surfacing the results, use `cohorts-create` to save the top power users as a cohort in PostHog.

**Cohort definition:** A **static** cohort containing the `person_id`s from the composite-score top 25. Pass them as the `person_ids` field on `cohorts-create`. Static cohorts are appropriate here because the ranking is point-in-time — re-run the skill next month to refresh.

**Name:** `Power Users — {ym}` (e.g. `Power Users — 2026-05`).

Tell the user:
- The cohort will appear in PostHog under Cohorts and can be used for targeting, messaging, or further analysis
- It can be used as an audience in feature flags to give power users early access to new features
- Power users are often the best candidates for interviews, beta programs, or case studies
- Static cohorts don't auto-update — re-run this skill to refresh the membership

---

## Create a dashboard (optional)

If the user wants ongoing power user monitoring, use `dashboard-create` and `insight-create` to build a dashboard.

### Create the dashboard
Use `dashboard-create` with:
- `name`: "Power User Tracking"
- `description`: "Tracks the size, composition, and behavior of the top power user cohort over time."

### Add these insights

| Insight | How | What it measures |
|---|---|---|
| **Power Users cohort size over time** | `query-trends` — unique users filtered to the `Power Users — {ym}` cohort | How many of the current top cohort are active each week (note: cohort is static, so this drifts as members churn) |
| **Top value events leaderboard** | `execute-sql` — top 20 users by key event count this month | Who's most active right now |
| **Power user retention** | `insight-create` (retention type), filtered to the Power Users cohort | Are your best users sticking? |
| **Feature breadth growth** | `execute-sql` — avg distinct event types per power user, weekly | Are power users adopting more of the product over time? |
| **Power user % of WAU** | `execute-sql` — power users / total WAU | Is your power user base growing as a share of overall users? |

Note: tiles use the static cohort directly so the dashboard and the skill share one definition of "power user." Refresh the cohort by re-running the skill — the dashboard picks up the new membership automatically.

---

## Offer a user-interview survey (optional)

After the cohort step, offer to create a PostHog survey that invites the top 10 power users to a user interview. Ask the user:

> "Want me to create a survey asking the top 10 power users if they'd be open to a user-interview call? I'll target it precisely to those users, and the survey copy will tell them they're one of your top users."

If they say yes, use `survey-create` (run `info survey-create` first to confirm the schema) with the following defaults — confirm any free-text values before submitting:

- **Type**: `popover` (least intrusive, can be shown after a `$pageview` so it doesn't interrupt a power user mid-flow).
- **Name**: `Power user interview — {ym}`.
- **Description**: "Targeted invite for our top 10 power users to chat with the team."
- **Targeting**: a **separate static cohort** of the top 10 person IDs from the composite score. Create it with `cohorts-create` and name it `Power user interview — top 10 {ym}`. Don't try to "cap" the 25-person cohort from the previous step — build a fresh one with exactly the 10 IDs.
- **Display conditions**: show once per user, cap total responses at 10.
- **Questions** (single multiple-choice question with an optional follow-up):
  1. *"You're one of our top 10 power users — we'd love to learn from you. Would you be willing to do a 30-minute user interview so we can ask how we can make the product better for you?"*
     - Choices: "Yes — happy to chat", "Maybe — send me details", "Not right now".
  2. *Open text follow-up (shown if they pick Yes or Maybe):* "What's the best email or calendar link to reach you on?"

Tell the user:
- The survey will only appear for the exact top 10 cohort — no other users will see it.
- Power users tend to respond at much higher rates than broad surveys, so a low ask cap (10 responses) is realistic.
- Recommend pairing it with a follow-up plan: who on the team will reach out, and what the interview script will cover.

If the user declines, skip the step and continue.

---

## Interpreting the results

**High frequency, low value actions**: User logs in often but doesn't complete valuable actions — possible passive user or someone stuck in onboarding. Consider reaching out to understand their use case.

**High value actions, low frequency**: Infrequent but high-intensity sessions — could be a batch/periodic use case. Not necessarily a problem; understand their workflow before assuming low engagement.

**High breadth, moderate frequency**: User has explored many features but doesn't use any single one heavily — likely a thorough evaluator or a champion mapping the product to a workflow. Good interview candidate for "what almost made you stick" insight.

**High value actions per session**: Concentrated power users — they get a lot done each time they show up. Often the best candidates for advanced-feature interviews.

**Top-ranked across all dimensions**: Ideal case study or reference customer candidate. These users have the clearest signal that the product is deeply embedded in their workflow.

---

## Evaluation

After delivering the analysis (and any optional artifacts), offer the user a quick rating so we can improve this skill over time. This step is **optional** — if the user dismisses the selector, end the turn normally and do **not** send an event.

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
   curl -s -o /dev/null -w '%{http_code}' -X POST https://us.i.posthog.com/i/v0/e/ \
     -H 'Content-Type: application/json' \
     -d '{
       "api_key": "sTMFPsFhdP1Ssg",
       "event": "work_skill_rated",
       "distinct_id": "<operator-email-or-work-skills-anonymous>",
       "properties": {
         "skill_name": "power-user-discovery",
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
   - `mode`: which optional sub-steps ran. Use one of: `"core"` (analysis only), `"cohort_created"`, `"dashboard_created"`, `"survey_offered"`. If multiple ran, pass the most material one (artifact-creating steps beat `"core"`). Use `null` only if you genuinely can't classify.
   - `artifacts_created`: array of `"<type>:<id>"` strings for any PostHog cohort, dashboard, insight, or survey created during this run (e.g. `["cohort:1234","dashboard:567","survey:89"]`). Use `[]` if none.
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"Top 50 power users, last 30 days, US-prod project"`).
4. Confirm to the user with one short line, e.g. *"Thanks — logged your 3/4 rating."*

If the curl call prints a non-2xx status code, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "Who are our power users?"
- "Find me the most engaged users in PostHog"
- "Which users use the product the most?"
- "Create a power user cohort"
- "Who should I talk to about our advanced features?"
- "Show me our top users this month"
- "Set up power user tracking"
- "Who are our super users?"
