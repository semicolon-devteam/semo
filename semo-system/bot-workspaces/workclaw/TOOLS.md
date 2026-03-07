# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## proj-play-land (미디어 랜드)

### Test Accounts
- **User**: test / 123123
- **Admin**: admin / ComAdminPass1212
  - E2E 테스트 시 어드민 권한 페이지는 이 계정으로 실제 로그인하여 진행

### Dev URLs
| 서비스 | Dev URL |
|---|---|
| proj-game-land | game-land-dev.semi-colon.space |
| proj-play-land | play-land-dev.semi-colon.space |
| proj-office-land | office-land-dev.semi-colon.space |
| game-backend | game-backend-dev.semi-colon.space |
| play-backend | play-backend-dev.semi-colon.space |
| office-backend | office-backend-dev.semi-colon.space |
| game-supabase | game-supabase-dev.semi-colon.space |
| play-supabase | play-supabase-dev.semi-colon.space |

### Dev Server
- FE Port: 3000 (점유 시 해당 프로세스 kill 후 3000번으로 구동)
- FE Repo: `/Users/reus/Desktop/Sources/semicolon/projects/land/proj-play-land`
- BE Repo: `/Users/reus/Desktop/Sources/semicolon/projects/land/core-backend`
- Branch: `feat-play-idol`

### FE 테스트 (필수)
1. **로컬 FE 테스트 (localhost:3000)**
   - `.env`의 `NEXT_PUBLIC_SPRING_API_BASE_URL`을 **반드시** `https://play-backend-dev.semi-colon.space`로 설정
   - localhost:8080(로컬 스프링)을 바라보면 스프링 로그인창이 뜨면서 테스트 불가
   - 3000번 포트 점유 시: `/usr/sbin/lsof -ti:3000 | xargs kill -9` 후 구동
2. **개발서버 E2E 테스트** — PR 머지 → GH Actions 배포 완료 확인 → `play-land-dev.semi-colon.space`에서 브라우저 테스트
   - **배포 완료 선확인 필수** (배포 미완료 시 테스트 진행 금지)

### BE 테스트
- 로컬 스프링(localhost:8080) 구동 후 HTTP curl로 API 검증
- feature 브랜치 → PR → dev 머지 → 개발서버 자동 배포

---

## cm-jungchipan (정치판)

### Project Info
- **Repo**: `semicolon-devteam/cm-jungchipan`
- **Owner**: Harry Lee
- **Tech Stack**: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase
- **Local Path**: `/Users/reus/Desktop/Sources/semicolon/projects/jungchipan`
- **Branch Strategy**: `main` (production), `dev` (development), `feat/*` (features)

### Dev URLs
- **Production**: https://cm-jungchipan.vercel.app (Vercel)
- **Local**: http://localhost:3000

### Local Dev
- **Port**: 3000 (Next.js default)
- **Start**: `npm run dev`
- **Build**: `npm run build`
- **Test**: `npm test` (Jest), `npm run test:e2e` (Playwright)

### Test Accounts
- TBD (확인 필요)

### Environment
- Supabase URL/Keys required (see `.env.example`)
- Spring Boot backend integration via `NEXT_PUBLIC_SPRING_BOOT_API_URL`
- Vercel deployment auto-triggers on `main` branch

---

Add whatever helps you do your job. This is your cheat sheet.
