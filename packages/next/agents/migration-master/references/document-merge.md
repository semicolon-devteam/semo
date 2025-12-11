# Document Merge Strategy

> CLAUDE.md 및 README.md 융합 전략 상세

## CLAUDE.md 융합 전략

### 융합 원칙

| 구분 | 소스 | 설명 |
|------|------|------|
| 🔴 불변 원칙 | 템플릿 | Team Codex, Dev Philosophy 등 |
| 🔴 Agent & Skill 가이드 | 템플릿 | SAX 시스템 메시지 포함 |
| 🔴 Docs 참조 유효성 검증 | 템플릿 | 404 알림 규칙 |
| 🟢 프로젝트 개요 | 기존 문서 | 서비스명, 설명 |
| 🟢 환경 설정 | 기존 .env | 분석하여 채움 |
| 🟢 도메인 구조 | 현재 src/app/ | 구조 반영 |
| 🟢 서비스 특화 규칙 | 기존 문서 | 이식 |

### 융합 프로세스 (개념적)

```typescript
function mergeCLAUDEmd(existing: string | null, template: string): string {
  // 1. 템플릿에서 불변 원칙 섹션 추출
  const immutableSection = extractSection(template, "🔴 불변 원칙");

  // 2. 기존 문서에서 프로젝트 정보 추출
  const projectInfo = existing
    ? extractProjectInfo(existing)
    : {
        serviceName: "[서비스명]",
        description: "[서비스 설명]",
        supabaseProjectId: "[project-id]",
      };

  // 3. 현재 프로젝트 분석
  const currentDomains = analyzeSrcApp();
  const envVars = parseEnvFile();
  const customRules = existing ? extractCustomRules(existing) : [];

  // 4. 융합된 CLAUDE.md 생성
  return generateMergedCLAUDE({
    immutableSection,
    projectInfo,
    currentDomains,
    envVars,
    customRules,
  });
}
```

## README.md 융합 전략

### 융합 원칙

1. **서비스 정보 보존**: 기존 README에서 서비스명, 설명, 기능 목록 추출
2. **구조 통일**: templates/README.template.md 구조 적용
3. **cm-template 배지 추가**: 템플릿 기반 프로젝트임을 명시

### 융합 순서

- 서비스명/설명 → 기존 README에서 추출
- 주요 기능 → 기존 README에서 추출 또는 새로 작성
- Quick Start → 템플릿 구조 + 프로젝트별 설정
- Architecture → 템플릿 구조 + 실제 도메인 반영
- Documentation → 템플릿에서 복사 (팀 표준 링크)

## 융합 예시

### 기존 레거시 CLAUDE.md

```markdown
# CLAUDE.md - 오피스 서비스

이 프로젝트는 오피스 예약 시스템입니다.

## 환경 설정

- Supabase URL: xxx
- API Mode: spring

## 특이사항

- 예약은 30분 단위로만 가능
- 관리자만 회의실 삭제 가능
```

### 융합 결과 CLAUDE.md

```markdown
# CLAUDE.md - 오피스 서비스

> 이 파일은 cm-template 기반 파생 프로젝트를 위한 Claude Code 가이드입니다.

## 🔴 불변 원칙 (docs 위키 준수 필수)

> **CRITICAL**: 아래 문서는 **수정 불가한 팀 표준**입니다.

### 필수 참조 문서

1. **[Team Codex](...)** - 협업 규칙 (필수)
2. **[Development Philosophy](...)** - 아키텍처 철학
   ...

### 핵심 원칙 체크리스트

[템플릿에서 복사된 불변 원칙들]

---

## 🟢 프로젝트 특화 설정

> 이 섹션은 서비스별로 수정 가능합니다.

### 프로젝트 개요

| 항목         | 값                 | 비고                 |
| ------------ | ------------------ | -------------------- |
| **서비스명** | 오피스 서비스      | ← 기존 문서에서 추출 |
| **설명**     | 오피스 예약 시스템 | ← 기존 문서에서 추출 |
| **기반 템플릿** | cm-template v1.x.x |                   |
| **Supabase** | [project-id]       |                      |

### 서비스 특화 규칙

> 기존 CLAUDE.md의 "특이사항"에서 이식됨

- 예약은 30분 단위로만 가능
- 관리자만 회의실 삭제 가능
```

### 기존 레거시 README.md

```markdown
# Office Booking System

회사 내부 회의실 예약 시스템

## 기능

- 회의실 예약
- 예약 현황 조회
- 관리자 대시보드

## 설치

npm install
npm run dev
```

### 융합 결과 README.md

```markdown
# Office Booking System

> 회사 내부 회의실 예약 시스템

[![Based on cm-template](https://img.shields.io/badge/template-cm--template-blue)](...)

## 📋 개요

회사 내부 회의실 예약 시스템 ← 기존에서 추출

### 주요 기능

- ✨ 회의실 예약 ← 기존에서 추출
- ✨ 예약 현황 조회 ← 기존에서 추출
- ✨ 관리자 대시보드 ← 기존에서 추출

## 🚀 Quick Start ← 템플릿 구조

[템플릿 형식의 설치 가이드]

## 🏗️ Architecture ← 템플릿 구조

[DDD 구조 설명 + 실제 도메인 반영]

## 📚 Documentation ← 템플릿에서 복사

- [Team Codex](...) - 협업 규칙
- [Development Philosophy](...) - 개발 철학
```
