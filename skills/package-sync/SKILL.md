---
name: package-sync
description: SAX 패키지 소스와 .claude/ 동기화 자동화. Use when (1) Agent/Skill/Command 변경 후 동기화, (2) 버저닝 완료 후 배포 준비, (3) docs 레포 내 패키지 활성화.
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: package-sync 호출 - {대상 패키지}` 시스템 메시지를 첫 줄에 출력하세요.

# package-sync Skill

> SAX 패키지 소스 → .claude/ 디렉토리 동기화 자동화

## Purpose

`sax/packages/{package}/` 소스를 `.claude/{package}/`로 동기화하여 SAX 패키지를 활성화합니다.

**docs 레포지토리 전용 Skill**입니다.

## Quick Start

```bash
# SAX-PO 동기화
rsync -av --delete --exclude='.git' \
  sax/packages/sax-po/ \
  .claude/sax-po/

# SAX-Meta 동기화
rsync -av --delete --exclude='.git' \
  sax/packages/sax-meta/ \
  .claude/sax-meta/

# 동기화 결과 확인
ls -la .claude/sax-po/
ls -la .claude/sax-meta/
```

## Supported Packages

| 패키지 | 소스 경로 | 대상 경로 | 비고 |
|--------|----------|----------|------|
| sax-po | `sax/packages/sax-po/` | `.claude/sax-po/` | PO/기획자용 |
| sax-meta | `sax/packages/sax-meta/` | `.claude/sax-meta/` | SAX 개발용 |

> ⚠️ **sax-next**는 docs 레포에서 동기화하지 않습니다. 외부 프로젝트에 직접 배포합니다.

## SAX Message

```markdown
[SAX] Skill: package-sync 실행

[SAX] Sync: {package} 동기화 완료 ({file_count}개 파일)
```

## Related

- [package-deploy Skill](../package-deploy/SKILL.md) - 외부 프로젝트 배포
- [version-manager Skill](../version-manager/SKILL.md) - 버저닝 후 동기화
- [sax-architect Agent](../../agents/sax-architect.md)

## References

For detailed documentation, see:

- [Sync Workflow](references/sync-workflow.md) - 동기화 프로세스 상세
- [Package Mapping](references/package-mapping.md) - 패키지별 경로 매핑
- [Output Format](references/output-format.md) - 성공/실패 출력 형식
