# SEMO Business Layer (biz)

> 사업 영역: 아이템 발굴, 기획, 설계, 프로젝트 관리, PoC 검증

## Overview

Business Layer는 제품/서비스의 **기획 및 검증** 단계를 담당합니다.

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `discovery` | 아이템 발굴, 시장 조사, Epic/Task 생성 | PO, 기획자 |
| `design` | 컨셉 설계, 목업, UX 핸드오프 | 디자이너, PO |
| `management` | 일정/인력/스프린트 관리 | PM |
| `poc` | 빠른 PoC, 패스트트랙 개발 | 기획자, 개발자 |

## Routing

```
사용자 요청 분석
    ↓
┌─────────────────────────────────────────────────────┐
│ biz/discovery: 아이템, 시장조사, Epic, Task, 요구사항 │
│ biz/design: 목업, 컨셉, UX, 핸드오프, Figma         │
│ biz/management: 스프린트, 일정, 인력, 진행도        │
│ biz/poc: PoC, 빠른검증, 프로토타입, MVP             │
└─────────────────────────────────────────────────────┘
```

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `discovery` | Epic, Task, 요구사항, 아이템, 시장조사, AC, 스펙 |
| `design` | 목업, 컨셉, UX, UI, 핸드오프, Figma, 디자인 |
| `management` | 스프린트, 일정, 인력, 담당자, 진행도, 로드맵 |
| `poc` | PoC, 빠른검증, 프로토타입, 패스트트랙, MVP |

## Layer Workflow

```
discovery (발견)
    ↓ Epic/Task 정의
design (설계)
    ↓ 목업/스펙 완성
management (관리)
    ↓ 스프린트 할당
poc (검증)
    ↓ 빠른 구현 및 검증
eng/ (개발로 이관)
```

## References

- [discovery/CLAUDE.md](discovery/CLAUDE.md)
- [design/CLAUDE.md](design/CLAUDE.md)
- [management/CLAUDE.md](management/CLAUDE.md)
- [poc/CLAUDE.md](poc/CLAUDE.md)
