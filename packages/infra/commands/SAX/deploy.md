# /SAX:deploy

> 서비스 배포 명령

## 사용법

```
/SAX:deploy [environment] [service]
```

## 파라미터

| 파라미터 | 필수 | 설명 | 기본값 |
|----------|------|------|--------|
| environment | ❌ | 배포 환경 | `stg` |
| service | ❌ | 서비스 이름 | 전체 |

## 예시

```
/SAX:deploy              # stg 전체 배포
/SAX:deploy stg          # stg 전체 배포
/SAX:deploy stg cm-land  # stg cm-land만 배포
/SAX:deploy dev          # dev 전체 배포
```

## 실행 흐름

```text
1. verify-compose → 문법 검증
2. verify-nginx → 설정 검증
3. deploy-service → 배포 실행
4. 헬스체크 확인
```

## 출력

```markdown
[SAX] Command: /SAX:deploy {environment} {service}

[SAX] Skill 호출: verify-compose
[SAX] Skill 호출: verify-nginx
[SAX] Skill 호출: deploy-service

✅ **배포 완료**

환경: `{environment}`
서비스: `{service}`
상태: running
```

## 주의사항

- 프로덕션 직접 배포 금지
- 검증 실패 시 배포 중단
- 롤백 계획 확인 필요
