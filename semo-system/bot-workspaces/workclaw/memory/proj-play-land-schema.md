# proj-play-land 백엔드 아키텍처 & 스키마

## 접속 정보
- URL: `https://land-supabase-dev.semi-colon.space`
- .env에 ANON_KEY 있음

## 전체 테이블 (69개)
agreements, anonymous_visitor_logs, application_logs, badge_conditions, badges, banners, blocked_ips, board_categories, board_users, boards, bookmark_folders, challenge_action_types, challenge_codes, challenge_types, challenges, chat_message_read_receipts, chat_message_reports, chat_messages, chat_participants, chat_pinned_messages, chat_room_invitations, chat_rooms, coin_point_purchase_requests, coin_types, comments, current_month_comments_ranking_mv, current_month_points_ranking_mv, current_month_posts_ranking_mv, faqs, file_download_histories, flyway_schema_history, help_categories, menu, migrations, monthly_ranking_snapshots, notification_schedules, notification_templates, permission_changes, point_codes, point_error_logs, point_expiration_logs, point_histories, point_policies, point_ranking_mv, point_security_logs, point_transactions, post_bookmarks, post_download_histories, post_popularity_scores, post_views, posts, posts_search_logs, reactions, report_types, reports, rls_debug_log, rps_game_history, site_config_kv, user_agreements, user_attendance, user_badges, user_blocks, user_challenge_progress, user_level_configs, user_notifications, user_point_wallets, users, v_exclude_user_ids

## 주요 테이블 구조

### users (22 cols)
id(bigint), auth_user_id(uuid), login_id, nickname, email, phone_number, avatar_path, avatar_file_id(uuid), birthdate, gender, permission_type, activity_level(int), status, metadata(jsonb), info_open_settings(jsonb), invite_code, invited_by(bigint), is_withdrawal_requested(bool), nickname_changed_at, created_at, updated_at, deleted_at

### posts (30 cols)
id(bigint), board_id(bigint), category_id(bigint), title, content, description, writer_id(bigint), writer_name, writer_ip, writer_ip_str, status, is_notice(bool), is_anonymous(bool), is_secret(bool), password, thumbnail, metadata(jsonb), attachments(jsonb), restrict_attachments(jsonb), download_point(int), parent_id(bigint), view_count(int), like_count(int), dislike_count(int), comment_count(int), created_by(bigint), updated_by(bigint), created_at, updated_at, deleted_at

### boards (17 cols)
id(bigint), name, description, visibility, is_active(bool), maximum_members(int), metadata(jsonb), display_settings(jsonb), feature_settings(jsonb), permission_settings(jsonb), point_settings(jsonb), upload_settings(jsonb), created_by(bigint), updated_by(bigint), created_at, updated_at, deleted_at

### comments (20 cols)
id(bigint), post_id(bigint), parent_id(bigint), content, writer_id(bigint), writer_name, writer_ip, writer_ip_str, is_anonymous(bool), is_secret(bool), status, like_count(int), dislike_count(int), metadata(jsonb), edited_at, created_by(bigint), updated_by(bigint), created_at, updated_at, deleted_at

### reactions (5 cols)
user_id(bigint), target_type, target_id(bigint), reaction_type, created_at

### chat_rooms (17 cols)
id(bigint), name, description, room_type, owner_id(bigint), status, participant_count(int), max_participants(int), thumbnail_url, join_code, welcome_message_enabled(bool), welcome_message_content, metadata(jsonb), last_message_at, created_at, updated_at, deleted_at

### chat_messages (22 cols)
id(bigint), room_id(bigint), sender_id(bigint), content, message_type, status, file_url, file_name, reply_to_id(bigint), thread_id(bigint), mentions(bigint[]), reactions(jsonb), metadata(jsonb), is_edited(bool), is_deleted(bool), edited_at, original_content, deleted_by(bigint), delete_reason, created_at, updated_at, deleted_at

### point_transactions (12 cols)
id(bigint), user_id(bigint), amount(numeric), balance_after(numeric), transaction_type, point_code, policy_id(bigint), related_transaction_id(bigint), description, expiration_date, created_at, updated_at

### user_point_wallets (7 cols)
id(bigint), user_id(bigint), point_code, balance(numeric), version(bigint), created_at, updated_at

### site_config_kv (5 cols)
key, value(jsonb), description, updated_by(bigint), updated_at

## Supabase RPC 함수 (55개)

