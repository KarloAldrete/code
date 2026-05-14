---
name: define-icp
description: "Define, import, or update the user's Ideal Customer Profile (ICP) and persist it to a shared local file (`~/.posthog-work-skills/icp.md`) so other PostHog Work Skills (customer-review, product-market-fit, and others) can reuse it without asking again. Trigger when the user asks to define, set up, capture, describe, or update their ICP — phrases like 'define my ICP', 'set up my ideal customer profile', 'who is my ideal customer', 'help me describe my target customer', 'update my ICP', 'change my ICP', 'capture my customer profile', 'what's my ICP', 'I haven't defined an ICP yet', 'walk me through building an ICP', 'my best-fit customer is…', 'save my ICP so other skills use it'."
---

# Define ICP

## What this skill does

Captures the user's **Ideal Customer Profile (ICP)** — the company or individual their product is built for — and saves it to a shared local file so other PostHog Work Skills can reuse it on every future run instead of re-asking.

An ICP is **not** the same as a user persona. A persona describes one individual's motivations and frustrations; an ICP describes the *kind of customer* the product is for, and is specific enough to drive go-to-market, pricing, and prioritisation decisions. See PostHog's framework for the distinction: <https://posthog.com/newsletter/ideal-customer-profile-framework>.

The skill handles three entry conditions:

1. **You already ran this skill before.** Loads the saved file, shows the one-sentence summary, and lets you keep it, update specific sections, or rebuild from scratch.
2. **You have an ICP defined elsewhere** (in your head, a doc, or a public URL). Imports it and runs a specificity check to fill gaps.
3. **You haven't defined one yet.** Walks you through a "best-guess" ICP via guided questions, drawing on PostHog's published framework. The first version doesn't need to be perfect — it improves as you collect real data.

The output is a single markdown file at `~/.posthog-work-skills/icp.md` with a YAML frontmatter block (for quick parsing) and structured sections. Other skills (`/customer-review`, `/product-market-fit`) check for this file first and only ask the user for an ICP if it's missing.

---

## Before you start

No PostHog MCP is required for this skill — it doesn't query any PostHog data. It only reads and writes a local file at:

```
~/.posthog-work-skills/icp.md
```

If the user points at a public URL during Path A (import), this skill uses `WebFetch` to read it. Authenticated URLs (Notion, Confluence, Google Docs, private GitHub) will not work — fall back to asking the user to paste the relevant content instead.

---

## Load existing ICP

At the **start of every run**, check whether `~/.posthog-work-skills/icp.md` exists.

If it **does not exist**, proceed to *Step 1 — Branch on existing definition*.

If it **does exist**, read the file, extract the `summary` field from the YAML frontmatter, and show it back to the user in one short message, e.g.:

> *Found a saved ICP from {last_updated}:*
> *"{summary}"*
> *What would you like to do?*

Then call `AskUserQuestion` with **exactly one** question:
- `question`: `"You already have an ICP saved. What now?"`
- `header`: `"Saved ICP"`
- `multiSelect`: `false`
- `options`:
  1. label `"Keep as-is"`, description `"Confirm the saved ICP is still right. Nothing changes."`
  2. label `"Update sections"`, description `"Edit specific parts (e.g. company size, must-haves). Keep the rest."`
  3. label `"Rebuild from scratch"`, description `"Throw away the saved file and start over."`

Route based on the answer:
- **Keep as-is** → confirm in one line ("Cool — leaving it as is."), set `mode = "keep_existing"`, jump straight to *Evaluation*. Do **not** rewrite the file.
- **Update sections** → jump to *Update flow*.
- **Rebuild from scratch** → continue to *Step 1*. When the file is written in *Step 3*, overwrite the existing one.

---

## Step 1 — Branch on existing definition

If you've reached this step, there's no saved ICP (or the user chose to rebuild). Ask **one question** to pick the branch.

Call `AskUserQuestion`:
- `question`: `"Do you already have an ICP defined somewhere?"`
- `header`: `"Have one?"`
- `multiSelect`: `false`
- `options`:
  1. label `"Yes — paste it"`, description `"You'll paste the ICP description into chat as free text."`
  2. label `"Yes — file or URL"`, description `"Point me at a local file path or a public URL and I'll read it."`
  3. label `"No — help me build one"`, description `"Walk me through it with guided questions."`

