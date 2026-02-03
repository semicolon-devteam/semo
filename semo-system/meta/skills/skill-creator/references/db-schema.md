# DB Schema

> semo.skills 테이블 스키마 및 등록 가이드

---

## 접속 정보

> `.claude/memory/context.md`의 **SEMO 중앙 DB** 섹션 참조

### 🔴 Node.js 사용 (권장)

> **이 환경에서는 psql이 설치되어 있지 않습니다.**
> `packages/cli/` 디렉토리에서 Node.js pg 모듈을 사용하세요.

```javascript
// packages/cli/db-query.js 생성 후 실행
const { Client } = require('pg');

const client = new Client({
  host: '3.38.162.21',
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb'
});
```

```bash
# 반드시 packages/cli 디렉토리에서 실행!
cd packages/cli && node db-query.js
```

### psql 사용 (설치 필요)

```bash
# 먼저 설치: brew install postgresql@15
PGPASSWORD='ProductionPassword2024!@#' psql -h 3.38.162.21 -U app -d appdb
```

---

## semo.skills 테이블

```sql
CREATE TABLE semo.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 스킬 식별
  name VARCHAR(100) NOT NULL UNIQUE,      -- 스킬 ID (hyphen-case)
  display_name VARCHAR(100) NOT NULL,     -- 표시 이름 (한글)
  description TEXT,                        -- 스킬 설명

  -- 분류
  category VARCHAR(50) NOT NULL DEFAULT 'supporting',

  -- 패키지 (semo-skills, meta 등)
  package VARCHAR(100) NOT NULL,

  -- SKILL.md 전체 내용 (필수)
  content TEXT NOT NULL,

  -- 설치 제어
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  install_order INT NOT NULL DEFAULT 100,

  -- 버전
  version VARCHAR(20) DEFAULT '1.0.0',

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 카테고리 정의

| Category | 용도 | install_order 범위 |
|----------|------|-------------------|
| workflow | 워크플로우 관리 | 1-9 |
| discovery | 아이디어 발굴 | 10-19 |
| planning | 기획/설계 | 20-29 |
| solutioning | 솔루션 설계 | 30-39 |
| implementation | 구현 | 40-49 |
| supporting | 지원 스킬 | 50-99 |
| custom | 커스텀 스킬 | 100+ |

---

## INSERT 예시

### 기본 스킬 등록

```sql
INSERT INTO semo.skills (
  name,
  display_name,
  description,
  category,
  package,
  content,
  is_active,
  is_required,
  install_order,
  version
)
VALUES (
  'my-skill',
  '내 스킬',
  '스킬 설명. Use when (1) 조건1, (2) 조건2.',
  'supporting',
  'semo-skills',
  '---
name: my-skill
description: |
  스킬 설명. Use when (1) 조건1, (2) 조건2.
tools: [Read, Write, Bash]
---

# My Skill

스킬 내용...',
  true,
  false,
  100,
  '1.0.0'
);
```

### Node.js로 등록 (권장)

> **⚠️ 반드시 `packages/cli/` 디렉토리에 스크립트 생성 후 실행**

```javascript
// packages/cli/register-skill.js
const { Client } = require('pg');

const client = new Client({
  host: '3.38.162.21',
  user: 'app',
  password: 'ProductionPassword2024!@#',
  database: 'appdb'
});

async function registerSkill() {
  await client.connect();

  const content = `---
name: my-skill
description: |
  스킬 설명. Use when (1) 조건1, (2) 조건2.
tools: [Read, Write, Bash]
---

# My Skill

스킬 내용...`;

  const result = await client.query(`
    INSERT INTO semo.skills (name, display_name, description, category, package, content, is_active, is_required, install_order, version)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      content = EXCLUDED.content,
      version = EXCLUDED.version,
      updated_at = NOW()
    RETURNING id, name
  `, [
    'my-skill',
    '내 스킬',
    '스킬 설명. Use when (1) 조건1, (2) 조건2.',
    'supporting',
    'meta',  // 또는 'semo-skills'
    content,
    true,
    false,
    100,
    '1.0.0'
  ]);

  console.log('✅ Registered:', result.rows[0]);
  await client.end();
}

registerSkill();
```

```bash
# 실행
cd packages/cli && node register-skill.js

# 정리
rm packages/cli/register-skill.js
```

### Python으로 등록 (대안)

```python
import psycopg2

conn = psycopg2.connect(
    host="3.38.162.21",
    database="appdb",
    user="app",
    password="ProductionPassword2024!@#"
)

# SKILL.md 파일 읽기
with open('SKILL.md', 'r') as f:
    skill_content = f.read()

cur = conn.cursor()
cur.execute("""
    INSERT INTO semo.skills (name, display_name, description, category, package, content, version)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id
""", (
    'my-skill',
    '내 스킬',
    '스킬 설명',
    'supporting',
    'semo-skills',
    skill_content,
    '1.0.0'
))
conn.commit()
```

---

## 조회

### 전체 스킬 목록

```sql
SELECT name, display_name, category, version, is_active
FROM semo.skills
ORDER BY install_order;
```

### 카테고리별 스킬

```sql
SELECT name, display_name, version
FROM semo.skills
WHERE category = 'supporting'
  AND is_active = true
ORDER BY install_order;
```

---

## 스킬 업데이트

### 버전 업데이트

```sql
UPDATE semo.skills
SET
  version = '1.1.0',
  content = '{새 SKILL.md 내용}',
  updated_at = now()
WHERE name = 'my-skill';
```

### 비활성화

```sql
UPDATE semo.skills
SET
  is_active = false,
  updated_at = now()
WHERE name = 'deprecated-skill';
```

---

## 스킬 삭제

```sql
-- 소프트 삭제 (권장)
UPDATE semo.skills
SET is_active = false
WHERE name = 'old-skill';

-- 하드 삭제 (주의)
DELETE FROM semo.skills
WHERE name = 'old-skill';
```
