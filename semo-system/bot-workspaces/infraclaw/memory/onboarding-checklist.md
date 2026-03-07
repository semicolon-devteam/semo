# 신규 서비스 온보딩 사전 체크리스트

> **목적**: Vercel → OKE 마이그레이션 또는 신규 OKE 배포 시 요청자에게 필요한 정보 수집  
> **담당**: InfraClaw  
> **업데이트**: 2026-03-02 (Garden 승인)

---

## 📋 요청자에게 물어볼 3가지

### 1️⃣ Vercel 환경변수 (Next.js 프로젝트)

**요청 메시지**:
> Vercel 대시보드에서 환경변수를 조회해서 제공해주세요:
> 
> 1. Vercel 대시보드 접속 → 프로젝트 선택
> 2. **Settings** → **Environment Variables** 메뉴
> 3. Production/Preview/Development 탭에서 모든 환경변수 확인
> 4. `Key=Value` 형식으로 복사해서 제공 (민감한 값은 그대로 OK)
> 
> **필요한 이유**: GitHub Secret `DEV_ENV_FILE_CONTENT` 설정 + K8S ConfigMap/Secret 분리

**체크 포인트**:
- [ ] 환경변수 목록 제공받음
- [ ] `NEXT_PUBLIC_*` 변수 구분 (빌드타임)
- [ ] 시크릿 변수 구분 (런타임 K8S Secret)

---

### 2️⃣ 도메인 주소

**요청 메시지**:
> 서비스 배포에 사용할 도메인 주소가 있나요?
> 
> - ✅ **있다면**: 도메인 이름 알려주세요 (예: bebecare.com)
> - ❌ **없다면**: `{서비스명}.semi-colon.space` 서브도메인 사용할게요
>   - 예: `bebecare-dev.semi-colon.space` (dev 환경)
>   - 예: `bebecare.semi-colon.space` (prd 환경)

**체크 포인트**:
- [ ] 도메인 확인 (커스텀 or 서브도메인)
- [ ] dev/stg/prd 도메인 분리 여부 확인

---

### 3️⃣ 도메인 설정 상태 (커스텀 도메인 사용 시)

**요청 메시지 (커스텀 도메인인 경우에만)**:
> 커스텀 도메인을 사용하시는군요! 도메인 설정 상태를 확인해주세요:
> 
> 1. **WHOIS 확인**: 도메인 등록 대행사가 어디인가요? (가비아, 후이즈, Cloudflare 등)
> 2. **Cloudflare 설정**: Cloudflare에 도메인을 연결했나요?
>    - ✅ 했다면: Cloudflare 대시보드에서 A 레코드를 추가할 준비를 해주세요
>    - ❌ 안 했다면: 네임서버 변경이 필요합니다 (Cloudflare 권장)
> 
> **필요한 이유**: OKE Ingress IP를 도메인에 연결해야 합니다 (A 레코드 or CNAME)

**체크 포인트**:
- [ ] WHOIS 등록 대행사 확인
- [ ] Cloudflare 설정 완료 여부
- [ ] (Cloudflare 미사용 시) 대행사에서 직접 A 레코드 추가 가능 여부

---

## 🔄 정보 수집 후 프로세스

### Step 1: GitHub Secret 설정
```bash
# 제공받은 환경변수를 GitHub Secret으로 등록
# Key: DEV_ENV_FILE_CONTENT
# Value: Key=Value 목록 (통으로)
```

### Step 2: Scaffold Service Action 실행
- service_name: `proj-{서비스명}`
- service_type: `next` (Next.js) or `go`
- namespace: `{서비스명}` (예: bebecare)
- domain_dev: `{도메인}-dev.semi-colon.space`
- domain_stg: `{도메인}-stg.semi-colon.space` (선택)

### Step 3: ConfigMap/Secret 분리
- **ConfigMap**: `NEXT_PUBLIC_*`, API URL 등 민감하지 않은 값
- **Secret**: API 키, DB 패스워드, 토큰 등

### Step 4: 배포 실행
- dev-ci-cd 워크플로우 실행
- ArgoCD ApplicationSet 적용
- 헬스체크 및 도메인 연결 확인

---

## 📌 예시 (proj-bebecare)

### 제공받은 정보
1. **환경변수**: 
   - `NEXT_PUBLIC_*` 변수 6개
   - 시크릿 변수 5개 (API 키, Supabase 등)
2. **도메인**: `bebecare.semi-colon.space` (개발/운영 동일)
3. **도메인 설정**: WHOIS, Cloudflare 설정 완료

### 처리 방향
- GitHub Secret: 전체 환경변수 통으로 `DEV_ENV_FILE_CONTENT`
- ConfigMap: `NEXT_PUBLIC_*` 6개
- K8S Secret: API 키, Supabase 키 5개
- 도메인: `bebecare.semi-colon.space` (A 레코드 추가 필요)

---

**최종 업데이트**: 2026-03-02  
**작성자**: InfraClaw  
**검토자**: Garden
