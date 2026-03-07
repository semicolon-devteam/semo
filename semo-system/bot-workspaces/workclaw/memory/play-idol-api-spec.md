# 플레이아이돌 API 명세 (v1 — 2025-02-15)

Base: `/rest/v1/idol`

---

## 1. 프로필 (#144) — 🔄 구현 중

### Public
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/profiles` | 아이돌 목록 | `PagedSuccess<IdolProfileListResponse>` |
| GET | `/profiles/{id}` | 아이돌 상세 | `Success<IdolProfileResponse>` |
| GET | `/profiles/ranking` | 인기순 랭킹 | `Success<List<IdolProfileListResponse>>` |

### 인증 필요
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/profiles/me` | 내 아이돌 프로필 | `Success<IdolProfileResponse>` |
| PATCH | `/profiles/me` | 프로필 수정 | `Success<IdolProfileResponse>` |
| POST | `/profiles/{id}/follow` | 팔로우 토글 | `Success<IdolFollowResponse>` |
| GET | `/profiles/me/following` | 내가 팔로우한 아이돌 | `Success<List<IdolFollowingResponse>>` |

### Request/Response
```
IdolProfileListResponse: { id, stageName, profileImageUrl, tierLevel, followerCount, popularityScore, popularityRank }
IdolProfileResponse: { id, userId, stageName, bio, profileImageUrl, socialLinks, chatPointCost, status, tierLevel, followerCount, contentScore, donationScore, popularityScore, popularityRank, createdAt }
IdolProfileUpdateRequest: { stageName?, bio?, profileImageUrl?, socialLinks?, chatPointCost? }
IdolFollowResponse: { followed: boolean, followerCount: int }
IdolFollowingResponse: { idolId, stageName, profileImageUrl, tierLevel }
```

---

## 2. 신청/승인 (#144) — 🔄 구현 중

### 인증 필요
| Method | Path | 설명 | Response |
|---|---|---|---|
| POST | `/applications` | 아이돌 신청 | `Success<IdolApplicationResponse>` |
| GET | `/applications/me` | 내 신청 상태 | `Success<IdolApplicationResponse?>` |

### Admin
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/admin/applications` | 대기 신청 목록 | `Success<List<IdolApplicationResponse>>` |
| PATCH | `/admin/applications/{id}` | 승인/거절 | `Success<IdolApplicationResponse>` |

### Request/Response
```
IdolApplicationRequest: { stageName, bio?, profileImageUrl?, socialLinks? }
IdolApplicationResponse: { id, userId, stageName, bio, profileImageUrl, socialLinks, status, rejectReason, reviewedAt, createdAt }
IdolApplicationReviewRequest: { approved: boolean, rejectReason? }
```

---

## 3. 콘텐츠/피드 (#145) — 📋 대기

### Public
| Method | Path | 설명 | Query Params | Response |
|---|---|---|---|---|
| GET | `/contents` | 피드 (전체) | cursor?, limit?, followingOnly? | `CursorPagedSuccess<IdolContentResponse>` |
| GET | `/contents/{id}` | 콘텐츠 상세 | | `Success<IdolContentDetailResponse>` |
| GET | `/profiles/{idolId}/contents` | 아이돌별 콘텐츠 | cursor?, limit? | `CursorPagedSuccess<IdolContentResponse>` |

### 인증 필요
| Method | Path | 설명 | Response |
|---|---|---|---|
| POST | `/contents` | 콘텐츠 등록 | `Success<IdolContentDetailResponse>` |
| PATCH | `/contents/{id}` | 수정 | `Success<IdolContentDetailResponse>` |
| DELETE | `/contents/{id}` | 삭제 | `204 No Content` |
| POST | `/contents/{id}/unlock` | 유료 해금 | `Success<IdolContentUnlockResponse>` |

### Request/Response
```
IdolContentCreateRequest: { title?, content, attachments?(jsonb), downloadPoint?(=0이면 무료) }
IdolContentUpdateRequest: { title?, content?, attachments?, downloadPoint? }
IdolContentResponse: { id, idolId, idolStageName, idolProfileImageUrl, idolTierLevel, title, content(미리보기), thumbnail, isFree, downloadPoint, viewCount, likeCount, commentCount, isUnlocked, createdAt }
IdolContentDetailResponse: { ...IdolContentResponse, content(전문, 해금 시), attachments }
IdolContentUnlockResponse: { contentId, pointSpent, cashEarned, remainingPoints }
```

**구현 참고**: posts 테이블 재활용
- 등록: `INSERT INTO posts (board_id=아이돌board, writer_id, title, content, attachments, download_point)`
- 조회: `WHERE board_id = (site_config_kv['idol.board_id']) AND deleted_at IS NULL`
- 해금: download_point > 0이면 유료 → ACTIVITY_POINT 차감 → IDOL_CASH 적립

---

## 4. 도네이션/캐쉬 (#146) — 📋 대기

### 인증 필요
| Method | Path | 설명 | Response |
|---|---|---|---|
| POST | `/profiles/{id}/donate` | 후원 | `Success<IdolDonationResponse>` |
| GET | `/profiles/{id}/donations` | 후원 내역 | `PagedSuccess<IdolDonationResponse>` |

### 캐쉬 (아이돌 본인)
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/cash/balance` | IDOL_CASH 잔액 | `Success<IdolCashBalanceResponse>` |
| GET | `/cash/transactions` | 거래 내역 | `PagedSuccess<IdolCashTransactionResponse>` |
| POST | `/cash/withdraw` | 환전 신청 | `Success<IdolCashWithdrawalResponse>` |
| GET | `/cash/withdrawals` | 환전 내역 | `Success<List<IdolCashWithdrawalResponse>>` |

