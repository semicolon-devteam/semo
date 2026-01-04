# Epic Creation

If no Epic exists, create one:

## Epic Title

```text
[Feature Name] - [Short Description]
```

Example: `Add comment functionality - Users can comment on posts`

## Epic Body

```markdown
# Feature: Add comment functionality

## 📋 Description

Users can add, edit, delete comments on posts with real-time updates.

## 🎯 Goals

- Comment CRUD operations
- Real-time comment updates
- Comment author information
- Reply threading (future)

## 📚 Related Documents

- [Spec](https://github.com/{owner}/{repo}/blob/dev/specs/5-comments/spec.md)
- [Plan](https://github.com/{owner}/{repo}/blob/dev/specs/5-comments/plan.md)
- [Tasks](https://github.com/{owner}/{repo}/blob/dev/specs/5-comments/tasks.md)

## 📊 Progress

- [ ] v0.0.x CONFIG (1 task)
- [ ] v0.1.x PROJECT (1 task)
- [ ] v0.2.x TESTS (3 tasks)
- [ ] v0.3.x DATA (1 task)
- [ ] v0.4.x CODE (9 tasks)

**Total Tasks**: 15

## 🔗 Sub-Issues

[Auto-updated by skill:create-issues]

- #145: [v0.0.x CONFIG] Check dependencies
- #146: [v0.1.x PROJECT] Scaffold domain structure
- ...

---

🤖 Generated with Claude Code
```

> **Note**: Epic의 Related Documents 링크는 dev 브랜치 고정 (SDD 워크플로우 필수)

## Epic Labels

- `epic`
- `domain:[domain]`
- `milestone:[version]`

## GitHub Issue Type 설정 (필수)

Epic 생성 시 반드시 Issue Type을 "Epic"으로 설정:

```bash
# Issue Type ID Reference
# Epic: IT_kwDOC01-Rc4BvVz5

gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'$ISSUE_NODE_ID'"
      issueTypeId: "IT_kwDOC01-Rc4BvVz5"
    }) {
      issue { id title }
    }
  }
'
```
