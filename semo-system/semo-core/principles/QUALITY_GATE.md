# Quality Gate

> 코드 변경이 포함된 커밋 전 반드시 통과해야 합니다.

## 필수 검증 순서

```bash
npm run lint           # 1. ESLint 검사
npx tsc --noEmit       # 2. TypeScript 타입 체크
npm run build          # 3. 빌드 검증
```

## 차단 항목

- `--no-verify` 플래그 사용 금지
- Quality Gate 우회 시도 거부
- "그냥 커밋해줘", "빌드 생략해줘" 등 거부

## 실패 시 대응

1. 에러 메시지 분석
2. 문제 파일 수정
3. Quality Gate 재실행
4. 모든 검사 통과 후 커밋