### Admin
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/admin/withdrawals` | 환전 신청 목록 | `Success<List<IdolCashWithdrawalResponse>>` |
| PATCH | `/admin/withdrawals/{id}` | 승인/거절/완료 | `Success<IdolCashWithdrawalResponse>` |

### Request/Response
```
IdolDonationRequest: { amount: int, message? }
IdolDonationResponse: { id, idolId, donorId, pointAmount, cashAmount, message, createdAt }
IdolCashBalanceResponse: { balance: BigDecimal, totalEarned: BigDecimal, totalWithdrawn: BigDecimal }
IdolCashTransactionResponse: { id, amount, balanceAfter, transactionType, description, createdAt }
IdolCashWithdrawRequest: { amount: BigDecimal, bankInfo: { bank, account, holder } }
IdolCashWithdrawalResponse: { id, amount, status, bankInfo, rejectReason, reviewedAt, completedAt, createdAt }
IdolCashWithdrawalReviewRequest: { status: "approved"|"rejected"|"completed", rejectReason? }
```

---

## 5. 등급/인기도/관리자 설정 (#147) — 📋 대기

### Admin
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/admin/config` | 전체 아이돌 설정 | `Success<IdolConfigResponse>` |
| PATCH | `/admin/config` | 설정 수정 | `Success<IdolConfigResponse>` |
| GET | `/admin/dashboard` | 종합 통계 | `Success<IdolDashboardResponse>` |
| GET | `/admin/profiles` | 아이돌 관리 목록 | `PagedSuccess<IdolAdminProfileResponse>` |
| PATCH | `/admin/profiles/{id}` | 수동 조절 | `Success<IdolAdminProfileResponse>` |
| POST | `/admin/popularity/refresh` | 전체 재계산 | `Success<{ updatedCount: int }>` |

### Request/Response
```
IdolConfigResponse: { tiers, popularityWeights, freeContentCashEnabled, donationCashRatio, boardId }
IdolConfigUpdateRequest: { tiers?, popularityWeights?, freeContentCashEnabled?, donationCashRatio? }
IdolDashboardResponse: { totalIdols, totalFollowers, totalCashIssued, totalCashWithdrawn, pendingApplications, pendingWithdrawals }
IdolAdminProfileResponse: { ...IdolProfileResponse, cashBalance, totalCashEarned, totalCashWithdrawn, contentCount }
IdolAdminProfileUpdateRequest: { popularityScore?, contentScore?, donationScore?, tierLevel?, status? }
```

---

## 6. 채팅 연동 (#148) — 📋 대기

### 인증 필요
| Method | Path | 설명 | Response |
|---|---|---|---|
| GET | `/chat/rooms` | 아이돌 채팅 목록 | `Success<List<IdolChatRoomResponse>>` |

### Request/Response
```
IdolChatRoomResponse: { idolId, stageName, profileImageUrl, tierLevel, chatPointCost, lastMessageAt?, hasHistory: boolean }
```

**구현 참고**: 기존 채팅 메시지 전송 로직에 이벤트 리스너 추가
- 메시지 전송 시: 상대가 아이돌이면 → chatPointCost만큼 ACTIVITY_POINT 차감 → IDOL_CASH 적립
- 목록 정렬: 채팅 이력 있는 아이돌 상위 (lastMessageAt DESC), 없는 아이돌 하위 (popularityScore DESC)
