# Sync Commands Reference

## .claude/ 동기화

```bash
# SAX commands 동기화
rsync -av --delete \
  sax/packages/sax-po/commands/SAX/ \
  .claude/commands/SAX/

# CLAUDE.md 동기화
rsync -av \
  sax/packages/sax-po/CLAUDE.md \
  .claude/CLAUDE.md
```

## Quick Start

```bash
# 1. SAX 디렉토리에 파일 생성 (: 프리픽스 없이)
touch sax/packages/sax-po/commands/SAX/new-command.md

# 2. 커맨드 내용 작성 (Markdown 형식)
# 3. CLAUDE.md Commands 섹션에 추가
# 4. .claude/ 동기화

# 호출 형식 (자동)
/SAX:new-command  # ✅ SAX: 프리픽스 자동 적용
```

## Related Resources

- [Commands 섹션](../../CLAUDE.md#commands)
- [기존 SAX Commands](../../commands/SAX/)
- [Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands)