Route based on the answer:
- **Paste** → go to *Path A1*.
- **File or URL** → go to *Path A2*.
- **Help me build one** → go to *Path B*.

---

## Path A — Import an existing ICP

### A1 — Paste in chat

Ask in one short message:
> *Paste your ICP description here — anything goes, from a one-liner to a full page. I'll structure it.*

Accept the user's reply as free text. Cache it as `imported_text`. Set `source = "pasted"`.

Continue to *Specificity check* below.

### A2 — File or URL

Ask in one short message:
> *Drop a local file path (I'll read it) or a public URL (no auth required). If it's behind a login — Notion, Confluence, Google Docs, private GitHub — paste the relevant content here instead.*

- If the user provides a **local file path**, use the `Read` tool. Cache the contents as `imported_text`. Set `source = "file_import"`.
- If the user provides a **public URL**, use `WebFetch` with the prompt: *"Extract the ideal customer profile description — who the product is for, including company type, size, roles, pain points, must-haves, and must-not-haves. Reproduce verbatim where possible."* Cache the result as `imported_text`. Set `source = "url_import"`.
- If `WebFetch` fails (auth required, paywall, 4xx), explain the failure in one line and re-ask the user to paste content directly. Fall back to A1.

Continue to *Specificity check*.

### Specificity check

Score the imported text against the rubric below. Each unchecked dimension triggers a single targeted follow-up question. **Ask follow-up questions one at a time** — wait for an answer before moving to the next. Allow the user to say "skip" on any one (record as `Unknown` in the saved file). Allow multi-part answers (skip ahead if a single reply covers multiple dimensions).

| Check | Trigger question if missing |
|---|---|
| Customer type stated (B2B / B2C / both) | *"Who are you selling to — businesses or individuals?"* |
| Pain points or problem solved is described | *"What problem does your product solve for them?"* |
| Size range (employees for B2B, income for B2C if relevant) | *"Roughly how big are they? For B2B I usually ask employee count; for B2C, income only if it matters."* |
| At least one user role named (B2B) | *"Inside the customer, which role(s) actually use the product?"* |
| At least one must-have characteristic | *"Any traits a fit customer **must** have?"* |
| At least one must-not-have characteristic | *"Anything that would disqualify a customer?"* |
| Summary is ≥ 1 specific sentence (not just "B2B SaaS") | *"That's a bit broad — what makes a customer **specifically** a fit for your product vs. any B2B SaaS company?"* |

Once the rubric is fully addressed (answer or skip on every row), continue to *Step 2*.

---

## Path B — Build a "best guess" ICP from scratch

Open with a brief explainer in **one short message** (2–3 sentences):
> *Quick framing before we start: an ICP describes the **kind of customer** your product is built for — company type, size, roles, pain points. It's not the same as a user persona, which describes one individual's motivations. Your first ICP doesn't need to be perfect — it'll improve as you collect data on who actually retains and pays. Let's go.*

Then ask each question below **one at a time, in order**. Wait for the user's reply (an answer, "skip", or "use the default") before moving to the next. Conditional questions only fire when relevant. If the user gives a multi-part answer that resolves several questions at once, accept it and skip ahead — never re-ask something already answered.

**Question 1 — Buyer type** (required)
> *Who would buy your product — individuals (B2C) or businesses (B2B)? If both, which is primary right now?*

Cache `customer_type` ∈ `{ "B2B", "B2C", "both" }`. If "both", ask which is the primary go-to-market focus and record that as `customer_type`.

**Question 2 — End customers** (B2B only)
> *Who are your customer's customers? (Knowing this often clarifies the product's downstream value.)*

If not B2B, skip silently.

**Question 3 — Pain points** (required)
> *What pain points or problems does your product solve for them? One or two sentences is plenty.*

**Question 4 — Company size** (B2B only)
Ask via `AskUserQuestion` with options:
- `1–10`
- `11–50`
- `51–200`
- `201–500`
- `501–2,000`
- `2,000+`

(If "Other" is chosen the user can type "spans multiple" or a custom range.) Cache as `employee_count_range`.

