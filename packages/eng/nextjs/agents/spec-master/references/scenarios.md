# Common Scenarios

> spec-master Agent 사용 시나리오

## Scenario 1: Simple Feature (Clear Requirements)

```bash
User: /spec Add post comment functionality

You:
1. /speckit.specify Add post comment functionality
   → Creates spec.md with minimal clarifications
2. /speckit.plan
   → Maps to posts domain, defines API/DB approach
3. /speckit.tasks
   → Breaks down Repository → Hooks → Components
4. Report completion with next steps
```

## Scenario 2: Complex Feature (Needs Clarification)

```bash
User: /spec Add authentication

You:
1. /speckit.specify Add authentication
   → Presents 3 clarification questions:
      Q1: OAuth2 or session-based?
      Q2: Social providers (Google, GitHub)?
      Q3: User roles (admin, user, guest)?
2. User: Q1: OAuth2, Q2: Google + GitHub, Q3: admin + user
3. speckit.specify updates spec.md
4. /speckit.plan
   → Creates auth domain structure
5. /speckit.tasks
   → Tasks for OAuth flow, user management
6. Report completion
```

## Scenario 3: Feature with Spike Needed

```bash
User: /spec Implement real-time collaboration

You:
1. /speckit.specify Implement real-time collaboration
   → Creates spec.md
2. /speckit.plan
   → Identifies WebSocket vs SSE decision point
   → Suggests spike for technical evaluation
3. Recommend user:
   "Complex technical decision detected. Consider:
   1. Run `/spike realtime-tech-evaluation` first
   2. Then continue with implementation"
```

## Scenario 4: Feature with Existing Spec

```bash
User: /spec Update user profile functionality
     (already has spec.md from previous session)

You:
1. Check specs/ directory for existing spec
2. Found: specs/user-profile/spec.md
3. Ask user:
   "Found existing spec for user-profile. Options:
   - A: Update existing spec with new requirements
   - B: Create new spec version
   - C: Start fresh with new spec"
4. User selects option
5. Proceed accordingly
```

## Scenario 5: Incomplete Specification Recovery

```bash
User: /spec Continue with notifications feature
     (spec.md exists, plan.md missing)

You:
1. Detect incomplete spec state:
   - spec.md ✅
   - plan.md ❌
   - tasks.md ❌
2. Resume from Phase 2:
   "Resuming specification from Phase 2..."
3. /speckit.plan
4. /speckit.tasks
5. Report completion
```

## Integration Points

### With implementation-master

After spec-master completes:

```bash
/implement [domain]:[feature]
```

implementation-master will:
- Read tasks.md for work breakdown
- Execute ADD phases (v0.0.x → v0.4.x)
- Implement DDD 4-layer structure

### With quality-master

Before implementation:

```bash
/verify
```

quality-master will:
- Run `/speckit.analyze` for cross-artifact consistency
- Validate spec completeness
- Check Constitution compliance

### With spike-master

If technical approach unclear:

```bash
/spike [technical-topic]
```

spike-master will:
- Prototype different approaches
- Document findings in docs/spikes/
- Recommend approach for plan.md
