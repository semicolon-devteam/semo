# /SAX:env-check

> 환경변수 검증 명령

## 사용법

```
/SAX:env-check [environment]
```

## 파라미터

| 파라미터 | 필수 | 설명 | 기본값 |
|----------|------|------|--------|
| environment | ❌ | 환경 | 전체 |

## 예시

```
/SAX:env-check           # 모든 환경 검증
/SAX:env-check stg       # stg 환경만 검증
/SAX:env-check dev       # dev 환경만 검증
```

## 실행 흐름

```text
1. 환경 파일 목록 확인
2. 필수 변수 검증
3. 환경 간 일관성 검증
4. 결과 출력
```

## 출력

```markdown
[SAX] Command: /SAX:env-check {environment}

[SAX] Skill 호출: sync-env

**환경변수 검증 결과**

### 파일별 상태
| 파일 | 변수 수 | 상태 |
|------|---------|------|
| .env.dev | 15 | ✅ |
| .env.stg | 15 | ✅ |

### 태그 변수
| 서비스 | dev | stg |
|--------|-----|-----|
| CM_LAND_TAG | latest | v1.2.3 |

상태: ✅ 정상
```

## 검증 항목

- 필수 변수 존재 여부
- 변수 값 형식 유효성
- 환경 간 변수 일관성
- 시크릿 값 존재 여부 (빈 값 체크)
