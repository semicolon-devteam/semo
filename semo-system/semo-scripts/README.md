# semo-scripts

> SEMO 유틸리티 스크립트 모음

## 구조

```
semo-scripts/
├── sync/                  # 동기화 스크립트
│   └── sync-submodule.sh  # 서브모듈 동기화
├── health/                # 헬스체크 스크립트
│   ├── validate-structure.sh  # .claude 구조 검증
│   └── check-versions.sh      # 버전 확인
├── deploy/                # 배포 관련 스크립트
│   ├── validate-package.sh    # 패키지 검증
│   └── bump-version.sh        # 버전 증가
├── scaffold/              # 템플릿 생성 스크립트
│   ├── create-skill.sh        # 새 스킬 생성
│   └── create-agent.sh        # 새 에이전트 생성
└── test/                  # 테스트 스크립트
    └── run-skill-tests.sh     # 스킬 테스트 실행
```

## 사용법

### 동기화

```bash
# 서브모듈 동기화
./semo-scripts/sync/sync-submodule.sh
```

### 헬스체크

```bash
# 구조 검증
./semo-scripts/health/validate-structure.sh

# 버전 확인
./semo-scripts/health/check-versions.sh
```

### 배포

```bash
# 패키지 검증
./semo-scripts/deploy/validate-package.sh ./semo-system/semo-core

# 버전 증가 (patch, minor, major)
./semo-scripts/deploy/bump-version.sh ./semo-system/semo-core patch
```

### 스캐폴딩

```bash
# 새 스킬 생성
./semo-scripts/scaffold/create-skill.sh my-skill ./skills

# 새 에이전트 생성
./semo-scripts/scaffold/create-agent.sh my-agent "Alex" ./agents
```

### 테스트

```bash
# 스킬 테스트 실행
./semo-scripts/test/run-skill-tests.sh ./semo-system/semo-skills
```

## 버전

현재 버전: 1.1.0

변경 이력은 [CHANGELOG](./CHANGELOG/) 디렉토리를 참조하세요.
