# GA4 이벤트 설정 후 KPI 스크립트 업데이트 가이드

## 이벤트 설정 완료 후 해야 할 일

### 1. 로그인율 정확도 향상

**현재 (추정치):**
```javascript
const loggedInUsers = Math.round(activeUsers * 0.15); // 추정
```

**업데이트 (실제 데이터):**
```javascript
// user_login_status 커스텀 차원 사용
const [loginData] = await analyticsDataClient.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: 'customUser:user_login_status' }],
  metrics: [{ name: 'activeUsers' }],
});

const loggedInUsers = loginData.rows?.find(
  row => row.dimensionValues[0].value === 'logged_in'
)?.metricValues[0]?.value || 0;
```

---

### 2. 참여율 정확도 향상

**현재 (추정치):**
```javascript
const participantUsers = Math.round(activeUsers * 0.05); // 추정
```

**업데이트 (실제 데이터):**
```javascript
const [eventData] = await analyticsDataClient.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: 'eventName' }],
  metrics: [{ name: 'totalUsers' }],
  dimensionFilter: {
    filter: {
      fieldName: 'eventName',
      inListFilter: {
        values: ['vote', 'comment', 'post_create', 'debate_join'],
      },
    },
  },
});

const participantUsers = new Set();
eventData.rows?.forEach(row => {
  participantUsers.add(row.dimensionValues[0].value);
});
```

---

### 3. 업데이트된 스크립트 실행

GA4에서 이벤트 데이터가 쌓이기 시작하면 (24~48시간 후):

```bash
# 기존 스크립트에 위 코드 변경 적용 후 실행
node scripts/jungchipan-kpi-report.js
```

> **TODO**: `jungchipan-kpi-report-v2.js`는 아직 미구현. GA4 이벤트 설정 완료 후 기존 스크립트에 직접 코드 변경 적용.

---

## 주의사항

- GA4 이벤트 데이터는 **24~48시간 후** 안정화됨
- 커스텀 차원은 생성 후 **즉시 사용 가능**하지만 과거 데이터에는 적용 안 됨
- 실시간 보고서에서 먼저 이벤트 발생 확인 후 스크립트 업데이트 권장
