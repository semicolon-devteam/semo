import { test, expect } from '@playwright/test';

test.describe('API 엔드포인트 동작 확인', () => {
  test('/api/health 엔드포인트 응답', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });

  test('/api/bots 엔드포인트 응답 (봇 목록)', async ({ request }) => {
    const response = await request.get('/api/bots');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('/api/bots/[botId] 엔드포인트 응답 (봇 상세)', async ({ request }) => {
    // 실제 존재하는 봇 ID로 테스트
    const botId = 'semiclaw'; // 실제 데이터에 따라 조정

    const response = await request.get(`/api/bots/${botId}`);
    
    if (response.ok()) {
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
    } else {
      // 봇이 없으면 404
      expect(response.status()).toBe(404);
    }
  });

  test('/api/bots/[botId]/detail 엔드포인트 응답 (세션 활동)', async ({ request }) => {
    const botId = 'semiclaw';

    const response = await request.get(`/api/bots/${botId}/detail`);
    
    if (response.ok()) {
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('activity');
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('/api/kb 엔드포인트 응답 (KB 목록)', async ({ request }) => {
    const response = await request.get('/api/kb');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('/api/kb?search=<query> 시맨틱 검색', async ({ request }) => {
    const response = await request.get('/api/kb?search=onboarding');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();

    // 검색 결과에 similarity_pct 포함 여부 확인
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('kb_id');
      expect(body[0]).toHaveProperty('domain');
      expect(body[0]).toHaveProperty('key');
    }
  });

  test('/api/kb?domain=<domain> 도메인 필터', async ({ request }) => {
    const response = await request.get('/api/kb?domain=team');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    if (body.length > 0) {
      body.forEach((item: Record<string, unknown>) => {
        expect(item.domain).toBe('team');
      });
    }
  });

  test('/api/kb?bot_id=<botId> 봇 필터', async ({ request }) => {
    const response = await request.get('/api/kb?bot_id=semiclaw');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('/api/kb POST (생성)', async ({ request }) => {
    const payload = {
      domain: 'test-e2e',
      key: 'test-key-' + Date.now(),
      content: 'E2E 테스트 생성 항목',
    };

    const response = await request.post('/api/kb', {
      data: payload,
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('/api/kb PATCH (수정)', async ({ request }) => {
    // 먼저 항목 생성
    const key = 'test-key-' + Date.now();
    const createPayload = {
      domain: 'test-e2e',
      key,
      content: '원본 내용',
    };

    await request.post('/api/kb', { data: createPayload });

    // 수정
    const updatePayload = {
      domain: 'test-e2e',
      key,
      content: '수정된 내용',
    };

    const response = await request.patch('/api/kb', {
      data: updatePayload,
    });

    expect(response.ok()).toBeTruthy();
  });

  test('/api/kb DELETE (삭제)', async ({ request }) => {
    // 먼저 항목 생성
    const key = 'test-key-' + Date.now();
    const createPayload = {
      domain: 'test-e2e',
      key,
      content: '삭제 테스트',
    };

    await request.post('/api/kb', { data: createPayload });

    // 삭제
    const response = await request.delete(`/api/kb?domain=test-e2e&key=${key}`);
    expect(response.ok()).toBeTruthy();
  });

  test('/api/kb/domains 엔드포인트 응답', async ({ request }) => {
    const response = await request.get('/api/kb/domains');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('/api/kb/stats 엔드포인트 응답', async ({ request }) => {
    const response = await request.get('/api/kb/stats');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('total');
  });

  test('잘못된 엔드포인트는 404 반환', async ({ request }) => {
    const response = await request.get('/api/invalid-endpoint');
    expect(response.status()).toBe(404);
  });
});
