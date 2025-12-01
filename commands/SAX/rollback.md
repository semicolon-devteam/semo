# /SAX:rollback

> 서비스 롤백 명령

## 사용법

```
/SAX:rollback <environment> <service> [target_tag]
```

## 파라미터

| 파라미터 | 필수 | 설명 | 기본값 |
|----------|------|------|--------|
| environment | ✅ | 환경 | - |
| service | ✅ | 서비스 이름 | - |
| target_tag | ❌ | 롤백 대상 태그 | 이전 버전 |

## 예시

```
/SAX:rollback stg cm-land              # 이전 버전으로 롤백
/SAX:rollback stg cm-land v1.2.2       # 특정 버전으로 롤백
/SAX:rollback dev land-backend         # dev land-backend 롤백
```

## 실행 흐름

```text
1. 현재 태그 확인
2. 이전/대상 태그 확인
3. rollback-service → 롤백 실행
4. 헬스체크 확인
```

## 출력

```markdown
[SAX] Command: /SAX:rollback {environment} {service} {target_tag}

[SAX] Skill 호출: rollback-service

✅ **롤백 완료**

환경: `{environment}`
서비스: `{service}`
이전 태그: `{old_tag}`
현재 태그: `{target_tag}`
상태: running
```

## 롤백 대상 찾기

```bash
# 최근 이미지 태그 목록
docker images semicolonmanager/{service} --format "{{.Tag}}" | head -5

# Git 로그에서 이전 태그
git log --oneline -p -- .env.stg | grep "_TAG=" | head -5
```

## 주의사항

- 데이터 마이그레이션 롤백은 별도 처리 필요
- 롤백 후 반드시 기능 테스트 수행
