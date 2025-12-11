# STG URL Mapping

레포지토리별 STG 환경 URL 매핑 테이블

## 커뮤니티 프로젝트

### Land (랜드)

| 항목 | 값 |
|------|-----|
| **Repository** | `cm-land` |
| **STG URL** | https://land-stg.semi-colon.space/ |
| **설명** | 랜드 커뮤니티 서비스 |

### Office (오피스)

| 항목 | 값 |
|------|-----|
| **Repository** | `cm-office` |
| **STG URL** | https://office-stg.semi-colon.space/ |
| **설명** | 오피스 워커를 위한 커뮤니티 사이트 |

### Cointalk (코인톡)

| 항목 | 값 |
|------|-----|
| **Repository** | `cm-cointalk` |
| **STG URL** | https://cointalk-stg.semi-colon.space/ |
| **설명** | 코인톡 커뮤니티 서비스 |

### Jungchipan (정치판)

| 항목 | 값 |
|------|-----|
| **Repository** | `cm-jungchipan` |
| **STG URL** | https://jungchipan-stg.semi-colon.space/ |
| **설명** | 정치판 커뮤니티 서비스 |

## 마이크로서비스

### Crawler (크롤러)

| 항목 | 값 |
|------|-----|
| **Repository** | `ms-crawler` |
| **STG URL** | https://scrapper.semi-colon.space/dashboard |
| **설명** | 웹 컨텐츠 수집 서비스 |

### Media Processor

| 항목 | 값 |
|------|-----|
| **Repository** | `ms-media-processor` |
| **STG URL** | TBD |
| **설명** | 미디어 파일 처리 서비스 |

### Notifier

| 항목 | 값 |
|------|-----|
| **Repository** | `ms-notifier` |
| **STG URL** | N/A (백엔드 서비스) |
| **설명** | 자동화 알림 서비스 |

## 코어 패키지

### Community Core Package

| 항목 | 값 |
|------|-----|
| **Repository** | `core-community-package` |
| **STG URL** | N/A (NPM 패키지) |
| **설명** | NPM 배포용 UI 패키지 |

## 사용 방법

### 레포지토리명으로 STG URL 조회

```bash
# 예시: cm-land → https://land-stg.semi-colon.space/

REPO_NAME="cm-land"

case "$REPO_NAME" in
  "cm-land")
    STG_URL="https://land-stg.semi-colon.space/"
    ;;
  "cm-office")
    STG_URL="https://office-stg.semi-colon.space/"
    ;;
  "cm-cointalk")
    STG_URL="https://cointalk-stg.semi-colon.space/"
    ;;
  "cm-jungchipan")
    STG_URL="https://jungchipan-stg.semi-colon.space/"
    ;;
  "ms-crawler")
    STG_URL="https://scrapper.semi-colon.space/dashboard"
    ;;
  *)
    STG_URL="N/A"
    ;;
esac

echo "$STG_URL"
```

### 이슈에서 레포지토리 추출

```bash
# GitHub CLI로 이슈 정보 가져오기
ISSUE_NUMBER=123

REPO=$(gh issue view $ISSUE_NUMBER --json repository --jq '.repository.name')

# STG URL 조회
case "$REPO" in
  "cm-land")
    STG_URL="https://land-stg.semi-colon.space/"
    ;;
  *)
    STG_URL="N/A"
    ;;
esac
```

## 출력 포맷 예시

### test-queue 출력

```markdown
## 테스트 대기 중 (3건)

| 이슈 | 제목 | STG 환경 |
|------|------|----------|
| #123 | 댓글 기능 구현 | [Land STG](https://land-stg.semi-colon.space/) |
| #124 | 프로필 수정 | [Office STG](https://office-stg.semi-colon.space/) |
| #125 | 알림 설정 | N/A (백엔드) |
```

### current-tasks 출력

```markdown
### 1. #123 - 댓글 기능 구현

**STG 환경**: https://land-stg.semi-colon.space/
**Repository**: cm-land

**QA 테스트 진행 상황**:
- ✅ 댓글 작성 테스트
- ⬜ 댓글 수정 테스트
```

## 업데이트 가이드

새로운 프로젝트가 추가되면 이 파일을 업데이트해주세요:

1. 해당 섹션에 새 항목 추가
2. 레포지토리명과 STG URL 매핑
3. 스크립트의 case 문에 추가

## 참고

- STG URL은 세미콜론 팀 내부 접근만 가능합니다
- N/A: STG 환경이 없는 경우 (백엔드 서비스, NPM 패키지 등)
- TBD: STG 환경 준비 중
