/**
 * env.ts 단위 테스트
 */

import { isDebugMode, debugLog } from './env';

describe('env utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isDebugMode', () => {
    it('SEMO_HOOKS_DEBUG=true면 true 반환', () => {
      process.env.SEMO_HOOKS_DEBUG = 'true';
      expect(isDebugMode()).toBe(true);
    });

    it('SEMO_HOOKS_DEBUG=1이면 true 반환', () => {
      process.env.SEMO_HOOKS_DEBUG = '1';
      expect(isDebugMode()).toBe(true);
    });

    it('SEMO_HOOKS_DEBUG 미설정이면 false 반환', () => {
      delete process.env.SEMO_HOOKS_DEBUG;
      expect(isDebugMode()).toBe(false);
    });

    it('SEMO_HOOKS_DEBUG=false면 false 반환', () => {
      process.env.SEMO_HOOKS_DEBUG = 'false';
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('debugLog', () => {
    it('디버그 모드에서만 출력해야 함', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 디버그 모드 OFF
      delete process.env.SEMO_HOOKS_DEBUG;
      debugLog('test message');
      expect(consoleSpy).not.toHaveBeenCalled();

      // 디버그 모드 ON
      process.env.SEMO_HOOKS_DEBUG = 'true';
      debugLog('test message');
      expect(consoleSpy).toHaveBeenCalledWith('[semo-hooks]', 'test message');

      consoleSpy.mockRestore();
    });
  });
});