**Question 5 — Income / individual size** (B2C only)
> *For an individual buyer, does income matter? If yes, what range? "Doesn't matter" is a totally valid answer for many consumer products.*

Cache as `income_range` (string, may be `"doesn't matter"`).

**Question 6 — Company stage** (B2B only; optional for B2C)
> *What stage of company do they tend to be in? Roughly: pre-product-market-fit, growth-stage, mature, or it spans multiple?*

Cache as `company_stage`.

**Question 7 — Roles** (required)
> *Inside the customer, which roles use your product? (e.g. engineers, PMs, marketers, founders, ops.) If there's both a decision-maker role and an end-user role, name both.*

Cache as a list.

**Question 8 — Tools they have or want to replace** (optional)
> *What tools do they currently use, or want to replace? This is one of the strongest fit signals — customers fleeing a specific competitor are often the easiest to win.*

Cache as a list.

**Question 9 — What they value** (optional)
> *What do they value most when picking a product like yours? (e.g. speed, control, design, ease, transparency, price.)*

Cache as a list.

**Question 10 — Must-haves** (required)
> *Any characteristics a fit customer **must** have? Even one is enough.*

Cache as a list.

**Question 11 — Must-not-haves** (required)
> *Likewise, any they **must not** have? Common ones: too large, regulated industry, on-prem only, no engineering team.*

Cache as a list.

After Q11, continue to *Step 2*.

---

## Step 2 — Confirm the one-sentence summary

Synthesise a single specific sentence from the cached answers (Path B) or `imported_text` + follow-up answers (Path A). A good summary names: customer type, size or stage, role(s) that use it, and the primary pain point. Avoid vague phrasing like "B2B SaaS companies" alone.

Example (good):
> *Growth-stage B2B SaaS companies (50–500 employees) where product and engineering teams own analytics, fleeing dashboard-heavy tools like Tableau or Mixpanel for something developer-first.*

Example (too vague — re-ask):
> *B2B SaaS companies.*

Show the summary in one short message:
> *Here's my one-line take:*
> *"{summary}"*
> *Sound right?*

If the user says yes (or anything affirmative), continue to *Step 3*.

If the user pushes back, ask one clarifying question, regenerate the summary, and show it again. Allow up to **2 retries**. After the second retry, ask the user to write the one-liner themselves and accept whatever they provide as `summary`.

---

## Step 3 — Save the file

Write `~/.posthog-work-skills/icp.md` using the format below. Create the `~/.posthog-work-skills/` directory if it doesn't exist (use `mkdir -p`).

```markdown
---
last_updated: {today as YYYY-MM-DD}
version: 1
customer_type: {B2B | B2C | both}
summary: "{one-sentence summary}"
source: {built_from_scratch | pasted | file_import | url_import}
---

# Ideal Customer Profile

## Summary
{one-sentence summary}

## Customer type
{B2B / B2C / both} — {their customers, if B2B; otherwise omit the clause}

## Pain points & problems solved
- {bullet per pain point}

## Size & stage
- Employee count (B2B): {range or "n/a" for B2C}
- Revenue / income (B2C): {range or "doesn't matter" or "n/a"}
- Company stage: {pre-PMF / growth / mature / mixed / "n/a"}

## Roles that use the product
- {bullet per role}

## Must-have characteristics
- {bullet per must-have}

## Must-not-have characteristics
- {bullet per must-not-have}

## Other dimensions
- Industry / vertical: {free text or "Unknown"}
- Tools they use or want to replace: {free text or "Unknown"}
- What they value (e.g. speed, design, control): {free text or "Unknown"}
- Geography (if relevant): {free text or "Unknown"}

## Notes
{Source attribution: e.g. "Built from scratch on 2026-05-14 via /define-icp." or "Imported from https://example.com/icp on 2026-05-14, then refined with follow-up questions."}
```

For any section where no information was captured, write `Unknown` rather than leaving it blank or omitting the header — the structure must be predictable so other skills can parse it.

If writing the file fails (permission denied, disk full, etc.), surface a one-line warning to the user and print the full file contents in a fenced code block so they can save it manually:

