# SEMO 메타데이터 스키마

> SEMO 패키지 간 일관된 사용자 메타데이터 구조 정의

## 목적

- 모든 SEMO 패키지에서 동일한 메타데이터 구조 사용
- 온보딩 완료 상태 추적 자동화
- health-check Skill에서 표준 구조 검증
- 패키지별 특수 필드 확장 가능

## 메타데이터 저장 위치

**파일**: `~/.claude.json`

**저장 방법**:
```bash
# 메타데이터 추가/업데이트
jq '.SEMO = {
  "role": "fulltime",
  "position": "developer",
  "boarded": true,
  "boardedAt": "2025-12-09T10:30:00Z",
  "healthCheckPassed": true,
  "lastHealthCheck": "2025-12-09T10:30:00Z"
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json

# 메타데이터 조회
cat ~/.claude.json | jq '.SEMO'
```

---

## 표준 스키마 구조

### 필수 필드

```json
{
  "SEMO": {
    "role": "fulltime" | "parttime" | "contractor",
    "position": "developer" | "po" | "designer" | "qa" | "pm" | "backend" | "infra" | "msa",
    "boarded": true | false,
    "boardedAt": "ISO 8601 timestamp",
    "healthCheckPassed": true | false,
    "lastHealthCheck": "ISO 8601 timestamp"
  }
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `role` | `string` | ✅ | 근무 형태 | `"fulltime"`, `"parttime"`, `"contractor"` |
| `position` | `string` | ✅ | 직무/역할 | `"developer"`, `"po"`, `"qa"`, `"backend"`, `"pm"`, `"infra"`, `"designer"`, `"msa"` |
| `boarded` | `boolean` | ✅ | 온보딩 완료 여부 | `true`, `false` |
| `boardedAt` | `string` | ✅ | 온보딩 완료 시각 (ISO 8601) | `"2025-12-09T10:30:00Z"` |
| `healthCheckPassed` | `boolean` | ✅ | health-check 통과 여부 | `true`, `false` |
| `lastHealthCheck` | `string` | ✅ | 마지막 health-check 시각 (ISO 8601) | `"2025-12-09T10:30:00Z"` |

### 선택 필드 (패키지별 특수 필드)

```json
{
  "SEMO": {
    ...필수 필드,
    "packageSpecific": {
      // 패키지별 추가 필드
    }
  }
}
```

---

## 역할별 position 값

| 역할 | `position` 값 | 사용 패키지 |
|------|--------------|------------|
| 프론트엔드/풀스택 개발자 | `"developer"` | semo-next |
| PO/기획자 | `"po"` | semo-po |
| 디자이너 | `"designer"` | semo-design |
| QA/테스터 | `"qa"` | semo-qa |
| 백엔드 개발자 | `"backend"` | semo-backend |
| PM (Project Manager) | `"pm"` | semo-pm |
| 인프라 엔지니어 | `"infra"` | semo-infra |
| MSA 개발자 | `"msa"` | semo-ms |

---

## 패키지별 특수 필드 (packageSpecific)

### semo-pm (PM)

```json
{
  "SEMO": {
    ...필수 필드,
    "packageSpecific": {
      "githubProjectsAuth": true
    }
  }
}
```

**필드 설명**:
- `githubProjectsAuth`: GitHub Projects 접근 권한 (project scope) 보유 여부

### semo-design (디자이너)

```json
{
  "SEMO": {
    ...필수 필드,
    "packageSpecific": {
      "antigravitySetup": false,
      "mcpServers": {
        "magic": true,
        "framelink": false,
        "playwright": true
      }
    }
  }
}
```

**필드 설명**:
- `antigravitySetup`: Antigravity 설정 완료 여부 (선택)
- `mcpServers`: MCP 서버 설정 상태
  - `magic`: UI 컴포넌트 생성 MCP
  - `framelink`: Figma 연동 MCP
  - `playwright`: 브라우저 자동화 MCP

---

## 온보딩 완료 시 메타데이터 업데이트

각 패키지의 `onboarding-master` Agent는 온보딩 완료 시 메타데이터를 업데이트해야 합니다.

### 예시: semo-next (개발자)

```bash
# Phase 5: 온보딩 완료 시
jq '.SEMO = {
  "role": "fulltime",
  "position": "developer",
  "boarded": true,
  "boardedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "healthCheckPassed": true,
  "lastHealthCheck": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json
```

### 예시: semo-pm (PM)

```bash
# Phase 5: 온보딩 완료 시
jq '.SEMO = {
  "role": "fulltime",
  "position": "pm",
  "boarded": true,
  "boardedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "healthCheckPassed": true,
  "lastHealthCheck": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "packageSpecific": {
    "githubProjectsAuth": true
  }
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json
```

---

## health-check Skill 검증 로직

모든 패키지의 `health-check` Skill은 메타데이터 구조를 검증해야 합니다.

### 검증 항목

```bash
# 1. SEMO 필드 존재 확인
cat ~/.claude.json | jq -e '.SEMO' >/dev/null 2>&1 || echo "❌ SEMO 메타데이터 없음"

# 2. 필수 필드 검증
REQUIRED_FIELDS=("role" "position" "boarded" "boardedAt" "healthCheckPassed" "lastHealthCheck")

for field in "${REQUIRED_FIELDS[@]}"; do
  cat ~/.claude.json | jq -e ".SEMO.$field" >/dev/null 2>&1 || echo "❌ 필수 필드 누락: $field"
