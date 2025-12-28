#!/bin/bash
# SEMO v4.0 Migration Script
# semo-core 단일 패키지로 모든 스킬/에이전트 통합

set -e

# 현재 디렉토리 기준으로 경로 설정
SEMO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE_DIR="$SEMO_ROOT/semo-system/semo-core"
SKILLS_DIR="$CORE_DIR/skills"
AGENTS_DIR="$CORE_DIR/agents"
REFS_DIR="$CORE_DIR/references"

echo "SEMO_ROOT: $SEMO_ROOT"

echo "🔄 SEMO v4.0 Migration: Unified Core Structure"
echo "================================================"

# 디렉토리 생성
mkdir -p "$SKILLS_DIR"
mkdir -p "$AGENTS_DIR"
mkdir -p "$REFS_DIR/runtimes/nextjs"
mkdir -p "$REFS_DIR/runtimes/spring"
mkdir -p "$REFS_DIR/runtimes/ms"
mkdir -p "$REFS_DIR/runtimes/infra"
mkdir -p "$REFS_DIR/domains/biz"
mkdir -p "$REFS_DIR/domains/ops"

echo ""
echo "📦 Phase 1: semo-skills 통합"
echo "----------------------------"

# semo-skills 복사 (CHANGELOG, VERSION 제외)
for skill in "$SEMO_ROOT/semo-system/semo-skills"/*/; do
    skillname=$(basename "$skill")
    if [ "$skillname" != "CHANGELOG" ] && [ -d "$skill" ]; then
        if [ -f "$skill/SKILL.md" ]; then
            cp -r "$skill" "$SKILLS_DIR/"
            echo "  ✅ $skillname"
        fi
    fi
done

echo ""
echo "📦 Phase 2: packages/eng/* 통합"
echo "-------------------------------"

# 스킬 복사 함수 (중복 시 접두사 추가)
copy_skill() {
    local source="$1"
    local prefix="$2"
    local skillname=$(basename "$source")

    # _shared, common, references 등 스킵
    if [[ "$skillname" == "_shared" ]] || [[ "$skillname" == "common" ]] || [[ "$skillname" == "references" ]] || [[ "$skillname" == "scripts" ]]; then
        return
    fi

    # SKILL.md가 있는 디렉토리만 복사
    if [ ! -f "$source/SKILL.md" ]; then
        return
    fi

    if [ -d "$SKILLS_DIR/$skillname" ]; then
        # 중복 - 접두사 추가
        cp -r "$source" "$SKILLS_DIR/${prefix}-${skillname}"
        echo "  ✅ ${prefix}-${skillname} (prefixed)"
    else
        cp -r "$source" "$SKILLS_DIR/"
        echo "  ✅ $skillname"
    fi
}

# nextjs 스킬
echo "[nextjs]"
for skill in "$SEMO_ROOT/packages/eng/nextjs/skills"/*/; do
    copy_skill "$skill" "nextjs"
done

# spring 스킬
echo "[spring]"
for skill in "$SEMO_ROOT/packages/eng/spring/skills"/*/; do
    copy_skill "$skill" "spring"
done

# ms 스킬
echo "[ms]"
for skill in "$SEMO_ROOT/packages/eng/ms/skills"/*/; do
    copy_skill "$skill" "ms"
done

# infra 스킬
echo "[infra]"
for skill in "$SEMO_ROOT/packages/eng/infra/skills"/*/; do
    copy_skill "$skill" "infra"
done

echo ""
echo "📦 Phase 3: packages/biz/* 통합"
echo "-------------------------------"

# poc 스킬
echo "[biz/poc]"
for skill in "$SEMO_ROOT/packages/biz/poc/skills"/*/; do
    copy_skill "$skill" "poc"
done

# design 스킬
echo "[biz/design]"
for skill in "$SEMO_ROOT/packages/biz/design/skills"/*/; do
    copy_skill "$skill" "design"
done

# discovery 스킬
echo "[biz/discovery]"
for skill in "$SEMO_ROOT/packages/biz/discovery/skills"/*/; do
    copy_skill "$skill" "discovery"
done

# management 스킬
echo "[biz/management]"
for skill in "$SEMO_ROOT/packages/biz/management/skills"/*/; do
    copy_skill "$skill" "pm"
done

echo ""
echo "📦 Phase 4: packages/ops/* 통합"
echo "-------------------------------"

# monitor 스킬
echo "[ops/monitor]"
for skill in "$SEMO_ROOT/packages/ops/monitor/skills"/*/; do
    copy_skill "$skill" "monitor"
done

# qa 스킬
echo "[ops/qa]"
for skill in "$SEMO_ROOT/packages/ops/qa/skills"/*/; do
    copy_skill "$skill" "qa"
done

# improve 스킬
echo "[ops/improve]"
for skill in "$SEMO_ROOT/packages/ops/improve/skills"/*/; do
    copy_skill "$skill" "improve"
done

echo ""
echo "📦 Phase 5: packages/core/* 통합 (우선순위 높음)"
echo "-----------------------------------------------"

for skill in "$SEMO_ROOT/packages/core/skills"/*/; do
    skillname=$(basename "$skill")
    if [[ "$skillname" == "_shared" ]] || [ ! -f "$skill/SKILL.md" ]; then
        continue
    fi

    # core 스킬은 덮어쓰기
    if [ -d "$SKILLS_DIR/$skillname" ]; then
        rm -rf "$SKILLS_DIR/$skillname"
    fi
    cp -r "$skill" "$SKILLS_DIR/"
    echo "  ✅ $skillname (core priority)"
done

echo ""
echo "📦 Phase 6: semo-meta 스킬 통합"
echo "-------------------------------"

for skill in "$SEMO_ROOT/semo-system/meta/skills"/*/; do
    skillname=$(basename "$skill")
    if [ ! -f "$skill/SKILL.md" ]; then
        continue
    fi

    if [ -d "$SKILLS_DIR/$skillname" ]; then
        cp -r "$skill" "$SKILLS_DIR/meta-${skillname}"
        echo "  ✅ meta-${skillname} (prefixed)"
    else
        cp -r "$skill" "$SKILLS_DIR/"
        echo "  ✅ $skillname"
    fi
done

echo ""
echo "📊 Migration Summary"
echo "===================="
skill_count=$(find "$SKILLS_DIR" -maxdepth 1 -type d | wc -l)
echo "Total Skills: $((skill_count - 1))"
echo ""
echo "✅ Migration Complete!"
