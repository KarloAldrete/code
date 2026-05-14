---
name: important-slack-threads
description: "Scan Slack for the most significant threads from the last 7 days — long discussions, controversial debates, or unresolved decisions, with extra weight on threads from saved VIPs or matching saved topics. Trigger when the user asks about important Slack threads, wants a weekly Slack digest, asks 'what did I miss', 'what's been happening on Slack', 'summarize the week in Slack', 'what was controversial this week', 'which decisions were made', 'what's unresolved', 'anything from person', 'what's been happening on topic', or mentions 'long threads', 'big threads', 'heated threads', or 'Slack roundup'."
---

# Important Slack threads

## What this skill does

Scans Slack over the last 7 days, surfaces the threads that *mattered* (long, controversial, or decision-shaped), summarizes each, and explicitly flags threads where there was sharp disagreement or where no conclusion was reached. Purely social threads — memes, GIF chains, jokes, congratulations — are filtered out so the digest stays signal-heavy.

The output is a Slack-ready roundup the user can skim in under two minutes.

---

## Before you start

Make sure the Slack MCP is connected. If it isn't, tell the user:
> "You'll need the Slack MCP connected to use this skill. Add it to your MCP config, then restart Claude Code."

Claude does not handle Slack tokens directly — the MCP handles authentication. If listing channels or fetching history returns an auth error, surface that error to the user and stop.

---

## Load saved preferences

At the start of every run, read the config file:

```
~/.posthog-work-skills/important-slack-threads.json
```

Shape:

```json
{
  "always_check_channels": ["#team-eng", "#product"],
  "vips": [{"name": "Jane Doe", "slack_id": "U0123ABC"}],
  "topics": ["pricing", "onboarding", "billing"],
  "last_updated": "2026-05-13"
}
```

If the file doesn't exist, treat `always_check_channels`, `vips`, and `topics` as empty arrays and proceed. Do not create the file yet — it gets written after the user confirms their preferences in `Gather context`.

If the file exists, load the values and use them to pre-fill the prompt in `Gather context` so the user can confirm with a single "looks good" reply rather than re-entering everything.

---

## Gather context

Before scanning, collect the following in **one combined prompt** so the user isn't interrupted mid-task.

### Step A — Detect top channels

Find the user's top 5 most-active channels over the **last 30 days**, measured by *messages the user posted* (not just channels they're a member of).

- Preferred: `search.messages` with query `from:me after:<30 days ago>`, group results by channel, sort by count desc, take the top 5.
- Fallback if `search.messages` is unavailable: `users_conversations` to list the user's channels, then a small `conversations_history` sample per channel over the last 30 days, counting messages with the user's `user` ID.

Cache the result for the rest of the run.

### Step B — Single combined prompt

Ask the user, in **one message**, to confirm or edit:

1. **Channels to scan** — pre-fill with the union of `always_check_channels` (from config) and the top 5 detected channels. Mark each entry so the user can see where it came from, e.g. `#team-eng (always)`, `#product (top 5)`, `#design (always + top 5)`. Accept channel names or IDs. If the user says "all public channels I'm in", default to **public channels only** — DMs and private channels are excluded unless the user explicitly opts them in.
2. **VIPs** — show the current saved list and ask if anyone should be added or removed. Accept display names or Slack user IDs. Resolve names → IDs via `users_lookupByEmail` or `users_list` and cache.
3. **Topics** — show the current saved list and ask if any topics should be added or removed. Free-text keywords (e.g. `pricing`, `onboarding`, `billing`).
4. **Thread length threshold** — default ≥ 10 replies OR ≥ 5 distinct participants. Offer to override.
5. **Time window** — default last 7 days. Say it back so the user can correct it.

Phrase the prompt so a returning user can reply "looks good" and proceed; a new user gets a single onboarding moment.

### Step C — Persist preferences

After the user confirms, write the merged values back to `~/.posthog-work-skills/important-slack-threads.json`:

- Merge any newly added channels into `always_check_channels` only if the user explicitly indicated they want to keep that channel for future runs (otherwise treat one-off additions as run-only).
- Update `vips` and `topics` with the confirmed list.
- Set `last_updated` to today.
- Create `~/.posthog-work-skills/` if it doesn't exist.

If writing the file fails, surface a one-line warning and continue with the in-memory values.

---

## How to scan

Use the Slack MCP tools (exact names vary by MCP build — common variants are noted). Cache user-ID → display-name lookups across the run to avoid repeated calls.

