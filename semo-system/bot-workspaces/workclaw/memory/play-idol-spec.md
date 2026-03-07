# 플레이아이돌 전체 기획서 (v2 - 2025-02-15)

## 1. 핵심 컨셉
커뮤니티 사이트 내 아이돌 프로필 + 소셜 피드 + 팬 인터랙션.
아이돌이 직접 가입→신청→승인 후 콘텐츠를 올리고, 팬이 팔로우/채팅/도네이션.

## 2. 재화 시스템 ⭐ (핵심)

### 포인트 (기존)
- 사용자가 커뮤니티 활동으로 획득하는 기존 재화
- 아이돌 콘텐츠 소비 시 포인트 차감

### 캐쉬 (신규)
- 아이돌 전용 재화. 포인트와 별도.
- **획득 조건**: 사용자가 아이돌 콘텐츠를 소비(포인트 차감)할 때 캐쉬 적립
  - 아이돌과 1:1 채팅
  - 게시글 열람/다운로드
  - 후원(도네이션)
- **교환 비율**: 어드민이 설정, 유동적 변경 가능
- **아이돌 등급별 차등 비율**:
  - 인기도 산출식에 따라 n단계로 구분
  - 단계별 교환 비율 설정 가능
  - 예: 1단계 아이돌 → 100포인트 소모 시 5캐쉬 / 2단계 → 100포인트 소모 시 8캐쉬

### 인기도 산출
```
인기도 = 팔로워 수 × W1 + 콘텐츠 소비 포인트 × W2 + 도네이션 포인트 × W3
```
- 가중치(W1, W2, W3)는 어드민이 조절 가능
- n단계 등급 구간도 어드민이 설정

## 3. 페이지별 기능

### ① 메인 페이지 — 아이돌 랭킹 캐러셀
- 인기순 상위 아이돌 가로 스크롤
- 프로필 이미지 + 이름 + 순위 뱃지
- 클릭 → 상세 페이지 이동

### ② 아이돌 피드 (`/idol`)
- 소셜 피드 (인스타 스타일)
- 프로필+이름+접속시간 → 이미지 → 좋아요/댓글수 → 캡션 → 댓글 입력
- 무료 콘텐츠만 공개 피드 노출
- 인피니트 스크롤, 최신순
- 필터: 팔로우한 아이돌만 보기

### ③ 아이돌 상세 (`/idol/[id]`)
- 프로필 이미지 + 이름 + 등급 뱃지 + 순위
- 자기소개 (bio), 소셜 링크 (Twitter, Instagram, Fantrie)
- 액션 버튼: 팔로우 / 채팅 / 도네이션
- 통계 카드: 팔로워 수, 콘텐츠 수, 랭킹
- 해당 아이돌 게시글 목록 (무료/유료 구분)

### ④ 채팅 팝업 — 아이돌 탭
- 기존 채팅 시스템 활용
- [일반] [아이돌] 탭
- 아이돌 탭: 채팅 해본 아이돌 (상위) + 채팅 안 해본 아이돌 (하위)
- 아이돌이 본인 설정에서 **채팅 시 유저 소모 포인트** 설정 가능

### ⑤ 유저 마이페이지
- 아이돌 신청 버튼
- 신청 상태 표시 (대기중/승인/거절)
- 캐쉬 잔액 표시

### ⑥ 관리자 페이지
- 아이돌 신청 리스트 (승인/거절)
- 아이돌 리스트 관리: 인기도, 콘텐츠 수, 환전액 종합 대시보드
- 인기도 가중치 설정
- 등급 구간 설정 (n단계)
- 등급별 캐쉬 교환 비율 설정
- 후원→캐쉬 전환 비율 별도 설정
- 아이돌 인기도/캐쉬 수동 조절

### ⑦ 아이돌 설정 페이지 (아이돌 본인)
- 프로필 편집 (이름, bio, 소셜 링크, 프로필 이미지)
- 콘텐츠 관리 (등록/수정/삭제, 무료/유료 설정)
- 1:1 채팅 포인트 설정
- 본인 캐쉬 잔액/수익 확인

## 4. 아이돌 등록 프로세스
1. 유저 마이페이지 → "아이돌 신청" 버튼
2. 신청 폼 작성 (활동명, 프로필 이미지, 소개, 소셜 링크 등)
3. 관리자 승인/거절
4. 승인 시 → idol_profiles 생성, 해당 유저의 permission 또는 role 업데이트

