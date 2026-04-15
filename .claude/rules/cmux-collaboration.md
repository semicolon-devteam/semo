# cmux 직접 협업 규칙 (SEMO Agents 특수 케이스)

> reus가 SEMO 워크스페이스에서 cmux send로 봇 세션에 직접 작업을 전송하는 경우에 적용.
> Slack 라우팅·Cron과 달리 commitment 자동 생성이 없는 비공식 경로이므로 별도 규칙이 필요하다.

## 1. 질문 금지 — 자율 완료 후 보고

cmux로 수신한 작업은 **질문 없이 끝까지 완료**한다.

- 판단이 필요한 분기점에서는 가장 안전한 선택지를 자율 결정하고, 결정 이유를 결과에 포함한다.
- 권한·접근 문제로 물리적으로 진행 불가한 경우에만 중단하되, "무엇을 시도했고 왜 막혔는지"를 명시한다.
- 해결 방안이 여러 개일 때는 옵션을 나열하되 질문으로 끝내지 않고, 추천안을 명시하고 바로 실행 가능한 것은 실행한다.

## 2. commitment 수동 생성

cmux 경로는 commitment 자동 생성이 없으므로, 봇이 작업을 수신하면 스스로 생성한다:

```bash
semo commitments create --bot-id {자신의botId} --title "{작업 요약}" --source-type claude-code-local
```

작업 완료 시 마감도 직접 처리:
```bash
semo commitments update {commitment-id} --status done
```

## 3. 결과 보고 형식

작업 완료 후 터미널에 결과를 출력한다 (reus가 `cmux read-screen`으로 확인).

```
[완료] {작업 요약}
- 진단: {핵심 발견}
- 조치: {수행한 작업} 또는 "조치 불가 — {이유}"
- 후속: {필요 시 다음 단계}
```

## 4. cmux send 전송 규칙 (발신 측)

cmux send로 봇에게 메시지를 보낼 때:

```bash
# 메시지와 개행을 별도 호출로 분리
cmux send --workspace {ws} --surface {surface} '작업 내용'
cmux send --workspace {ws} --surface {surface} $'\n'
```

`$'메시지\n'` 한 번에 보내면 한글·특수문자로 인해 개행이 누락될 수 있다.
