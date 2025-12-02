# Fix Logic

> install-sax.sh와 동일한 로직으로 .claude 구조 수정

## 패키지 감지

```bash
detect_package() {
  for pkg in po next qa meta pm backend infra; do
    [ -d ".claude/sax-$pkg" ] && echo "$pkg" && return
  done
  echo "unknown"
}

PKG=$(detect_package)
```

## CLAUDE.md 수정

```bash
fix_claude_md() {
  local pkg=$1

  # 기존 제거 (심링크 또는 파일)
  rm -f ".claude/CLAUDE.md"

  # 새 심링크 생성
  ln -s "sax-$pkg/CLAUDE.md" ".claude/CLAUDE.md"

  echo "Fixed: CLAUDE.md -> sax-$pkg/CLAUDE.md"
}
```

## 병합 디렉토리 수정 (agents/, skills/)

```bash
fix_merged_dir() {
  local dir_type=$1  # agents or skills
  local pkg=$2

  # 디렉토리 생성 + .merged 마커
  mkdir -p ".claude/$dir_type"
  touch ".claude/$dir_type/.merged"

  # 기존 심링크 모두 제거 (클린 슬레이트)
  find ".claude/$dir_type" -maxdepth 1 -type l -delete

  # 1. sax-core 심링크 (기본 레이어)
  if [ -d ".claude/sax-core/$dir_type" ]; then
    for item in .claude/sax-core/$dir_type/*/; do
      if [ -d "$item" ]; then
        local name=$(basename "$item")
        ln -s "../sax-core/$dir_type/$name" ".claude/$dir_type/$name"
        echo "  [core] $name"
      fi
    done
  fi

  # 2. sax-{pkg} 심링크 (우선 레이어, 덮어쓰기)
  if [ -d ".claude/sax-$pkg/$dir_type" ]; then
    for item in .claude/sax-$pkg/$dir_type/*/; do
      if [ -d "$item" ]; then
        local name=$(basename "$item")
        # core 것이 있으면 제거 (패키지 우선)
        rm -f ".claude/$dir_type/$name"
        ln -s "../sax-$pkg/$dir_type/$name" ".claude/$dir_type/$name"
        echo "  [pkg] $name"
      fi
    done
  fi
}
```

## commands/SAX 수정

```bash
fix_commands() {
  local pkg=$1

  # 디렉토리 생성 + .merged 마커
  mkdir -p ".claude/commands/SAX"
  touch ".claude/commands/SAX/.merged"

  # 기존 심링크 모두 제거
  find ".claude/commands/SAX" -maxdepth 1 -type l -delete

  # 1. sax-core 커맨드 심링크
  if [ -d ".claude/sax-core/commands/SAX" ]; then
    for item in .claude/sax-core/commands/SAX/*.md; do
      if [ -f "$item" ]; then
        local name=$(basename "$item")
        ln -s "../../sax-core/commands/SAX/$name" ".claude/commands/SAX/$name"
        echo "  [core] $name"
      fi
    done
  fi

  # 2. sax-{pkg} 커맨드 심링크 (우선)
  if [ -d ".claude/sax-$pkg/commands/SAX" ]; then
    for item in .claude/sax-$pkg/commands/SAX/*.md; do
      if [ -f "$item" ]; then
        local name=$(basename "$item")
        rm -f ".claude/commands/SAX/$name"
        ln -s "../../sax-$pkg/commands/SAX/$name" ".claude/commands/SAX/$name"
        echo "  [pkg] $name"
      fi
    done
  fi
}
```

## 전체 수정 실행

```bash
run_fix() {
  local pkg=$(detect_package)

  if [ "$pkg" = "unknown" ]; then
    echo "Error: SAX 패키지를 찾을 수 없습니다"
    return 1
  fi

  echo "패키지: sax-$pkg"
  echo ""

  echo "=== CLAUDE.md 수정 ==="
  fix_claude_md "$pkg"
  echo ""

  echo "=== agents/ 수정 ==="
  fix_merged_dir "agents" "$pkg"
  echo ""

  echo "=== skills/ 수정 ==="
  fix_merged_dir "skills" "$pkg"
  echo ""

  echo "=== commands/SAX/ 수정 ==="
  fix_commands "$pkg"
  echo ""

  echo "완료!"
}
```

## 심링크 경로 규칙

| 대상 | 심링크 경로 |
|------|-------------|
| CLAUDE.md | `sax-{pkg}/CLAUDE.md` |
| agents/{name} | `../sax-{core\|pkg}/agents/{name}` |
| skills/{name} | `../sax-{core\|pkg}/skills/{name}` |
| commands/SAX/{name}.md | `../../sax-{core\|pkg}/commands/SAX/{name}.md` |

## 병합 우선순위

1. **기본 (sax-core)**: 공통 컴포넌트
2. **우선 (sax-{pkg})**: 패키지별 컴포넌트 (동일 이름이면 덮어쓰기)
