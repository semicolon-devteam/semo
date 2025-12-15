# Exploration Workflow

> spike-master Agent의 상세 탐색 워크플로우

## Step 1: Understand the Problem

When user types `/spike [topic]`, extract:

- Technical decision to be made
- Context and constraints
- Success criteria (performance, complexity, maintainability)

**Ask clarifying questions** if needed:

```markdown
I'll explore technical approaches for: [topic]

To provide the best recommendations, please clarify:

1. **Primary Goal**: Performance / Developer Experience / Maintainability / Cost?
2. **Constraints**: Bundle size limits / Browser compatibility / Budget?
3. **Timeline**: Quick prototype / Thorough evaluation?
4. **Integration**: Existing tech stack compatibility requirements?

(You can provide partial answers or "your choice" for any)
```

## Step 2: Create Spike Branch

```bash
# Create spike branch (NOT feature branch)
git checkout -b spike/[topic-name]

# Example:
git checkout -b spike/realtime-tech-evaluation
```

**Branch naming**:

- `spike/` prefix (never `feature/`)
- Descriptive topic name
- Keep lowercase with hyphens

## Step 3: Define Approaches to Evaluate

Based on the problem, identify 2-3 approaches:

```markdown
## Approaches to Evaluate

### Approach 1: [Name]

**Technology**: [Specific tech/library]
**Hypothesis**: [Why this might be good]

### Approach 2: [Name]

**Technology**: [Specific tech/library]
**Hypothesis**: [Why this might be good]

### Approach 3: [Name] (optional)

**Technology**: [Specific tech/library]
**Hypothesis**: [Why this might be good]

I'll prototype each and compare them based on:

- Performance (latency, throughput, resource usage)
- Complexity (lines of code, learning curve)
- Maintainability (documentation, community support)
- Integration (compatibility with existing stack)
- Cost (if applicable)
```

## Step 4: Implement Prototypes

For each approach:

### 4.1 Create isolated prototype directory

```bash
mkdir -p spike-prototypes/[approach-name]
cd spike-prototypes/[approach-name]
```

### 4.2 Implement minimal viable prototype

```typescript
// Focus on core integration points
// Don't build complete features
// Measure key metrics
```

### 4.3 Measure and document

```markdown
## Approach 1 Implementation Notes

**Setup Time**: [time taken]
**Lines of Code**: [count]
**Dependencies Added**: [list]

**Performance Metrics**:

- Latency: [measurement]
- Bundle size impact: [+X KB]
- Memory usage: [measurement]

**Developer Experience**:

- Learning curve: Easy / Medium / Hard
- Documentation quality: Good / Fair / Poor
- Type safety: Full / Partial / None

**Integration Issues**: [any compatibility problems]
```

## Step 5: Comparative Analysis

Create comprehensive comparison:

```markdown
## Comparative Analysis

| Criteria            | Approach 1          | Approach 2          | Approach 3          | Winner     |
| ------------------- | ------------------- | ------------------- | ------------------- | ---------- |
| **Performance**     |
| Latency             | [value]             | [value]             | [value]             | [approach] |
| Bundle Size         | [+X KB]             | [+Y KB]             | [+Z KB]             | [approach] |
| Memory              | [value]             | [value]             | [value]             | [approach] |
| **Complexity**      |
| LOC                 | [count]             | [count]             | [count]             | [approach] |
| Learning Curve      | [Easy/Med/Hard]     | [Easy/Med/Hard]     | [Easy/Med/Hard]     | [approach] |
| Setup Time          | [time]              | [time]              | [time]              | [approach] |
| **Maintainability** |
| Documentation       | [rating]            | [rating]            | [rating]            | [approach] |
| Community           | [size]              | [size]              | [size]              | [approach] |
| Last Update         | [date]              | [date]              | [date]              | [approach] |
| **Integration**     |
| Next.js Compat      | [✅/⚠️/❌]          | [✅/⚠️/❌]          | [✅/⚠️/❌]          | [approach] |
| TypeScript          | [Full/Partial/None] | [Full/Partial/None] | [Full/Partial/None] | [approach] |
| Existing Stack      | [✅/⚠️/❌]          | [✅/⚠️/❌]          | [✅/⚠️/❌]          | [approach] |

**Overall Winner by Category**:

- Performance: [approach]
- Complexity: [approach]
- Maintainability: [approach]
- Integration: [approach]
```

## Step 6: Risk Analysis

For each approach:

```markdown
## Risk Assessment

### Approach 1: [Name]

**Technical Risks**:

- 🔴 High Risk: [risk and impact]
- 🟡 Medium Risk: [risk and impact]
- 🟢 Low Risk: [risk and impact]

**Mitigation Strategies**:

- For [risk]: [mitigation approach]

**Long-term Concerns**:

- Vendor lock-in potential: [assessment]
- Scalability limits: [assessment]
- Breaking change history: [assessment]

### [Repeat for each approach]
```

## Step 7: Document Findings

Create comprehensive spike document:

```bash
# Create spike documentation
mkdir -p docs/spikes
touch docs/spikes/[topic-name].md
```

> 📚 **문서 템플릿**: [documentation-template.md](documentation-template.md)

## Step 8: Present Recommendations

Provide clear, actionable summary to user:

```markdown
# ✅ Spike Complete: [Topic]

## 🏆 Recommendation: [Approach Name]

**Why this approach**:
1. [Key benefit 1]
2. [Key benefit 2]
3. [Key benefit 3]

**Trade-offs**:
- [Trade-off 1 and why acceptable]
- [Trade-off 2 and why acceptable]

**Performance**: [Summary of performance characteristics]
**Complexity**: [Summary of implementation complexity]
**Risk**: [Overall risk assessment]

## 📊 Comparison Summary

| Approach | Performance | Complexity | Maintainability | Overall |
|----------|------------|-----------|----------------|---------|
| **[Recommended]** | [rating] | [rating] | [rating] | **WINNER** ⭐ |
| [Alternative 1] | [rating] | [rating] | [rating] | [overall] |
| [Alternative 2] | [rating] | [rating] | [rating] | [overall] |

## 📝 Full Documentation

Complete spike findings: `docs/spikes/[topic-name].md`

## 🚀 Next Steps

**To implement the recommendation**:

1. Return to main development branch:
   ```bash
   git checkout [feature-branch or main]
   ```

2. Start SDD workflow with chosen approach:
   ```bash
   /spec [feature] using [recommended approach]
   ```

3. Reference spike in plan.md

## 🧹 Spike Cleanup

**Keep**:
- ✅ `docs/spikes/[topic-name].md` (permanent documentation)

**Optional cleanup** (can delete after implementation):
- `spike-prototypes/` directory
- `spike/[topic-name]` branch (after merging relevant learnings)

Would you like to:
1. Proceed with SDD workflow using recommended approach
2. Explore a different aspect
3. Keep spike branch for reference
```

## Integration with Other Agents

### With spec-master

```markdown
spec-master identifies technical uncertainty
  ↓
Suggests: /spike [topic]
  ↓
spike-master explores and recommends
  ↓
Recommendation included in plan.md
```

### With implementation-master

```markdown
implementation-master reads plan.md
  ↓
Finds spike reference: docs/spikes/[topic].md
  ↓
Implements using recommended approach
  ↓
References spike for configuration and gotchas
```

### With quality-master

```bash
/verify --code-only
```

Check prototype code quality (optional).
