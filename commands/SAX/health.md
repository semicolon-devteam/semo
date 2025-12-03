---
description: .claude 디렉토리 검증 및 자동 수정 - sax-architecture-checker skill 호출
---

# /SAX:health

.claude 디렉토리 구조 검증 및 자동 수정

## 호출 스킬

`sax-architecture-checker`

## 사용법

```
/SAX:health
```

## 동작

1. 설치된 SAX 패키지 감지 (po, next, qa, meta, pm, backend, infra)
2. 심링크 무결성 검증 (CLAUDE.md, agents/, skills/, commands/SAX/)
3. 문제 발견 시 자동 수정 (install-sax.sh 동일 로직)
4. 결과 보고

## 관련 문서

- `sax-core/skills/sax-architecture-checker/SKILL.md`
