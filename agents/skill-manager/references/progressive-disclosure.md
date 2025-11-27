# Progressive Disclosure Patterns

> skill-manager Agent의 Progressive Disclosure 적용 가이드

## Patterns

### Pattern 1: Simple Skill (<100 lines)

```
skill-name/
└── SKILL.md (전체 내용)
```

**예시**: assign-project-label, auto-label-by-scope

### Pattern 2: Medium Skill (100-200 lines)

```
skill-name/
├── SKILL.md (60-80 lines: overview + quick start)
└── references/
    └── workflow.md (상세 프로세스)
```

**예시**: assign-estimation-point

### Pattern 3: Complex Skill (200-300 lines)

```
skill-name/
├── SKILL.md (50-70 lines: overview + links)
└── references/
    ├── workflow.md
    ├── examples.md
    └── validation.md
```

**예시**: health-check (291 → 65 lines, 77.7% reduction)

### Pattern 4: Very Complex Skill (>300 lines)

```
skill-name/
├── SKILL.md (50-80 lines: minimal overview)
└── references/
    ├── rules.md (core rules)
    ├── workflow.md (detailed process)
    ├── examples.md (usage examples)
    ├── integration.md (tool integration)
    └── output.md (output formats)
```

**예시**: check-team-codex (462 → 62 lines, 86.6% reduction)

## Anthropic Principles

### Concise is Key

> "Claude is already smart - only add what Claude doesn't know"

**✅ Include**:

- SAX-specific workflows
- Team conventions (Semicolon rules)
- GitHub API patterns
- Trigger conditions
- Output formats

**❌ Exclude**:

- General programming concepts
- Obvious explanations
- Verbose documentation
- How to use basic tools

### Description Format

```yaml
# ✅ Good
description: "Assign project labels to Epics and connect to GitHub Projects #1. Use when (1) creating new Epic, (2) migrating Epic, (3) Epic needs categorization."

# ❌ Bad
description: "This skill assigns labels"
```

## What to Separate into references/

**✅ Move to references/**:

- Detailed validation rules (>50 lines)
- Multiple workflow scenarios (>30 lines each)
- Extensive code examples (>20 lines)
- Output format templates (>40 lines)
- Integration examples (Husky, VS Code, CI/CD)
- Long bash scripts
- Comprehensive checklists (>15 items)

**❌ Keep in SKILL.md**:

- Frontmatter (always)
- Purpose and role (1-2 sentences)
- When to use / triggers
- Quick Start (3-5 line example)
- Advanced Usage section (links to references/)
- SAX Message format
- Related links
