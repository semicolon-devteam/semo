---
name: implement
description: Phase-gated MVP 구현 시작
---

# /SAX:implement

Phase-gated MVP 구현을 시작합니다.

## 사용법

```bash
# 처음부터 시작
/SAX:implement

# 특정 Phase부터 시작
/SAX:implement --phase=DATA
```

## 실행

`skill:implement-mvp`를 호출하여 간소화된 ADD 워크플로우를 진행합니다.

## Phases

| Version | Phase | 산출물 |
|---------|-------|--------|
| v0.0.x | SETUP | 의존성, 환경 변수 |
| v0.1.x | DOMAIN | 4-layer 폴더 구조 |
| v0.2.x | DATA | 타입, Repository |
| v0.3.x | CODE | API Client, Hooks, Components |
| v0.4.x | TEST | 테스트, 시각적 검증 |

## 프롬프트

```
[SAX] Skill: implement-mvp 호출 - MVP 구현

Phase-gated 구현을 시작합니다.
현재 Phase를 확인하고 진행합니다.
```
