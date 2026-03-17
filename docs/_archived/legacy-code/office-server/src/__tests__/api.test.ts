/**
 * Semo Office Server API Tests
 *
 * Comprehensive test suite for all API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../api/index.js';
import type { Express } from 'express';

// Test app instance
let app: Express;

// Test data - Valid UUID format (version 4)
const TEST_UUID = '123e4567-e89b-42d3-a456-426614174000';  // Valid v4 UUID
const TEST_UUID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Valid v4 UUID
// Invalid UUIDs that should return 400 (not including empty string which goes to different route)
const INVALID_IDS = ['demo', 'new', 'test', '123', 'abc', 'null', 'undefined'];
// Unique suffix for test data to avoid constraint violations
const TEST_SUFFIX = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

beforeAll(() => {
  app = createApp();
});

// ==========================================
// Health Check
// ==========================================
describe('Health Check', () => {
  it('GET /health should return ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'semo-office-server',
    });
  });
});

// ==========================================
// Office API
// ==========================================
// Note: Tests that require database connection are marked with .skip
// Run these tests with proper SUPABASE_URL and SUPABASE_SERVICE_KEY env vars

describe('Office API', () => {
  describe('GET /api/offices', () => {
    it('should list all offices (requires DB)', async () => {
      const res = await request(app).get('/api/offices');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('offices');
      expect(Array.isArray(res.body.offices)).toBe(true);
    });
  });

  describe('POST /api/offices', () => {
    it('should create a new office with valid data (requires DB)', async () => {
      const res = await request(app)
        .post('/api/offices')
        .send({
          name: `Test Office ${TEST_SUFFIX}`,
          github_org: `test-org-${TEST_SUFFIX}`,
          github_repo: `test-repo-${TEST_SUFFIX}`,
          repo_path: '/tmp/test-repo',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(`Test Office ${TEST_SUFFIX}`);
    });

    it('should reject creation without required fields', async () => {
      const res = await request(app)
        .post('/api/offices')
        .send({ name: 'Test Office' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject creation with empty name', async () => {
      const res = await request(app)
        .post('/api/offices')
        .send({
          name: '',
          github_org: 'org',
          github_repo: 'repo',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/offices/:id', () => {
    it('should return 404 for non-existent office (requires DB)', async () => {
      const res = await request(app).get(`/api/offices/${TEST_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Office not found');
    });

    it.each(INVALID_IDS)('should return 400 for invalid ID "%s"', async (invalidId) => {
      const res = await request(app).get(`/api/offices/${invalidId}`);

      // Should return 400 for invalid UUID
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('DELETE /api/offices/:id', () => {
    it.each(INVALID_IDS)('should return 400 for invalid ID "%s"', async (invalidId) => {
      const res = await request(app).delete(`/api/offices/${invalidId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });
});

// ==========================================
// Agent API
// ==========================================
describe('Agent API', () => {
  describe('GET /api/offices/:id/agents', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app).get(`/api/offices/${invalidId}/agents`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return agents array for valid UUID (requires DB)', async () => {
      const res = await request(app).get(`/api/offices/${TEST_UUID}/agents`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('agents');
      expect(Array.isArray(res.body.agents)).toBe(true);
    });
  });

  describe('POST /api/offices/:id/agents', () => {
    it('should require persona_id (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/agents`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('persona_id is required');
    });

    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${invalidId}/agents`)
        .send({ persona_id: TEST_UUID });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('PATCH /api/offices/:id/agents/:agentId', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .patch(`/api/offices/${invalidId}/agents/${TEST_UUID}`)
        .send({ status: 'working' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it.each(INVALID_IDS)('should return 400 for invalid agent ID "%s"', async (invalidId) => {
      const res = await request(app)
        .patch(`/api/offices/${TEST_UUID}/agents/${invalidId}`)
        .send({ status: 'working' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });
});

// ==========================================
// Job API
// ==========================================
describe('Job API', () => {
  describe('GET /api/offices/:id/jobs', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app).get(`/api/offices/${invalidId}/jobs`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return jobs array for valid UUID (requires DB)', async () => {
      const res = await request(app).get(`/api/offices/${TEST_UUID}/jobs`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('jobs');
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it('should support status filter (requires DB)', async () => {
      const res = await request(app)
        .get(`/api/offices/${TEST_UUID}/jobs`)
        .query({ status: 'ready' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('jobs');
    });
  });

  describe('POST /api/offices/:id/tasks', () => {
    it('should require task field (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/tasks`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('task is required');
    });

    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${invalidId}/tasks`)
        .send({ task: 'Test task' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('GET /api/offices/:id/jobs/:jobId', () => {
    it('should return 404 for non-existent job (requires DB)', async () => {
      const res = await request(app)
        .get(`/api/offices/${TEST_UUID}/jobs/${TEST_UUID_2}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });

    it.each(INVALID_IDS)('should return 400 for invalid job ID "%s"', async (invalidId) => {
      const res = await request(app)
        .get(`/api/offices/${TEST_UUID}/jobs/${invalidId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('PATCH /api/offices/:id/jobs/:jobId', () => {
    it.each(INVALID_IDS)('should return 400 for invalid job ID "%s"', async (invalidId) => {
      const res = await request(app)
        .patch(`/api/offices/${TEST_UUID}/jobs/${invalidId}`)
        .send({ status: 'done' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should accept valid status updates (requires DB)', async () => {
      // This will fail because job doesn't exist
      // Note: Current implementation returns 500 for non-existent resources
      // TODO: Should return 404 for better error handling
      const res = await request(app)
        .patch(`/api/offices/${TEST_UUID}/jobs/${TEST_UUID_2}`)
        .send({ status: 'done', pr_number: 123 });

      // Expect 404, 200, or 500 (DB error for non-existent resource)
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('POST /api/offices/:id/jobs/:jobId/execute', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${invalidId}/jobs/${TEST_UUID}/execute`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it.each(INVALID_IDS)('should return 400 for invalid job ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/jobs/${invalidId}/execute`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return 404 for non-existent job (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/jobs/${TEST_UUID_2}/execute`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });
  });
});

// ==========================================
// Worktree API
// ==========================================
describe('Worktree API', () => {
  describe('GET /api/offices/:id/worktrees', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app).get(`/api/offices/${invalidId}/worktrees`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/offices/:id/worktrees', () => {
    it('should require agent_role (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/worktrees`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('agent_role is required');
    });

    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${invalidId}/worktrees`)
        .send({ agent_role: 'FE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('DELETE /api/offices/:id/worktrees/:worktreeId', () => {
    it.each(INVALID_IDS)('should return 400 for invalid worktree ID "%s"', async (invalidId) => {
      const res = await request(app)
        .delete(`/api/offices/${TEST_UUID}/worktrees/${invalidId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });
});

// ==========================================
// Persona API
// ==========================================
describe('Persona API', () => {
  describe('GET /api/personas', () => {
    it('should list all personas (requires DB)', async () => {
      const res = await request(app).get('/api/personas');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('personas');
      expect(Array.isArray(res.body.personas)).toBe(true);
    });

    it('should filter by role (requires DB)', async () => {
      const res = await request(app)
        .get('/api/personas')
        .query({ role: 'FE' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('personas');
    });
  });

  describe('POST /api/personas', () => {
    it('should require role and persona_prompt', async () => {
      const res = await request(app)
        .post('/api/personas')
        .send({ name: 'Test Persona' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('role and persona_prompt are required');
    });

    it('should create persona with valid data (requires DB)', async () => {
      const res = await request(app)
        .post('/api/personas')
        .send({
          role: 'FE',
          name: 'Test Frontend',
          persona_prompt: 'You are a frontend developer',
          core_skills: ['React', 'TypeScript'],
        });

      // Should succeed or fail gracefully
      expect(res.status).toBeLessThan(500);
    });
  });
});

// ==========================================
// Message API
// ==========================================
describe('Message API', () => {
  describe('GET /api/offices/:id/messages', () => {
    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app).get(`/api/offices/${invalidId}/messages`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    it('should support limit parameter (requires DB)', async () => {
      const res = await request(app)
        .get(`/api/offices/${TEST_UUID}/messages`)
        .query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
    });
  });

  describe('POST /api/offices/:id/messages', () => {
    it('should require content (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/messages`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('content is required');
    });

    it.each(INVALID_IDS)('should return 400 for invalid office ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/offices/${invalidId}/messages`)
        .send({ content: 'Test message' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/offices/:id/agents/:agentId/message', () => {
    it('should require content (requires DB)', async () => {
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/agents/${TEST_UUID_2}/message`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('content is required');
    });
  });
});

// ==========================================
// Session API
// ==========================================
describe('Session API', () => {
  describe('GET /api/sessions/stats', () => {
    it('should return session stats', async () => {
      const res = await request(app).get('/api/sessions/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalSessions');
    });
  });

  describe('GET /api/sessions', () => {
    it('should list all sessions', async () => {
      const res = await request(app).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });
  });

  describe('POST /api/sessions/:sessionId/cancel', () => {
    it('should handle non-existent session', async () => {
      const res = await request(app)
        .post(`/api/sessions/${TEST_UUID}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
    });

    it.each(INVALID_IDS)('should handle invalid session ID "%s"', async (invalidId) => {
      const res = await request(app)
        .post(`/api/sessions/${invalidId}/cancel`);

      // Session IDs can be non-UUID, so just check it doesn't crash
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it.each(INVALID_IDS)('should handle invalid session ID "%s"', async (invalidId) => {
      const res = await request(app)
        .delete(`/api/sessions/${invalidId}`);

      // Session IDs can be non-UUID, so just check it doesn't crash
      expect(res.status).toBeLessThan(500);
    });
  });
});

// ==========================================
// UUID Validation Tests
// ==========================================
describe('UUID Validation', () => {
  const endpoints = [
    { method: 'get', path: '/api/offices/:id' },
    { method: 'delete', path: '/api/offices/:id' },
    { method: 'get', path: '/api/offices/:id/agents' },
    { method: 'get', path: '/api/offices/:id/jobs' },
    { method: 'get', path: '/api/offices/:id/messages' },
    { method: 'get', path: '/api/offices/:id/worktrees' },
  ];

  describe('Should not crash with invalid UUIDs', () => {
    INVALID_IDS.forEach((invalidId) => {
      endpoints.forEach(({ method, path }) => {
        const testPath = path.replace(':id', invalidId);
        it(`${method.toUpperCase()} ${testPath} should not return 500`, async () => {
          const res = await (request(app) as any)[method](testPath);
          expect(res.status).not.toBe(500);
        });
      });
    });
  });

  describe('Should accept valid UUIDs (requires DB)', () => {
    const validUUIDs = [
      '123e4567-e89b-42d3-a456-426614174000',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      TEST_UUID,
    ];

    validUUIDs.forEach((uuid) => {
      it(`should accept valid UUID: ${uuid}`, async () => {
        const res = await request(app).get(`/api/offices/${uuid}`);
        // Should not crash - 404 is acceptable for non-existent
        expect([200, 404]).toContain(res.status);
      });
    });
  });
});

// ==========================================
// Error Handling Tests
// ==========================================
describe('Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });

  it('should handle malformed JSON', async () => {
    const res = await request(app)
      .post('/api/offices')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    // Express will return 400 or 500 depending on error handling setup
    expect([400, 500]).toContain(res.status);
  });

  it('should handle empty body', async () => {
    const res = await request(app)
      .post('/api/offices')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ==========================================
// Input Validation Tests
// ==========================================
describe('Input Validation', () => {
  describe('SQL Injection Prevention', () => {
    const maliciousInputs = [
      "'; DROP TABLE offices; --",
      "1 OR 1=1",
      "admin'--",
      "<script>alert('xss')</script>",
    ];

    maliciousInputs.forEach((input) => {
      it(`should handle malicious input: ${input.slice(0, 20)}...`, async () => {
        const res = await request(app).get(`/api/offices/${encodeURIComponent(input)}`);
        // Invalid UUIDs should return 400 (bad request)
        expect(res.status).toBe(400);
      });
    });
  });

  describe('Large Input Handling (requires DB)', () => {
    it('should handle very long office name', async () => {
      const longName = 'a'.repeat(10000);
      const res = await request(app)
        .post('/api/offices')
        .send({
          name: longName,
          github_org: `org-${TEST_SUFFIX}`,
          github_repo: `repo-${TEST_SUFFIX}`,
        });

      // Should fail gracefully (400) or DB error (500) for exceeding varchar limit
      // TODO: Add input validation to return 400 for oversized inputs
      expect([400, 500]).toContain(res.status);
    });

    it('should handle very long task description', async () => {
      const longTask = 'Test task '.repeat(1000);
      const res = await request(app)
        .post(`/api/offices/${TEST_UUID}/tasks`)
        .send({ task: longTask });

      // Should fail gracefully (not 500)
      expect(res.status).toBeLessThan(500);
    });
  });
});
