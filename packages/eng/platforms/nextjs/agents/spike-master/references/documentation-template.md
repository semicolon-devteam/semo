# Documentation Template

> spike-master Agent의 Spike 문서 템플릿

## Spike Document Template

```markdown
# Spike: [Topic Name]

**Date**: [date]
**Author**: spike-master (with [user])
**Status**: Complete
**Recommendation**: [Approach X]

## Problem Statement

[Clear description of the technical decision needed]

## Success Criteria

- Performance: [criteria]
- Complexity: [criteria]
- Maintainability: [criteria]
- Integration: [criteria]

## Approaches Evaluated

### Approach 1: [Name]

[Technology and hypothesis]

### Approach 2: [Name]

[Technology and hypothesis]

### Approach 3: [Name] (if applicable)

[Technology and hypothesis]

## Implementation Notes

### Approach 1

[Detailed implementation notes and metrics]

### Approach 2

[Detailed implementation notes and metrics]

### Approach 3

[Detailed implementation notes and metrics]

## Comparative Analysis

[Table from Step 5]

## Risk Assessment

[Risks and mitigations from Step 6]

## Recommendation

**Primary Recommendation**: Approach [X] - [Name]

**Rationale**:

1. [Key reason 1 with evidence]
2. [Key reason 2 with evidence]
3. [Key reason 3 with evidence]

**Trade-offs Accepted**:

- [Trade-off 1]: [Why acceptable]
- [Trade-off 2]: [Why acceptable]

**Alternative Recommendation** (if primary blocked): Approach [Y] - [Name]
**When to reconsider**: [Conditions that would change recommendation]

## Implementation Guidance

To implement the recommended approach in production:

1. **Dependencies**:
   ```bash
   npm install [packages]
   ```

2. **File Structure**:
   ```
   [Directory structure for recommended approach]
   ```

3. **Integration Points**:
   - [Point 1]: [How to integrate]
   - [Point 2]: [How to integrate]

4. **Testing Strategy**:
   - [Test type 1]: [Approach]
   - [Test type 2]: [Approach]

5. **Gotchas and Best Practices**:
   - ⚠️ [Gotcha 1]: [Solution]
   - ✅ [Best practice 1]: [Explanation]

## Prototype Code Samples

### Recommended Approach Code

```typescript
[Key code samples from prototype]
```

### Configuration

```typescript
[Configuration samples]
```

## References

- [Library documentation]
- [Community discussions]
- [Similar implementations]
- [Benchmark sources]

## Appendix

### Prototype Locations

- Approach 1: `spike-prototypes/[name]`
- Approach 2: `spike-prototypes/[name]`
- Approach 3: `spike-prototypes/[name]`

### Raw Metrics

[Detailed raw data and measurements]
```

## Quick Summary Template

For brief spike summaries:

```markdown
# Spike Summary: [Topic]

**Recommendation**: [Approach Name]
**Confidence**: High / Medium / Low

## Key Findings

| Approach | Performance | Complexity | Overall |
|----------|------------|-----------|---------|
| **[Winner]** | ⭐ Best | ⭐ Best | **WINNER** |
| [Alt 1] | Good | Good | Alternative |
| [Alt 2] | Fair | Fair | Not recommended |

## Why [Winner]?

1. [Reason 1]
2. [Reason 2]

## Trade-offs

- [Trade-off]: [Acceptable because...]

## Next Steps

1. `git checkout [branch]`
2. `/spec [feature] using [approach]`

Full details: `docs/spikes/[topic].md`
```

## Metrics Documentation

Always include these measurements:

### Performance Metrics

```markdown
| Metric | Approach 1 | Approach 2 | Approach 3 |
|--------|------------|------------|------------|
| Initial Load | [ms] | [ms] | [ms] |
| Operation Latency | [ms] | [ms] | [ms] |
| Memory Usage | [MB] | [MB] | [MB] |
| Bundle Size Impact | [+KB] | [+KB] | [+KB] |
```

### Complexity Metrics

```markdown
| Metric | Approach 1 | Approach 2 | Approach 3 |
|--------|------------|------------|------------|
| Lines of Code | [count] | [count] | [count] |
| Setup Time | [min] | [min] | [min] |
| Learning Curve | Easy/Med/Hard | Easy/Med/Hard | Easy/Med/Hard |
| Dependencies | [count] | [count] | [count] |
```

### Maintainability Metrics

```markdown
| Metric | Approach 1 | Approach 2 | Approach 3 |
|--------|------------|------------|------------|
| Documentation | Good/Fair/Poor | Good/Fair/Poor | Good/Fair/Poor |
| TypeScript Support | Full/Partial/None | Full/Partial/None | Full/Partial/None |
| Community Size | [stars/downloads] | [stars/downloads] | [stars/downloads] |
| Last Updated | [date] | [date] | [date] |
```