## 5. 도네이션
- 기존 포인트 시스템 연동 (포인트로 후원)
- 후원 시: 유저 포인트 차감 → 아이돌에게 캐쉬 적립
- 후원→캐쉬 전환 비율: 어드민 별도 설정

## 6. 알림
- 팔로우한 아이돌 새 콘텐츠 → 알림 발송

## 7. 콘텐츠 공개 정책
- `is_free = true` → 피드 공개 (포인트 소모 없음, 단 캐쉬 적립도 없음?)
- `is_free = false` → unlock_point 차감 후 열람 → 캐쉬 적립 발생

## 8. 파일/이미지 관리
- **Supabase Storage** 사용 (기존 패턴)
- 버킷: `public-bucket`
- 경로: `{auth_user_id}/{uuid}.{ext}`
- Next.js API Route `/api/files` 통해 업로드
- 공개 URL: `supabase.storage.from('public-bucket').getPublicUrl()`

## 9. DB 설계 (v3 확정 — 2025-02-15)

### 설계 원칙
- 기존 스키마 변경 0건
- 기존 포인트 시스템에 IDOL_CASH 코드 추가하여 재사용
- 아이돌 콘텐츠 = 전용 board의 posts (기존 posts/comments/reactions 재활용)
- 등급 설정 포함 전역 설정은 site_config_kv로 관리
- 인기도는 idol_profiles 컬럼으로 실시간 갱신 + 일일 배치 보정 (MV 없음)

### 신규 테이블 (5개)
| 테이블 | 핵심 컬럼 |
|---|---|
| idol_profiles | user_id(UNIQUE), stage_name, bio, profile_image_url, social_links(jsonb), chat_point_cost, status, tier_level, follower_count, content_score, donation_score, popularity_score, popularity_rank |
| idol_applications | user_id, stage_name, bio, profile_image_url, social_links(jsonb), status(pending/approved/rejected), reject_reason, reviewed_by, reviewed_at |
| idol_followers | idol_id, user_id (UNIQUE pair) |
| idol_donations | idol_id, donor_id, point_amount, cash_amount, message |
| idol_cash_withdrawals | user_id, amount, status(pending/approved/rejected/completed), bank_info(jsonb), reviewed_by, completed_at |

### 기존 테이블 활용
| 테이블 | 용도 | 변경 |
|---|---|---|
| boards | 아이돌 전용 board 1건 INSERT | point_settings 전부 0 |
| posts | 아이돌 콘텐츠 (download_point=해금포인트) | 없음 |
| comments | 콘텐츠 댓글 | 없음 |
| reactions | 좋아요 | 없음 |
| point_codes | +IDOL_CASH 1건 INSERT | 없음 |
| point_policies | +아이돌 캐쉬 정책 1건 INSERT | 없음 |
| user_point_wallets | 아이돌 캐쉬 잔액 (IDOL_CASH) | 없음 |
| point_transactions | 캐쉬 거래 내역 | 없음 |

### site_config_kv 키
| key | value 예시 | 설명 |
|---|---|---|
| idol.board_id | 100 | 아이돌 전용 게시판 ID |
| idol.popularity_weights | {"follower":10,"content":1,"donation":2} | 인기도 가중치 |
| idol.free_content_cash_enabled | true | 무료 콘텐츠 캐쉬 적립 여부 |
| idol.donation_cash_ratio | 0.1 | 후원 캐쉬 전환 비율 |
| idol.tiers | {"tiers":[{"level":1,"name":"브론즈","min_score":0,"max_score":999,"point_to_cash_ratio":0.05},{"level":2,"name":"실버","min_score":1000,"max_score":4999,"point_to_cash_ratio":0.08},...]} | 등급 N단계 설정 |

## 10. 확정 사항 (2025-02-15 추가)
- [x] 캐쉬 → 현금 환전: 수동 방식. 아이돌이 환전 신청 → 어드민 확인 → 직접 입금 → 완료처리(캐쉬 차감). 코인 구매 신청 패턴과 유사.
- [x] 무료 콘텐츠 캐쉬 적립: site_config_kv로 유동적 on/off 설정
- [x] 아이돌 등급 단계: 어드민 자유 설정 (idol_tier_configs 테이블에 N개 row)
- [x] 채팅 포인트 소모: 메시지당 차감

## 11. 미결정 사항
- [ ] 아이돌 탈퇴/비활성화 시 캐쉬 처리
