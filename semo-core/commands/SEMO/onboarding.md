# /SEMO:onboarding

새 프로젝트에 SEMO를 설치하거나, 새 팀원을 위한 온보딩 가이드를 제공합니다.

## 사용법

```
/SEMO:onboarding
```

## 동작

SEMO 설치 및 온보딩 워크플로우를 안내합니다.

## 온보딩 유형

### 1. 새 프로젝트 설치

```
[SEMO] Onboarding: 새 프로젝트 설치

📦 설치 명령:
npx @team-semicolon/semo-cli add

📋 설치 옵션:
  - Standard: semo-core + semo-skills (기본)
  - Extension: biz/management, eng/nextjs 등

💡 설치 후 Claude Code를 재시작하세요.
```

### 2. 새 팀원 온보딩

```
[SEMO] Onboarding: 새 팀원 가이드

📚 필독 문서:
1. .claude/CLAUDE.md - SEMO 기본 설정
2. semo-system/semo-core/principles/PRINCIPLES.md - 원칙
3. semo-system/semo-skills/ - 사용 가능한 스킬

🎯 시작하기:
- "도움말" 또는 /SEMO:help 입력
- 자연어로 요청하면 SEMO가 적절한 스킬로 라우팅

💡 팁:
- Git 작업: "커밋해줘", "PR 만들어줘"
- 코드 작성: "로그인 기능 만들어줘"
- 테스트: "테스트 작성해줘"
```

## 설치 흐름

```
1. npx @team-semicolon/semo-cli add
2. 패키지 선택 (Standard / Extension)
3. .claude/ 디렉토리 생성
4. semo-system/ 파일 설치
5. Claude Code 재시작
6. /SEMO:help로 시작
```

## 참조

- [SEMO CLI](https://www.npmjs.com/package/@team-semicolon/semo-cli)
- [SEMO 원칙](semo-system/semo-core/principles/PRINCIPLES.md)
