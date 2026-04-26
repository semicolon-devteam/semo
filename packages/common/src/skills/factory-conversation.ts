/**
 * factory-conversation SKILL.md — 봇 인스턴스가 자연어 명령을 받았을 때
 * `semo factory` / `semo templates` / `semo onboard` 로 위임하는 방법을 가르친다.
 *
 * 이 스킬은 BUILTIN_KERNEL_SKILLS 에 등록되어 OSS 배포에 포함되며,
 * `semo update` 시 `~/.semo/kernel/skills/factory-conversation/SKILL.md` 로 풀린다.
 */
export const FACTORY_CONVERSATION_SKILL_MD = `---
name: factory-conversation
description: 자연어 봇 생성/템플릿 탐색/KB 메모 명령을 semo CLI 로 위임. SemoBot DM 응답에 사용.
---

# Factory Conversation

사용자가 DM/멘션으로 "기획 봇 만들어줘", "템플릿 보여줘", "이거 KB 에 적어줘" 같은 자연어 명령을 보내면
**추측 없이** \`semo factory parse\` / \`semo templates\` / \`semo onboard\` 명령으로 매핑한다.

## 결정 트리

| 사용자 의도                              | 1차 명령                                       | 다음 단계                                          |
| ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| "X 봇 만들어줘" / "기획자 봇 추가"       | \`semo factory parse "<원문>"\`                  | action.kind=bot.create → 확인 후 \`factory apply --yes\` |
| "어떤 봇 있어?" / "템플릿 목록"          | \`semo templates list\`                          | 결과를 1줄 요약으로 회신                           |
| "<id> 자세히" / "planclaw 가 뭐야"       | \`semo templates show <id>\`                     | 역할/스킬/태그 요약                                |
| "기획 관련 템플릿 검색"                   | \`semo templates search "<쿼리>"\`               | top-3 만 회신                                      |
| "이거 KB 에 적어둬"                       | \`semo factory parse "<원문>"\`                   | action.kind=kb.upsert → 확인 후 apply               |
| "내 노트에서 X 찾아줘"                    | \`semo factory parse "<원문>"\`                   | action.kind=kb.search → 결과 인용                  |
| "처음 시작인데 뭐부터?" / 첫 만남         | \`semo onboard --status\` 로 진행률 확인         | 미완료면 \`semo onboard\` 권유                     |

## 실행 절차 (bot.create 예)

\`\`\`bash
# 1) 자연어를 action 으로 매핑 (LLM 호출 없음, 결정적)
semo factory parse "기획 봇 하나 만들어줘"
# → { kind: 'bot.create', botId: 'planclaw', templateId: 'planclaw', ... }

# 2) 사용자에게 1줄 확인 메시지 송신
#   "→ planclaw 템플릿으로 봇 생성합니다. 진행할까요? (y/n)"

# 3) 동의 시 적용
semo factory apply "기획 봇 하나 만들어줘" --yes
\`\`\`

## 실행 절차 (templates 탐색 예)

\`\`\`bash
semo templates list --json   # 카탈로그 전체
semo templates search "리뷰" # 키워드 매칭
semo templates show planclaw # 단일 상세
\`\`\`

## 가드레일

- \`needs-clarification\` 또는 \`unknown\` action 을 받으면 **추측해서 실행하지 말고**
  사용자에게 어떤 의도인지 1줄로 되묻는다.
- \`bot.create\` 시 botId 가 이미 존재하면 (semo factory parse 결과의 conflict 플래그)
  자동 실행 대신 "기존 봇이 있어요, 다른 ID 를 쓸까요?" 로 회신.
- KB upsert 는 도메인/키 결정이 모호하면 \`semo kb ontology --action routing-table\` 결과를
  먼저 보여주고 사용자 확인 후 진행한다.

## 응답 길이 규칙

- 카탈로그 list 결과: **5줄 이내** (이름 + 한줄 요약만).
- show 상세: **10줄 이내**.
- factory action 확인 메시지: **1줄**.
`;
