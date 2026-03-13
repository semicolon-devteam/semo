# Skill Review Checklist

Use this checklist before declaring a skill complete. Every item must pass.

## Structure
- [ ] SKILL.md exists with valid YAML frontmatter (`name` + `description` only)
- [ ] Skill directory name matches `name` in frontmatter
- [ ] No extraneous files (README, CHANGELOG, etc.)
- [ ] Only resource dirs that are actually used exist (scripts/, references/, assets/)
- [ ] All files referenced in SKILL.md actually exist

## Frontmatter
- [ ] `description` includes what the skill does
- [ ] `description` includes when to use / trigger scenarios
- [ ] `description` is comprehensive enough to trigger correctly
- [ ] No extra fields beyond `name` and `description`

## Body
- [ ] Under 500 lines
- [ ] Uses imperative/infinitive form throughout
- [ ] No "When to Use This Skill" section in body (belongs in description)
- [ ] References to bundled files include "when to read" guidance
- [ ] References are one level deep only (SKILL.md → ref, never ref → ref)
- [ ] Long reference files (>100 lines) have table of contents

## Scripts
- [ ] All scripts are executable (`chmod +x`)
- [ ] All scripts tested with real data and pass
- [ ] Scripts use correct paths for the target environment
- [ ] No hardcoded secrets or API keys

## Content
- [ ] Only includes information the model doesn't already know
- [ ] Real examples with real paths/IDs where applicable
- [ ] Critical/easy-to-skip steps have explicit warnings
- [ ] Exact CLI commands provided (no ambiguous instructions)

## Deployment
- [ ] `package_skill.py` passes with 0 errors
- [ ] Skill tested in at least one real scenario
- [ ] Line count verified: `wc -l SKILL.md`
