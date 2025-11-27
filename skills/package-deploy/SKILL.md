---
name: package-deploy
description: SAX 패키지를 외부 프로젝트에 배포. Use when (1) 새 프로젝트에 SAX 설치, (2) 기존 프로젝트 SAX 업데이트, (3) 브라운필드 프로젝트 SAX 도입.
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: package-deploy 호출 - {패키지} → {대상}` 시스템 메시지를 첫 줄에 출력하세요.

# package-deploy Skill

> SAX 패키지를 외부 프로젝트에 배포하는 자동화 Skill

## Purpose

`sax/packages/{package}/`를 외부 프로젝트의 `.claude/` 디렉토리에 배포합니다.

## Quick Start

```bash
# 방법 1: deploy.sh 스크립트 사용 (권장)
./sax/scripts/deploy.sh sax-next /path/to/target-project

# 방법 2: 업데이트 모드
./sax/scripts/deploy.sh sax-next /path/to/target-project --update

# 방법 3: 수동 배포
mkdir -p /path/to/project/.claude/agents
mkdir -p /path/to/project/.claude/skills
cp -r sax/packages/sax-next/agents/* /path/to/project/.claude/agents/
cp -r sax/packages/sax-next/skills/* /path/to/project/.claude/skills/
```

## Supported Packages

| 패키지 | 대상 프로젝트 | 용도 |
|--------|-------------|------|
| sax-core | command-center | 공통 규칙 |
| sax-next | cm-template, cm-* | Next.js 개발 |
| sax-spring | core-backend | Spring 개발 (예정) |

## Deployment Options

| 옵션 | 설명 | 사용 시점 |
|------|------|----------|
| 기본 | 전체 덮어쓰기 | 신규 설치 |
| `--update` | 버전 비교 후 업데이트 | 기존 설치 업데이트 |

## SAX Message

```markdown
[SAX] Skill: package-deploy 실행

[SAX] Deploy: {package} → {target_path} 배포 완료 (v{version})
```

## Related

- [package-sync Skill](../package-sync/SKILL.md) - docs 내부 동기화
- [version-manager Skill](../version-manager/SKILL.md) - 버저닝
- [deploy.sh Script](../../../scripts/deploy.sh) - 배포 스크립트

## References

For detailed documentation, see:

- [Deploy Workflow](references/deploy-workflow.md) - 배포 프로세스 상세
- [Target Setup](references/target-setup.md) - 대상 프로젝트 설정
- [Output Format](references/output-format.md) - 성공/실패 출력 형식
