# AI와 함께 일하는 법을 만들다: 세미콜론 협업 프레임워크 구축기

> SAX에서 SEMO로, AI 오케스트레이션 프레임워크 개발 여정

---

## 시리즈 소개

2024년, AI가 코드를 작성하는 시대가 열렸습니다. Claude Code, GitHub Copilot, Cursor... 개인 개발자에게는 마법 같은 도구들이지만, **팀 단위로 도입**하면 어땠을까요?

"내 프롬프트는 잘 되는데, 왜 다른 사람 건 안 되지?"
"코드 스타일이 매번 달라요."
"AI가 프로젝트 컨텍스트를 모르니까 엉뚱한 코드를 짜요."

세미콜론 팀은 이 문제를 해결하기 위해 **SEMO (Semicolon Orchestrate)**라는 AI 에이전트 오케스트레이션 프레임워크를 만들었습니다. 이 시리즈는 그 11개월간의 여정을 담고 있습니다.

---

## 포스팅 목록

| 편 | 제목 | 핵심 주제 |
|----|------|----------|
| **1** | [AI가 코드를 짜는 시대, 우리는 무엇을 준비해야 하는가](./01-beginning.md) | 팀 도입 문제, SAX 탄생 배경 |
| **2** | [역할 기반 AI 에이전트 시스템을 설계하다](./02-sax-birth.md) | SAX 아키텍처, 11개 패키지 |
| **3** | [토큰 지옥과 컨텍스트 파편화](./03-token-crisis.md) | 토큰 최적화, 55% 감소 |
| **4** | [이름이 문제였다: SAX → SEMO 리브랜딩](./04-rebranding.md) | LLM 할루시네이션, 네이밍 |
| **5** | [역할 기반에서 기능 기반으로](./05-architecture-shift.md) | 3-Layer Architecture |
| **6** | [팀 공용 토큰과 원클릭 설치](./06-infrastructure.md) | MCP Server, CI/CD |
| **7** | [AI 에이전트가 기억하는 세상](./07-future-memory.md) | Long-term Memory, 비전 |
| **8** | [SEMO v5.0 - 구조의 대수술](./08-v5-restructuring.md) | 패키지 통합, 페르소나 에이전트 |

---

## 독자별 추천 순서

### AI 도구 도입을 고민하는 개발 리더
→ 1편 → 4편 → 5편 → 6편

### SEMO를 바로 사용해보고 싶은 개발자
→ 1편 (튜토리얼) → 6편 (튜토리얼) → 5편

### AI 프레임워크 설계에 관심 있는 분
→ 2편 → 3편 → 5편 → 7편

---

## 핵심 교훈 미리보기

1. **AI는 도구가 아니라 팀원처럼 대해야 한다**
2. **네이밍은 SEO가 아닌 "LLM-friendly"로**
3. **토큰 경제학을 무시하면 안 된다**
4. **역할 기반 < 기능 기반**
5. **온보딩 마찰 = 도입 실패**

---

## SEMO 빠른 시작

```bash
# 30초 설치
npx @team-semicolon/semo-cli init

# Claude Code 재시작 후
# "로그인 폼 만들어줘" → SEMO가 자동으로 처리
```

---

## 관련 링크

- [SEMO GitHub](https://github.com/semicolon-devteam/semo)
- [npm 패키지](https://www.npmjs.com/package/@team-semicolon/semo-mcp)
- [세미콜론 커뮤니티솔루션](https://semicolon.community)

---

*이 시리즈는 세미콜론 커뮤니티솔루션 팀의 실제 개발 경험을 바탕으로 작성되었습니다.*