done

# 3. position 값 검증
POSITION=$(cat ~/.claude.json | jq -r '.SEMO.position')
VALID_POSITIONS=("developer" "po" "designer" "qa" "pm" "backend" "infra" "msa")

if [[ ! " ${VALID_POSITIONS[@]} " =~ " ${POSITION} " ]]; then
  echo "❌ 잘못된 position 값: $POSITION"
fi

# 4. ISO 8601 타임스탬프 검증
BOARDED_AT=$(cat ~/.claude.json | jq -r '.SEMO.boardedAt')
date -d "$BOARDED_AT" >/dev/null 2>&1 || echo "❌ 잘못된 boardedAt 형식"

LAST_HEALTH_CHECK=$(cat ~/.claude.json | jq -r '.SEMO.lastHealthCheck')
date -d "$LAST_HEALTH_CHECK" >/dev/null 2>&1 || echo "❌ 잘못된 lastHealthCheck 형식"
```

### 검증 결과 출력

**성공 시**:
```markdown
✅ SEMO 메타데이터: 정상
  - role: fulltime
  - position: developer
  - boarded: true
  - boardedAt: 2025-12-09T10:30:00Z
  - healthCheckPassed: true
  - lastHealthCheck: 2025-12-09T10:30:00Z
```

**실패 시**:
```markdown
❌ SEMO 메타데이터: 오류 발견

**문제**:
- ❌ 필수 필드 누락: boardedAt
- ❌ 잘못된 position 값: dev (올바른 값: developer)

**해결**:
온보딩 프로세스를 완료하거나 `/SEMO:onboarding`을 실행하세요.
```

---

## 재검증 정책

### health-check 재실행 조건

```bash
# 마지막 health-check로부터 30일 경과 여부 확인
LAST_CHECK=$(cat ~/.claude.json | jq -r '.SEMO.lastHealthCheck')
LAST_CHECK_EPOCH=$(date -d "$LAST_CHECK" +%s)
NOW_EPOCH=$(date +%s)
DIFF_DAYS=$(( ($NOW_EPOCH - $LAST_CHECK_EPOCH) / 86400 ))

if [ $DIFF_DAYS -gt 30 ]; then
  echo "⚠️ health-check 재실행 필요 (마지막 실행: ${DIFF_DAYS}일 전)"
  # health-check Skill 자동 호출
fi
```

### health-check 성공 시 메타데이터 업데이트

```bash
# lastHealthCheck 업데이트
jq '.SEMO.healthCheckPassed = true | .SEMO.lastHealthCheck = "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"' \
  ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json
```

---

## 마이그레이션 가이드

### 기존 메타데이터 구조 → 표준 구조

기존에 다른 구조를 사용하던 경우:

```bash
# 1. 현재 메타데이터 백업
cp ~/.claude.json ~/.claude.json.backup

# 2. 표준 구조로 마이그레이션
jq '.SEMO = {
  "role": (.SEMO.role // "fulltime"),
  "position": (.SEMO.position // "developer"),
  "boarded": (.SEMO.boarded // false),
  "boardedAt": (.SEMO.boardedAt // "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"),
  "healthCheckPassed": (.SEMO.healthCheckPassed // false),
  "lastHealthCheck": (.SEMO.lastHealthCheck // "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"),
  "packageSpecific": (.SEMO.packageSpecific // {})
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json

# 3. 검증
cat ~/.claude.json | jq '.SEMO'
```

---

## TypeScript 타입 정의 (참고)

```typescript
interface SAXMetadata {
  role: 'fulltime' | 'parttime' | 'contractor';
  position: 'developer' | 'po' | 'designer' | 'qa' | 'pm' | 'backend' | 'infra' | 'msa';
  boarded: boolean;
  boardedAt: string; // ISO 8601 timestamp
  healthCheckPassed: boolean;
  lastHealthCheck: string; // ISO 8601 timestamp
  packageSpecific?: PackageSpecificMetadata;
}

interface PackageSpecificMetadata {
  // semo-pm
  githubProjectsAuth?: boolean;

  // semo-design
  antigravitySetup?: boolean;
  mcpServers?: {
    magic?: boolean;
    framelink?: boolean;
    playwright?: boolean;
  };
}

interface ClaudeConfig {
  SAX: SAXMetadata;
  // ...other fields
}
```

---

## JSON Schema (참고)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "SEMO": {
      "type": "object",
      "required": ["role", "position", "boarded", "boardedAt", "healthCheckPassed", "lastHealthCheck"],
      "properties": {
        "role": {
          "type": "string",
          "enum": ["fulltime", "parttime", "contractor"]
        },
        "position": {
          "type": "string",
          "enum": ["developer", "po", "designer", "qa", "pm", "backend", "infra", "msa"]
        },
        "boarded": {
          "type": "boolean"
        },
        "boardedAt": {
          "type": "string",
          "format": "date-time"
        },
        "healthCheckPassed": {
          "type": "boolean"
        },
        "lastHealthCheck": {
          "type": "string",
          "format": "date-time"
        },
        "packageSpecific": {
          "type": "object"
        }
      }
    }
  }
}
```

---

## 관련 문서

- [SEMO Core PRINCIPLES.md](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
- 각 패키지 `onboarding-master` Agent
- 각 패키지 `health-check` Skill
