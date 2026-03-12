---
name: skill-creator
description: Create or update OpenClaw Skills for the Semicolon team. Use when designing, structuring, packaging, or iterating on skills — modular AI agent capability packages with SKILL.md, scripts, references, and assets. Covers the full pipeline from requirement gathering through validation and deployment to bot workspaces.
---

# Skill Creator

Create production-ready OpenClaw Skills following proven patterns and Semicolon team standards.

## Core Principles

1. **Context window is a public good** — only add what the model doesn't already know
2. **Concise > verbose** — examples beat explanations; prefer 1 good example over 3 paragraphs
3. **Progressive disclosure** — metadata always loaded (~100 words), SKILL.md on trigger (<500 lines), references on demand
4. **Appropriate degrees of freedom** — fragile ops get scripts (low freedom); heuristic tasks get text guidance (high freedom)
5. **No extraneous files** — no README, CHANGELOG, INSTALLATION_GUIDE. Only files the agent needs to do the job

## Skill Anatomy

```
skill-name/
├── SKILL.md              # Required. Frontmatter (name+description) + markdown body
├── scripts/              # Optional. Deterministic/reusable code (Python/Bash)
├── references/           # Optional. Docs loaded into context on demand
└── assets/               # Optional. Files used in output (templates, icons)
```

### Frontmatter Rules

```yaml
---
name: kebab-case-name
description: What the skill does AND when to use it. This is the ONLY trigger mechanism — if "when to use" isn't here, the skill won't activate.
---
```

- `name` and `description` only. No other fields.
- Description must include concrete trigger scenarios (file types, task types, keywords)
- Body is loaded AFTER triggering — never put "When to Use" sections in the body

### Body Rules

- Imperative/infinitive form ("Run the script", not "You should run the script")
- Under 500 lines. Split to `references/` when approaching limit
- Reference bundled files with clear "when to read" guidance
- One level deep references only (SKILL.md → references/foo.md, never references/foo.md → references/bar.md)
- For reference files >100 lines, include a table of contents at top

## Creation Pipeline

### Step 1: Gather Requirements

Ask concrete questions. Skip if requirements are already clear.

- What tasks does this skill automate?
- Example user prompts that should trigger it?
- What reusable resources exist? (scripts, docs, templates)
- Which bots will use this skill?

### Step 2: Plan Contents

For each concrete use case, identify:

| Need | Resource Type | Example |
|---|---|---|
| Same code rewritten repeatedly | `scripts/` | `validate-config.sh` |
| Detailed docs needed during execution | `references/` | `api-schema.md` |
| Files copied into output | `assets/` | `template.pptx` |

### Step 3: Initialize

```bash
python3 CREATOR_SCRIPTS/init_skill.py <skill-name> \
  --path /Users/reus/.openclaw/workspace/skills \
  --resources scripts,references  # only what's needed
```

Where `CREATOR_SCRIPTS` = `/Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/skill-creator/scripts`

- Skill name: lowercase, hyphens only, <64 chars, verb-led preferred
- Do NOT use `--examples` — delete placeholder files, don't create them

### Step 4: Implement

Order: scripts → references → SKILL.md

1. **Scripts first** — write, chmod +x, test with real data. Every script must run successfully before proceeding.
2. **References** — extract detailed/long content from what would be SKILL.md. Keep each focused on one domain.
3. **SKILL.md last** — write the body referencing scripts and references. Check line count stays <500.

#### SKILL.md Structure Patterns

Pick the pattern that fits, or combine:

- **Workflow-based**: Sequential steps (e.g., bot-onboarding pipeline)
- **Task-based**: Independent operations (e.g., PDF tools)
- **Reference/guidelines**: Standards and specs
- **Capabilities-based**: Interrelated features

### Step 5: Validate & Package

```bash
python3 CREATOR_SCRIPTS/package_skill.py /Users/reus/.openclaw/workspace/skills/<skill-name>
```

This validates then packages. Fix all errors before proceeding. Validation checks:
- Frontmatter format and required fields
- Naming conventions
- Description quality
- File organization

### Step 6: Content Validation

After structural validation passes, verify the skill actually works:

1. Count lines (`wc -l SKILL.md`) — must be <500
2. Check all referenced files exist
3. Check scripts are executable and run without errors
4. Verify description includes trigger scenarios
5. Grep for key terms that must appear (domain-specific)

### Step 7: Deploy

Copy the `.skill` package or register in bot workspace `available_skills`.

For Semicolon bots: skills live at `/Users/reus/.openclaw/workspace/skills/` and are auto-discovered via workspace config.

## Semicolon Best Practices (Lessons Learned)

These are hard-won lessons from creating real skills. Follow them.

### Auth & Config References

- Use `mode: "token"` for auth.profiles (OpenClaw manages credentials via wizard/doctor)
- Never put raw API keys in skill templates or references
- Config paths: `channels.slack.dm.allowFrom` (NOT top-level `dm.allowFrom`)

### Validation Scripts

- Always include a validation/health-check script for infrastructure skills
- Test against ALL target environments (all 7+ bots, not just one)
- Require 0 failures AND 0 warnings before declaring done

### Bot-Aware Skills

- Bots are independent OpenClaw instances, NOT sub-agents
- Bot communication: GitHub labels + polling only (never Slack mention handoff)
- Bot ID mapping belongs in references, not SKILL.md body

### Content Quality

- Real examples with real paths/IDs beat abstract patterns
- Include "MOST COMMONLY SKIPPED" warnings for steps people forget
- Include the exact CLI commands — don't make the agent figure out flags

### Iteration

- First version is never final. Use on real tasks, note struggles, update.
- When updating, re-run `package_skill.py` to re-validate.

## Quick Reference

| Item | Value |
|---|---|
| Skills dir | `/Users/reus/.openclaw/workspace/skills/` |
| init script | `CREATOR_SCRIPTS/init_skill.py` |
| package script | `CREATOR_SCRIPTS/package_skill.py` |
| CREATOR_SCRIPTS | `/Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/skill-creator/scripts` |
| Max SKILL.md lines | 500 |
| Max name length | 64 chars |
| Frontmatter fields | `name`, `description` only |
| Body style | Imperative/infinitive |
| Forbidden files | README, CHANGELOG, INSTALL, etc. |