1. **List channels** — call the channel-list tool (e.g. `slack_list_channels` / `conversations_list`) and filter to the user's set.
2. **Pull recent history per channel** — for each channel, call the history tool (e.g. `slack_get_channel_history` / `conversations_history`) with `oldest` set to 7 days ago (Unix timestamp).
3. **Identify candidate threads** — keep parent messages where `reply_count >= 10` OR `reply_users_count >= 5` (using the user's threshold if overridden).
4. **Fetch each thread in full** — call the replies tool (e.g. `slack_get_thread_replies` / `conversations_replies`) with the parent `ts`.
5. **Resolve user IDs** — call the user-info tool (e.g. `slack_get_user_profile` / `users_info`) once per unique user, cache the display name.
6. **Get the permalink** for each thread (e.g. `chat_getPermalink`) so the output is verifiable.

If a channel returns `not_in_channel`, `channel_not_found`, or a private-channel error, skip it silently and add 1 to a "skipped channels" counter that surfaces in the output footer.

---

## What counts as "significant"

A thread is significant if it shows substantive back-and-forth on a topic, a decision being made (or attempted), or visible disagreement. Apply the social filter below to drop banter.

### Social filter (exclude these)

Drop a thread if **any two** of the following are true:
- Most replies are < 20 characters (rough rule: median message length < 20 chars)
- High ratio of emoji-only / GIF / image-only replies vs. text content (≥ 50% of replies)
- No question marks anywhere in the thread
- No action verbs from this set in any message: `decide`, `decided`, `should`, `shouldn't`, `can we`, `will`, `agree`, `disagree`, `propose`, `plan`, `ship`, `block`, `blocker`, `risk`, `concern`
- No links to docs, PRs, issues, Notion, Linear, GitHub, or external URLs

When uncertain, **lean toward including**. A user can ignore a borderline entry; missing a real one is worse.

---

## Using VIPs during scanning

VIPs come from the `vips` list in saved preferences (and any additions the user made in `Gather context`).

- A thread **initiated by a VIP** qualifies if it has **≥ 4 replies** OR **≥ 3 distinct participants** — lower than the default 10/5. This is so a VIP weighing in on something shorter still gets surfaced.
- A thread **in which a VIP participated** keeps the normal threshold, but if it qualifies, annotate the per-thread summary with `⭐ VIP` (no separate section).
- Match VIPs by Slack `user` ID first. Fall back to display-name match only if no ID is stored for that VIP.
- Apply the social filter as normal — a VIP cracking jokes in a meme thread is still a meme thread.

---

## Using topics to rank

Topics come from the `topics` list in saved preferences (and any additions made in `Gather context`).

- After candidate threads are gathered and filtered, score each thread on topic match: count messages in the thread that contain any topic keyword (case-insensitive substring match over the full message text, parent + replies).
- Threads with `topic_score > 0` sort **above** non-matching threads. Within the matching group, apply the existing flag-based sort (both flags → `❓` → `🔥` → participants desc → replies desc). Within the non-matching group, apply the same sort.
- Annotate matching threads with `🎯 Topic: <keyword(s)>` listing which topic(s) matched.
- This is a **boost**, not a filter. Non-matching threads still appear in the digest, just below the topic-matched ones.

---

## Detecting disagreement

Flag a thread with `🔥 Disagreement` when any of these apply:

- Explicit markers in messages: "I disagree", "I'm not sure that's right", "I'd push back", "actually", "however", "but I think", "concern", "blocker"
- Two or more participants propose distinct, incompatible approaches
- The same two participants go back and forth ≥ 3 turns each
- Negative-leaning reactions (`👎`, `🤔`, `❌`, `⛔`) from multiple distinct users
- Quoted disagreement: someone explicitly quotes or replies-to a prior message with a counter

Use the strongest signal you find as the basis for the flag — don't require all of them.

---

## Detecting no-decision / unresolved

Flag a thread with `❓ Unresolved` when any of these apply:

- The last 2–3 messages end with an open question (trailing `?` and no follow-up answer)
- Phrases like "let's discuss later", "TBD", "needs more thought", "parking this", "follow-up needed", "punt", "circle back", "offline"
- No named owner or action item by the end of the thread
- Last message is > 24h old AND the thread contains **no** agreement language: "sounds good", "let's do that", "agreed", "ship it", "decided", "going with", "let's go", "approved"

A thread can have **both** `🔥` and `❓` flags — that's a strong "needs attention" signal.

---

## Per-thread summary

For each surfaced thread, gather:

- **Channel** name + Slack permalink to the parent message
- **Initiator** — display name of the parent-message author
- **Participants** — top 3–5 by message count, plus a "+N others" tail. Show total participant count and total reply count.
- **Summary** — 1–2 sentences describing what the thread is about and how it progressed. Be specific (what was proposed, what was contested) rather than generic ("they discussed the project").
- **Decisions** — bullet list of what was explicitly agreed. If nothing was clearly decided, write `None reached` — do not invent decisions.
- **Flags** — `🔥 Disagreement`, `❓ Unresolved`, both, or none.
- **Annotations** — `⭐ VIP` (when a VIP initiated or participated) and/or `🎯 Topic: <keyword(s)>` (when any topic keyword matched). Either, both, or neither.
- Optional: 1–2 short verbatim quotes (under ~15 words each), attributed by name, when they capture the controversial point well.

---

## Output format

Produce a Slack-ready summary using this structure:

```
*Important Slack threads — last 7 days*

*#pricing* — Should we move the Scale tier to usage-based? (<permalink|view thread>)
• Initiated by: @jane
• Participants: @jane, @raj, @sam, +5 others (8 total, 23 replies)
• Summary: Jane proposed switching Scale to usage-based pricing in Q3. Raj pushed back on revenue predictability; Sam suggested a hybrid model. No call made.
• Decisions: None reached
• Flags: 🔥 Disagreement, ❓ Unresolved
• ⭐ VIP · 🎯 Topic: pricing

*#other-channel* — ...
• ...

_Scanned N channels over the last 7 days. M threads met the length threshold, K surfaced after filtering social/banter. V VIP-initiated threads surfaced (length threshold lowered). T threads matched topics. P channels skipped (private or no access)._
```

Rules for the output:

- Use Slack markdown (`*bold*`, `_italic_`, bullets with `•`, sub-bullets with `–`)
- **Sort order**: topic-matched threads first; within each group, threads flagged with both `🔥` and `❓` first, then `❓` alone, then `🔥` alone, then by participant count desc, then by reply count desc
- **Cap the output at 10 threads.** If more qualified, note `(N more not shown)` in the footer
- Use Slack `<url|label>` link syntax for permalinks so they render as clickable links in Slack
- Keep each summary tight — if you can't say something specific, the thread probably shouldn't be in the digest

---

## Accuracy and verification rules

- **Always include the permalink.** The user must be able to click through to verify any claim.
- **Never invent decisions.** If no clear agreement was stated, write `None reached`. Do not paraphrase a maybe-decision as a decision.
- **Quote sparingly and accurately.** Verbatim quotes must be exact (within Slack's formatting) and attributed by display name. Don't quote more than ~15 words.
- **Don't surface threads from channels the user didn't include.** If you stumbled into a related channel via cross-posts, leave it out.
- **Skip private/inaccessible channels silently** but count them in the footer so the user knows their coverage.
- **Distinguish observation from inference.** "Three people pushed back on the rollout date" is an observation. "The team is unhappy with the rollout date" is inference — only say it if it's clearly supported by the thread.
- If a thread is borderline-social but contains a real decision or disagreement, keep it and explain briefly in the summary.

---

## Evaluation

After delivering the digest, offer the user a quick rating so we can improve this skill over time. This step is **optional** — if the user dismisses the selector, end the turn normally and do **not** send an event.

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

3. If a rating was captured, fire a `work_skill_rated` event on PostHog project 2 by running this curl via the Bash tool (fill in `<rating>`, `<feedback>`, `<input_summary>`):

   ```bash
   curl -s -X POST https://us.i.posthog.com/i/v0/e/ \
     -H 'Content-Type: application/json' \
     -d '{
       "api_key": "sTMFPsFhdP1Ssg",
       "event": "work_skill_rated",
       "distinct_id": "<operator-email-or-work-skills-anonymous>",
       "properties": {
         "skill_name": "important-slack-threads",
         "rating": <rating>,
         "rating_scale": "1-4",
         "feedback": "<feedback>",
         "mode": null,
         "artifacts_created": [],
         "input_summary": "<input_summary>"
       }
     }'
   ```

   - `distinct_id`: the operator email from the active-environment system reminder if available; otherwise `"work-skills-anonymous"`.
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"Slack roundup last 7 days across #product and #eng"`).
4. Confirm to the user with one short line, e.g. *"Thanks — logged your 3/4 rating."*

If the curl call returns a non-2xx response, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "What were the most important Slack threads this week?"
- "Give me a Slack roundup for the last 7 days"
- "What did I miss on Slack?"
- "What was controversial this week?"
- "Any unresolved threads I should look at?"
- "Summarize the big discussions in #product and #team-eng"