### 게시글
- `posts_create` (p_board_id, p_title, p_content, p_category_id, p_parent_id, p_attachments, p_metadata, p_restrict_attachments, p_password, p_is_notice, p_is_secret, p_is_anonymous, p_anonymous_nickname, p_download_point)
- `posts_detail_get` (p_post_id)
- `posts_read` (p_post_id, p_viewer_ip)
- `posts_delete` (p_post_id)
- `posts_search` (p_query, p_search_type, p_board_id, p_page_number, p_page_size, p_sort_by)
- `posts_search_by_title` / `posts_search_by_content` / `posts_search_by_title_and_content`
- `posts_search_count` (p_query, p_search_type, p_board_id)
- `posts_get_daily_popular` / `get_weekly_popular_posts` / `get_monthly_popular_posts` (p_date, p_limit)
- `posts_get_dashboard_recent` (p_board_ids, p_limit_per_board)
- `posts_check_read_condition` (p_post_id)
- `list_posts_rpc` (p_page, p_page_size, p_status, p_writer_id, p_board_id, p_category_id, p_search_text, p_search_type, p_sort_by, p_need_notice)
- `refresh_post_popularity_scores` ()

### 댓글/리액션
- `comments_create` (p_post_id, p_content, p_parent_id, p_anonymous_nickname)
- `reactions_create` (p_target_type, p_target_id, p_reaction_type)

### 포인트
- `points_issue` (p_user_id, p_point_code, p_amount, p_policy_id, p_description)
- `points_use` (p_user_id, p_point_code, p_amount, p_description)
- `user_point_wallets_ranking` ()

### 유저
- `get_user_me` (auth_user_id)
- `get_user_id_from_auth_uid` / `get_nickname_from_auth_uid`
- `users_is_login_id_duplicate` / `users_is_nickname_duplicate` / `users_is_email_duplicate`
- `users_nickname_change_validation` (p_new_nickname)
- `users_block_user` / `users_unblock_user` / `users_is_blocked_by_current_user`
- `users_withdrawal` (p_user_id)

### 출석/챌린지
- `user_attendance_process` ()
- `get_today_attendance` (auth_user_id)
- `user_challenge_progress_claim_reward` (p_challenge_id)

### 코인
- `coin_point_purchase_requests_create` (p_coin_code, p_payment_method, p_deposit_amount, p_wallet_address, p_transaction_id, p_exchange_name, p_coin_name_custom)
- `coin_purchase_request_admin_process` / `coin_purchase_request_cancel`

### 배너/파일/기타
- `banners_increment_click_count` (p_banner_id)
- `file_download_history_create` / `file_download_history_get_exist`
- `post_download_history_create` / `post_download_history_get_exist`
- `anonymous_visitor_log_create` (p_session_key)
- `get_daily_visitor_count` (p_hours)
- `blocked_ips_do_block` / `blocked_ips_do_unblock` / `blocked_ips_is_blocked`
- `get_site_config_kv` (p_key)
- `faq_increment_view_count` (faq_id)
- `has_permission` / `is_admin`
- `custom_access_token_hook` (event)
- `extract_client_ip` ()
- `generate_random_code` (length)

## Spring 백엔드 (79 endpoints)

### 접속 정보
- URL: `https://land-backend-dev.semi-colon.space`
- OpenAPI: `/api-docs` (3.1.0)
- 백엔드 소스: 로컬에 없음 (원격만)

### API 태그별 분류

**게시물 (Posts)**
- GET/POST `/rest/v1/posts`
- GET/DELETE/PATCH `/rest/v1/posts/{id}`
- GET `/rest/v1/posts/cursor` (커서 페이지네이션)
- GET `/rest/v1/posts/popular/daily|weekly|monthly`

**댓글 (Comments)**
- GET/POST `/rest/v1/posts/{postId}/comments`
- DELETE/PATCH `/rest/v1/posts/{postId}/comments/{commentId}`
- GET `/rest/v1/posts/{postId}/comments/{commentId}/replies`

**게시판 (Boards)**
- GET `/rest/v1/boards` / `/{id}` / `/{id}/categories`

**채팅 (Chat)**
- GET/POST `/rest/v1/chat/rooms` (생성/목록)
- GET `/rest/v1/chat/rooms/global`
- GET/PUT/DELETE `/rest/v1/chat/rooms/{roomId}`
- GET/POST `/rest/v1/chat/rooms/{roomId}/messages`
- pin/report/participants/join/leave/kick/role

