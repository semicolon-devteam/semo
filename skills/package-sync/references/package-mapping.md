# Package Mapping

> docs 레포지토리 내 SAX 패키지 경로 매핑

## 패키지별 경로

### SAX-PO

```
소스: sax/packages/sax-po/
대상: .claude/sax-po/

동기화 대상:
├── CLAUDE.md
├── agents/
│   ├── orchestrator.md
│   ├── epic-master.md
│   ├── epic-master/
│   ├── draft-task-creator.md
│   ├── draft-task-creator/
│   ├── spec-writer.md
│   ├── onboarding-master.md
│   └── teacher.md
├── skills/
│   ├── health-check/
│   ├── create-epic/
│   ├── check-team-codex/
│   └── ... (12+ skills)
├── commands/
│   ├── onboarding.md
│   ├── health-check.md
│   └── help.md
└── templates/
    └── epic-template.md
```

### SAX-Meta

```
소스: sax/packages/sax-meta/
대상: .claude/sax-meta/

동기화 대상:
├── CLAUDE.md
├── agents/
│   ├── orchestrator.md
│   ├── agent-manager/
│   ├── skill-manager/
│   ├── command-manager/
│   └── sax-architect.md
├── skills/
│   ├── package-validator/
│   ├── version-manager/
│   ├── package-sync/
│   └── package-deploy/
└── templates/
    ├── agent-template.md
    ├── skill-template/
    └── package-template/
```

## 동기화 제외 항목

```bash
--exclude='.git'
--exclude='.DS_Store'
--exclude='*.swp'
--exclude='*.bak'
```

## 동기화 명령 매트릭스

| 패키지 | 명령어 |
|--------|--------|
| sax-po | `rsync -av --delete --exclude='.git' sax/packages/sax-po/ .claude/sax-po/` |
| sax-meta | `rsync -av --delete --exclude='.git' sax/packages/sax-meta/ .claude/sax-meta/` |
| 전체 | 위 명령어 순차 실행 |

## 외부 배포 패키지

> 다음 패키지는 docs 내부 동기화 대상이 **아닙니다**.

| 패키지 | 배포 대상 | 배포 방법 |
|--------|----------|----------|
| sax-next | cm-template, cm-* | `package-deploy` Skill 사용 |
| sax-core | command-center | `package-deploy` Skill 사용 |
| sax-spring | core-backend | (예정) |
