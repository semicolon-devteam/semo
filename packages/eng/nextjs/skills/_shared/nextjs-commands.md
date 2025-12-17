# Next.js Commands

## Linting and Formatting

| 작업 | 명령어 | 설명 |
|------|--------|------|
| Lint | `npm run lint` | ESLint 검사 |
| Type Check | `npx tsc --noEmit` | TypeScript 타입 검사 |
| Format | `npx prettier --write .` | Prettier 포맷팅 |

## Testing

| 작업 | 명령어 | 설명 |
|------|--------|------|
| All Tests | `npm test` | 전체 테스트 실행 |
| Specific File | `npm test -- path/to/file.test.ts` | 특정 파일 테스트 |
| Coverage | `npm test -- --coverage` | 커버리지 측정 |
| Watch Mode | `npm test -- --watch` | 변경 감지 모드 |
| Pattern | `npm test -- -t "pattern"` | 패턴 매칭 테스트 |

## Development

| 작업 | 명령어 | 설명 |
|------|--------|------|
| Dev Server | `npm run dev` | 개발 서버 실행 |
| Build | `npm run build` | 프로덕션 빌드 |
| Start | `npm start` | 프로덕션 서버 |
| Storybook | `npm run storybook` | Storybook 실행 |

## Debug Code Detection

```bash
# Console.log 검색
grep -r "console\.log\|debugger" src/

# 'any' 타입 검색
grep -r ":\s*any\|as any" src/
```

## Pre-Commit Checklist

```bash
npm run lint && npx tsc --noEmit && npm test
```
