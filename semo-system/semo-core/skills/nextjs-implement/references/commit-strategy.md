# Commit Strategy Reference

## Atomic Commits (작업 단위 최소화)

### Phase별 커밋 시점

- **v0.0.x CONFIG**: 의존성 설치 후 커밋
- **v0.1.x PROJECT**: 각 도메인 디렉토리 생성 후 커밋
- **v0.2.x TESTS**: 레이어별 테스트 작성 후 커밋 (Repository, Hooks, Components 각각)
- **v0.3.x DATA**: 모델/타입 정의 후 커밋
- **v0.4.x CODE**: 레이어별 구현 후 커밋 (Repository, API Client, Hooks, Components 각각)

### Commit Message Format

**📚 Reference**: [Git Rules - Commit Messages](https://github.com/semicolon-devteam/docs/wiki/rules-git)

- 규칙 상세 내용은 위 링크 참조 (GIT-CM-xxx rules)
- 커밋 전 반드시 Git Rules 문서 확인

### 커밋 전 체크리스트

1. `npm run lint` 통과
2. `npx tsc --noEmit` 통과
3. 관련 테스트 통과
4. 커밋 메시지 형식 준수
5. `--no-verify` 사용 금지

## Error Handling

If any phase fails:

1. Report specific failure to agent
2. Provide diagnostic information
3. Suggest remediation
4. Do not proceed to next phase
5. Agent decides rollback or fix strategy

## Resume Capability

If interrupted, skill can resume from specific phase:

```javascript
skill: implement({ resume: "v0.3.x" });
```

## Constitution Compliance

- **Principle I**: DDD Architecture (4-layer structure)
- **Principle II**: SSR-First Development
- **Principle III**: Test-Driven Quality (v0.2.x before v0.4.x) (NON-NEGOTIABLE)
- **Principle VIII**: Spec-Driven Development
- **Principle IX**: Agent-Driven Collaboration (phased execution)