**DM**
- POST `/rest/v1/dm/messages`
- DELETE `/rest/v1/dm/messages/{messageId}`
- GET `/rest/v1/dm/rooms` / `/{roomId}`

**포인트**
- POST `/rest/v1/points/issue` / `/use`
- GET `/rest/v1/points/histories`
- POST `/rest/v1/internal/points/issue|use`

**랭킹**
- GET `/rest/v1/rankings`
- GET `/rest/v2/rankings` (type=points|posts|comments, year, month)
- POST `/rest/v1/rankings/batch/snapshot`

**유저**
- GET `/rest/v1/users/me`
- check: email, login-id, nickname, withdrawn
- POST attendance, blocks
- DELETE withdrawal

**리액션**: POST `/rest/v1/reactions`
**알림**: GET/PATCH/DELETE notifications
**메뉴**: GET tree/top-level/children
**배너**: GET/POST(admin)
**챌린지**: GET/POST claim
**사이트 설정**: GET `/rest/v1/site-config/{key}`

## 아키텍처 관계 요약
```
[Next.js FE]
  ├─ SSR → Supabase 직접 (RPC + 테이블 쿼리)
  ├─ CSR → Spring 백엔드 (/rest/v1/*) via Axios + React Query
  └─ CSR (레거시) → Next API Routes → Supabase

[Spring 백엔드]
  └─ Supabase PostgreSQL (Flyway 마이그레이션)

[Supabase]
  ├─ PostgreSQL (69 tables, 55+ RPC functions)
  ├─ Auth (JWT)
  ├─ Storage (public-bucket)
  └─ Realtime (채팅)
```

## 트리거 (90개, 22 고유 함수)

### 핵심 비즈니스 트리거
| 트리거 함수 | 테이블 | 이벤트 | 설명 |
|---|---|---|---|
| `posts_point_issue` | posts | INSERT | 게시글 작성 시 포인트 지급 |
| `posts_create_validation` | posts | INSERT | 게시글 생성 검증 |
| `comments_point_issue` | comments | INSERT | 댓글 작성 시 포인트 지급 |
| `comments_check_time_limit` | comments | INSERT | 댓글 시간 제한 체크 |
| `posts_update_comment_count` | comments | INSERT/UPDATE/DELETE | 댓글수 자동 갱신 |
| `reactions_count_update` | reactions | INSERT/UPDATE | 좋아요수 자동 갱신 |
| `reactions_point_process` | reactions | INSERT | 리액션 시 포인트 처리 |
| `reactions_prevent_update` | reactions | UPDATE | 리액션 수정 방지 |
| `user_point_wallets_level_update` | user_point_wallets | UPDATE | 포인트 변경 시 레벨 갱신 |
| `detect_wallet_manipulation` | user_point_wallets | UPDATE | 지갑 조작 감지 |
| `manage_active_badges` | user_badges | INSERT/UPDATE | 배지 활성화 관리 |

### 유저 관련
| 트리거 함수 | 테이블 | 이벤트 | 설명 |
|---|---|---|---|
| `auth_user_create_handler` | users | INSERT | 인증 유저 생성 핸들러 |
| `auth_user_delete_handler` | users | DELETE | 인증 유저 삭제 핸들러 |
| `users_creation_handler` | users | INSERT | 유저 생성 후처리 |
| `users_validate_security_update` | users | UPDATE | 보안 필드 수정 검증 |
| `validate_super_admin_permission` | users | INSERT/UPDATE | 슈퍼관리자 권한 검증 |
| `permission_changes_log` | users | UPDATE | 권한 변경 로그 |

### 공통
| 트리거 함수 | 대상 | 설명 |
|---|---|---|
| `created_info_handler` | 44개 테이블 INSERT | created_by, created_at 자동 설정 |
| `updated_info_handler` | 30개 테이블 UPDATE | updated_by, updated_at 자동 설정 |

## Public 함수 (79개)
- 비즈니스 로직 RPC: 55개 (위 RPC 섹션 참조)
- 트리거 함수: 22개
- 유틸리티: 2개 (extract_client_ip, generate_random_code)

## 참고: FK 없음
- 테이블 간 FK constraint 미사용 → 앱 레벨에서 관계 관리
- writer_id, user_id, board_id 등은 논리적 FK (물리적 제약조건 없음)
