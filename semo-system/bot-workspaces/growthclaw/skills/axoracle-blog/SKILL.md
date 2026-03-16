---
name: axoracle-blog
description: Create and publish SEO-optimized Korean blog posts for AXOracle (AI-based investment analysis service) to Supabase. Use when axoracle-daily-blog cron triggers or when manually requesting blog post creation.
---

# AXOracle Blog

## Project
- Repo: `/Users/reus/Desktop/Sources/semicolon/land/proj-axoracle`
- Supabase config: `memory/axoracle-config.json` (url + serviceRoleKey)
- Notify channel: `#proj-axoracle` (C0AE4N0LSKV)

## Writing Guidelines
- Language: Korean, 1500–2000 characters
- Structure: Hook intro → 3–5 body sections → CTA conclusion
- SEO: Include title, meta description, slug, tags
- Avoid duplicate titles: Check recent 30 days of posts via Supabase before writing

## Publishing
1. Write post with SEO metadata
2. `INSERT` into Supabase `posts` table via REST API (`/rest/v1/posts`)
3. Notify C0AE4N0LSKV: "✅ AXOracle 블로그 발행 완료: [제목]"