> *Couldn't write to `~/.posthog-work-skills/icp.md` — here's the content to save manually:*

Then continue to *Output format*.

Set `mode` for the *Evaluation* step:
- Path B → `mode = "build_from_scratch"`
- Path A1 → `mode = "import_paste"`
- Path A2 → `mode = "import_file_url"`
- Rebuild from saved → `mode = "rebuild"`

---

## Update flow

Only used when the user picked **Update sections** at the existing-file branch.

1. Read the existing `~/.posthog-work-skills/icp.md`. Parse the frontmatter and each `## H2` section into memory.
2. Ask the user which sections to update via `AskUserQuestion` with `multiSelect: true`. Options:
   - `Summary`
   - `Customer type`
   - `Pain points & problems solved`
   - `Size & stage`
   - `Roles that use the product`
   - `Must-have characteristics`
   - `Must-not-have characteristics`
   - `Other dimensions`
   - `Notes`
3. For each selected section, re-ask the relevant Path B question(s) one at a time. Replace the section content with the new answer. Leave untouched sections **exactly as-is**.
4. If `Summary` was changed (or any change is significant enough that the old summary no longer fits), offer to regenerate the summary line via *Step 2*. Otherwise keep the existing summary.
5. Update `last_updated` to today. Keep `version` and `source` unchanged.
6. Write the file (overwrite).
7. Set `mode = "update_existing"`. Continue to *Output format*.

---

## How other skills use this file

Other PostHog Work Skills are wired up to read `~/.posthog-work-skills/icp.md` at the start of their `Gather context` step. Today this includes:

- **`/customer-review`** — Question 6 uses the saved ICP as the default for scoring per-customer ICP fit. The user can override per-run.
- **`/product-market-fit`** — Step 4 uses the saved ICP as the default for mapping to property filters and creating the "ICP Users" cohort. The user can override per-run.

If you add a new skill that needs an ICP, read the `summary` and section bodies from this file. If the file is absent, fall back to asking the user inline and add a one-line pointer: *"Don't have an ICP yet? Run `/define-icp` first."*

---

## Output format

After the file is written (or the user picked "Keep as-is"), confirm in one short message:

For new file or rebuild:
> *Saved your ICP to `~/.posthog-work-skills/icp.md`. `/customer-review` and `/product-market-fit` will use it automatically from here on. Re-run `/define-icp` any time to update.*

For update:
> *Updated `~/.posthog-work-skills/icp.md` ({list of changed sections}). Other skills will pick up the new version on their next run.*

For keep-as-is:
> *Leaving your saved ICP as-is. Last updated {last_updated}.*

Then continue to *Evaluation*.

---

## Evaluation

After delivering the result, offer the user a quick rating so we can improve this skill over time. This step is **optional** — if the user dismisses the selector, end the turn normally and do **not** send an event.

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
         "skill_name": "define-icp",
         "rating": <rating>,
         "rating_scale": "1-4",
         "feedback": "<feedback>",
         "mode": "<mode>",
         "artifacts_created": <artifacts>,
         "input_summary": "<input_summary>"
       }
     }'
   ```

   - `distinct_id`: the operator email from the active-environment system reminder if available; otherwise `"work-skills-anonymous"`.
   - `mode`: one of `"build_from_scratch"`, `"import_paste"`, `"import_file_url"`, `"update_existing"`, `"rebuild"`, `"keep_existing"`.
   - `artifacts_created`: `["icp:icp.md"]` if a file was written or updated this run; `[]` if the user picked "Keep as-is".
   - `input_summary`: one-sentence summary of what the user originally asked for (e.g. `"Defined ICP from scratch for a B2B developer-tools startup"`).

4. Confirm to the user with one short line, e.g. *"Thanks — logged your 4/4 rating."*

If the curl call returns a non-2xx response, mention it briefly in one line and move on. Do not retry.

---

## Example trigger phrases

- "Define my ICP"
- "Set up my ideal customer profile"
- "Who is my target customer?"
- "Update my ICP"
- "Help me describe my best-fit customer"
- "I haven't defined an ICP yet — walk me through it"
- "Save my ICP so other skills can use it"
- "Change my ICP — we've narrowed it down"
- "Capture my customer profile for the team"
