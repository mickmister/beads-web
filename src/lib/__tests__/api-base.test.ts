import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiBaseForLocation } from '../api-base';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getApiBase', () => {
  it('uses same-origin requests for forwarded port hosts by default', () => {
    expect(getApiBaseForLocation({
      protocol: 'https:',
      hostname: 'port-3017.jamtools.dev',
      port: '',
    })).toBe('');
  });

  it('uses same-origin requests for localhost dev ports by default', () => {
    expect(getApiBaseForLocation({
      protocol: 'http:',
      hostname: 'localhost',
      port: '3007',
    })).toBe('');
  });

  it('prefers explicit backend URL env var', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.example.test');
    vi.resetModules();
    const { getApiBase } = await import('../api-base');

    expect(getApiBase()).toBe('https://api.example.test');
  });
});
