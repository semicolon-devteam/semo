# AI Readability 코드 표준 (Core)

> 언어/프레임워크 중립적 원칙 — AI와 사람 모두를 위한 코드

---

## 왜 AI Readability인가

AI 코딩 어시스턴트(Claude, Cursor, Copilot 등)는 **컨텍스트 윈도우** 내에 파일이 통째로 들어와야 정확하게 동작한다. 파일이 2,000줄을 넘으면:

- AI가 파일 전체를 읽지 못해 누락이 발생한다
- 잘못된 패턴을 학습하거나 기존 코드를 중복 생성한다
- 리뷰어(인간)도 파악하기 어려워 버그가 숨는다

**이 표준은 AI와 사람이 모두 읽기 쉬운 코드를 만들기 위한 규칙이다.**

### 연구 근거

- **Atlassian 연구 (ICSME'25)**: 개발자 81%가 LLM 시대에도 코드 가독성이 중요하다고 응답
- **Ken Erwin (2025)**: LLM-Optimized 코드는 Standard 대비 44% 더 많은 토큰 사용하지만, 정확도와 유지보수성 향상
- **CodeScene (2025)**: Code Health 9.5+ 코드에서 AI 성능이 유의미하게 향상

---

## 1. 파일 크기 제한

| 대상 | 제한 | 비고 |
|------|------|------|
| 컴포넌트/모듈 파일 | **600줄** | 초과 시 모듈 분리 |
| 서비스/유틸리티 파일 | **600줄** | 초과 시 도메인별 분리 |
| 설정/스타일 파일 | **300줄** | 독립 파일 권장 |

### 파일 분리 패턴 (예시)

```
src/{domain}/
├── components/
│   └── MainComponent.tsx     ← 메인 로직만 (≤600줄)
├── hooks/
│   └── useData.ts            ← 데이터 페칭 & 상태
├── utils/
│   └── helpers.ts            ← 유틸리티 함수
└── styles/
    └── styles.ts             ← 스타일 정의
```

---

## 2. 함수 복잡도 규칙

### 2-1. 함수 길이

| 기준 | 제한 |
|------|------|
| 메인 함수 (컴포넌트/컨트롤러) | **100줄** |
| 이벤트 핸들러 | **50줄** |
| 유틸리티 함수 | **30줄** |
| 헬퍼 함수 | **80줄** |

### 2-2. 사이클로매틱 복잡도

> **최대 15** — if/else, switch, &&, ||, ? 등의 분기 합계

복잡도가 높은 함수는 단계별로 분리한다:

```typescript
// Bad - 복잡도 20+
const handleSubmit = async () => {
  if (isLoading) return;
  if (!user) { ... }
  if (balance < price) {
    if (isVip) { ... }
    else { ... }
  }
  try {
    if (type === 'A') { ... }
    else if (type === 'B') { ... }
    else { ... }
  } catch (e) {
    if (e.code === 'X') { ... }
    else if (e.code === 'Y') { ... }
  }
};

// Good - 각 단계를 별도 함수로 분리
const validateSubmit = (): boolean => { ... };     // 복잡도 3
const executeSubmit = async (type: string) => { ... }; // 복잡도 4
const handleSubmitError = (e: Error) => { ... };   // 복잡도 3

const handleSubmit = async () => {
  if (!validateSubmit()) return;
  try {
    await executeSubmit(type);
  } catch (e) {
    handleSubmitError(e);
  }
};
```

### 2-3. 중첩 깊이

> **최대 5단계** — 중첩이 깊으면 early return으로 평탄화

```typescript
// Bad - 중첩 6단계
if (user) {
  if (club) {
    if (isManager) {
      for (const member of members) {
        if (member.active) {
          if (member.rate > 0) {
            // 여기는 6단계
          }
        }
      }
    }
  }
}

// Good - early return으로 평탄화
if (!user || !club || !isManager) return;

for (const member of members) {
  if (!member.active || member.rate <= 0) continue;
  // 여기는 2단계
}
```

### 2-4. 함수 파라미터

> **최대 4개** — 초과 시 객체로 묶기

```typescript
// Bad - 파라미터 6개
const updateMember = (id: string, name: string, rate: number, active: boolean, role: string, clubId: string) => { ... };

// Good - 객체로 묶기
interface UpdateMemberParams {
  id: string;
  name: string;
  rate: number;
  active: boolean;
  role: string;
  clubId: string;
}
const updateMember = (params: UpdateMemberParams) => { ... };
```

---

## 3. Import 규칙

### 3-1. 절대경로 사용

3단계 이상 상대경로 (`../../../`) 금지. 프로젝트별 alias (`@/`, `~/`) 사용:

```typescript
// Bad
import { COLORS } from '../../../constants/theme';
import { apiService } from '../../../services/api.service';

// Good
import { COLORS } from '@/constants/theme';
import { apiService } from '@/services/api.service';
```

`./`, `../` (1-2단계)는 같은 도메인 내 파일 참조에 허용.

---

## 4. 타입 규칙 (TypeScript)

### 4-1. interface 우선 사용

`type` 대신 `interface`를 사용 (확장 가능성):

```typescript
// Bad
type UserProfile = { id: string; name: string; };

// Good
interface UserProfile { id: string; name: string; }
```

### 4-2. type import

타입만 import할 때는 `import type` 또는 `import { type ... }`:

```typescript
// Good
import type { User } from '@/types';
import { type User, apiService } from '@/services/api.service';
```

### 4-3. any 금지

`any` 타입은 최소화. 불가피한 경우 명시적 주석:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData = response as any;
```

---

## 5. 주석 규칙

### 5-1. TODO/FIXME 주석 금지

`TODO`, `FIXME`, `HACK`, `XXX` 주석은 **금지**. 미완성 코드는 GitHub Issue로 관리:

```typescript
// Bad
// TODO: 나중에 구현하기
// FIXME: 이거 버그 있음

// Good
// (이슈 #123 참조) 현재는 더미 구현
```

### 5-2. 주석이 필요한 경우

로직이 자명하지 않을 때만 주석:

```typescript
// Good - 이유가 불명확한 동작 설명
// 버그 방어: 일부 환경에서 값이 0을 반환하는 경우 처리
if (value === 0 && isLegacyEnv) { ... }

// Bad - 코드 자체가 설명하는 내용
// 로딩 상태를 true로 설정
setLoading(true);
```

---

## 6. 파일 레벨 문서화 (LLM Context Headers)

각 파일 상단에 **컨텍스트 헤더** 추가:

```typescript
/**
 * @module UserService
 * @description 사용자 인증 및 프로필 관리
 * @dependencies AuthProvider, UserRepository
 * @business-rules
 *  - 이메일 검증 후 로그인 허용
 *  - 세션은 24시간 유지
 * @tech-debt
 *  - 현재 단일 DB 커넥션 → 커넥션 풀로 리팩토링 예정 (이슈 #456)
 */
```

**필수 필드**:
- `@module`: 모듈명
- `@description`: 간단한 설명
- `@dependencies`: 의존성 (옵션)
- `@business-rules`: 비즈니스 규칙 (옵션)
- `@tech-debt`: 기술 부채 (옵션)

---

## 7. 섹션 마커 (Semantic Grouping)

명시적 섹션으로 구조 표시:

```typescript
// ═══════════════════════════════════════
// State Management
// ═══════════════════════════════════════
const [isConnected, setIsConnected] = useState(false);
const [error, setError] = useState<Error | null>(null);

// ═══════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════
const handleConnect = useCallback(() => { ... }, []);
const handleDisconnect = useCallback(() => { ... }, []);

// ═══════════════════════════════════════
// Effects
// ═══════════════════════════════════════
useEffect(() => { ... }, []);
```

---

## 8. Relationship Markers

함수 간 관계 명시:

```typescript
// @relates-to UserController.login()
// @called-by AuthMiddleware.verify()
// @depends-on UserRepository.findByEmail()
const authenticateUser = async (email: string, password: string) => {
  // ...
};
```

**주요 마커**:
- `@relates-to`: 관련 함수/모듈
- `@called-by`: 호출자
- `@depends-on`: 의존 함수
- `@calls`: 호출 대상

---

## 9. ESLint 설정 (권장)

```json
{
  "rules": {
    // 파일/함수 크기
    "max-lines": ["warn", { "max": 600, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["warn", { "max": 100, "skipBlankLines": true, "skipComments": true }],
    "complexity": ["warn", { "max": 15 }],
    "max-params": ["warn", { "max": 4 }],
    "max-depth": ["warn", { "max": 5 }],

    // 주석 규율
    "no-warning-comments": ["error", { "terms": ["TODO", "FIXME", "HACK", "XXX"] }],

    // Import
    "import/no-duplicates": "error",
    "no-restricted-imports": ["error", { "patterns": [{ "group": ["../../../*"] }] }],

    // TypeScript
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

---

## 10. Code Health 기준

**AI-Ready 코드 기준** (CodeScene 연구 기반):

- **Code Health 점수**: 9.5+ (10.0 만점)
- **Maintainability Index**: 65+ (0-100 스케일)
- **Comment Ratio**: 10-20% (과도한 주석은 오히려 방해)
- **Halstead Difficulty**: 15 이하

**원칙**:
- Code Health 9.5 미만 코드는 **refactor 먼저** → 이후 feature 작업
- AI 생성 코드도 동일한 기준 적용

---

## 11. llms.txt 표준

프로젝트 루트에 `public/llms.txt` 생성 (LLM용 문서 인덱스):

```
프로젝트/
├── public/
│   └── llms.txt          # LLM용 문서 인덱스
├── docs/
│   ├── api-reference.md
│   └── guides/
```

**llms.txt 예시**:

```markdown
# 프로젝트명

> 프로젝트 설명 — 기술 스택

## 주요 문서
- [API 레퍼런스](/docs/api-reference.md)
- [아키텍처 가이드](/docs/architecture.md)
- [코딩 컨벤션](/standards/AI-READABILITY.md)

## 예제
- [인증 플로우](/examples/auth-flow.ts)
- [데이터 페칭](/examples/data-fetching.ts)
```

---

## 12. 체크리스트

PR 생성 전 확인:

- [ ] 수정한 파일이 600줄 이하인가?
- [ ] 새로 작성한 함수가 100줄 이하인가?
- [ ] `../../../` 이상의 상대경로를 쓰지 않았는가?
- [ ] `TODO`/`FIXME` 주석이 없는가?
- [ ] `interface` 대신 `type`을 쓰지 않았는가? (TypeScript)
- [ ] 파일 상단에 Context Header가 있는가?
- [ ] 주요 섹션에 Semantic Grouping 마커가 있는가?
- [ ] `lint` + 타입 체크 통과했는가?

---

## 프레임워크별 추가 규칙

이 문서는 **언어/프레임워크 중립적 코어 규칙**입니다. 프레임워크별 추가 규칙은 아래 문서 참조:

- [React/Next.js 규칙](./AI-READABILITY-REACT.md)
- [React Native 규칙](./AI-READABILITY-RN.md)
- [Node.js 백엔드 규칙](./AI-READABILITY-NODE.md)

---

## 참고 자료

- [The End of Human-Readable Code (Medium, 2025)](https://pixelmap.medium.com/the-end-of-human-readable-code-its-time-to-write-for-ai-15a21786c4a2)
- [Atlassian Research: Code Readability in the Age of LLMs (ICSME'25)](https://www.atlassian.com/blog/artificial-intelligence/atlassian-research-developers-on-code-readibility-llm)
- [Agentic AI Coding Best Practices (CodeScene, 2025)](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality)
- [Optimizing Technical Documentation for LLMs (dev.to, 2025)](https://dev.to/joshtom/optimizing-technical-documentations-for-llms-4bcd)
- [llms.txt Standard](https://llmstxt.org/)
