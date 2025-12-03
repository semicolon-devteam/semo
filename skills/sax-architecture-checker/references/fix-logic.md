# Fix Logic

> install-sax.sh와 동일한 로직으로 .claude 구조 수정

## 패키지 감지

```bash
detect_package() {
  for pkg in po next qa meta pm backend infra design; do
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

## 🔴 중첩 심링크 처리 (핵심)

> **문제**: `.claude/skills`가 `sax-{pkg}/skills`로 심링크된 경우, 그 안에 생성하는 심링크 경로가 꼬임
>
> **해결**: 심링크 디렉토리를 실제 디렉토리로 교체 후 병합

```bash
ensure_real_directory() {
  local dir_path=$1  # e.g., ".claude/skills"

  # 심링크인 경우 → 실제 디렉토리로 교체
  if [ -L "$dir_path" ]; then
    echo "  ⚠️ $dir_path is symlink, converting to real directory"
    rm -f "$dir_path"
    mkdir -p "$dir_path"
  elif [ ! -d "$dir_path" ]; then
    mkdir -p "$dir_path"
  fi
}
```

## 병합 디렉토리 수정 (agents/, skills/)

```bash
fix_merged_dir() {
  local dir_type=$1  # agents or skills
  local pkg=$2

  # 🔴 심링크 → 실제 디렉토리 변환
  ensure_real_directory ".claude/$dir_type"

  # .merged 마커 생성
  touch ".claude/$dir_type/.merged"

  # 기존 심링크 모두 제거 (클린 슬레이트)
  find ".claude/$dir_type" -maxdepth 1 -type l -delete

  # 1. sax-core 심링크 (기본 레이어)
  if [ -d ".claude/sax-core/$dir_type" ]; then
    for item in .claude/sax-core/$dir_type/*/; do
      if [ -d "$item" ]; then
        local name=$(basename "$item")
        ln -sfn "../sax-core/$dir_type/$name" ".claude/$dir_type/$name"
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
        ln -sfn "../sax-$pkg/$dir_type/$name" ".claude/$dir_type/$name"
        echo "  [pkg] $name"
      fi
    done
  fi

  # 3. 🔴 검증: 심링크 실제 접근 가능 여부 확인
  local broken=0
  for link in .claude/$dir_type/*/; do
    if [ -L "${link%/}" ] && [ ! -e "${link%/}" ]; then
      echo "  ❌ BROKEN: ${link%/}"
      broken=$((broken + 1))
    fi
  done

  if [ $broken -gt 0 ]; then
    echo "  ⚠️ $broken broken symlinks detected"
  fi
}
```

## commands/SAX 수정

```bash
fix_commands() {
  local pkg=$1

  # 🔴 심링크 → 실제 디렉토리 변환
  ensure_real_directory ".claude/commands"
  ensure_real_directory ".claude/commands/SAX"

  # .merged 마커 생성
  touch ".claude/commands/SAX/.merged"

  # 기존 심링크 모두 제거
  find ".claude/commands/SAX" -maxdepth 1 -type l -delete

  # 1. sax-core 커맨드 심링크
  if [ -d ".claude/sax-core/commands/SAX" ]; then
    for item in .claude/sax-core/commands/SAX/*.md; do
      if [ -f "$item" ]; then
        local name=$(basename "$item")
        ln -sfn "../../sax-core/commands/SAX/$name" ".claude/commands/SAX/$name"
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
        ln -sfn "../../sax-$pkg/commands/SAX/$name" ".claude/commands/SAX/$name"
        echo "  [pkg] $name"
      fi
    done
  fi

  # 3. 🔴 검증: 심링크 실제 접근 가능 여부 확인
  local broken=0
  for link in .claude/commands/SAX/*.md; do
    if [ -L "$link" ] && [ ! -e "$link" ]; then
      echo "  ❌ BROKEN: $link"
      broken=$((broken + 1))
    fi
  done

  if [ $broken -gt 0 ]; then
    echo "  ⚠️ $broken broken symlinks detected"
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

| 대상 | 심링크 경로 | 비고 |
|------|-------------|------|
| CLAUDE.md | `sax-{pkg}/CLAUDE.md` | 직접 심링크 |
| agents/{name} | `../sax-{core\|pkg}/agents/{name}` | 실제 디렉토리 내 심링크 |
| skills/{name} | `../sax-{core\|pkg}/skills/{name}` | 실제 디렉토리 내 심링크 |
| commands/SAX/{name}.md | `../../sax-{core\|pkg}/commands/SAX/{name}.md` | 실제 디렉토리 내 심링크 |

## 🔴 중첩 심링크 문제 해결

### 문제 상황

```text
.claude/
├── skills → sax-next/skills (심링크)  ← 문제!
├── sax-core/
└── sax-next/
```

기존 방식에서 sax-core 심링크 생성 시:

```bash
ln -s "../sax-core/skills/feedback" ".claude/skills/feedback"
```

경로 해석:

```text
.claude/skills/feedback
→ sax-next/skills/feedback (1단계 심링크)
→ sax-next/skills/../sax-core/skills/feedback
→ sax-next/sax-core/skills/feedback (존재하지 않음!)
```

### 해결 방법

**심링크 디렉토리를 실제 디렉토리로 교체**:

```bash
# 심링크인 경우 삭제 후 실제 디렉토리 생성
if [ -L ".claude/skills" ]; then
  rm -f ".claude/skills"
  mkdir -p ".claude/skills"
fi
```

교체 후 구조:

```text
.claude/
├── skills/  (실제 디렉토리)
│   ├── feedback → ../sax-core/skills/feedback
│   ├── notify-slack → ../sax-core/skills/notify-slack
│   └── ... (sax-pkg skills)
├── sax-core/
└── sax-next/
```

## 병합 우선순위

1. **기본 (sax-core)**: 공통 컴포넌트
2. **우선 (sax-{pkg})**: 패키지별 컴포넌트 (동일 이름이면 덮어쓰기)
