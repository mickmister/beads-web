import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiBaseForLocation } from '../api-base';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getApiBase', () => {
  it('derives backend origin from forwarded port hosts', () => {
    expect(getApiBaseForLocation({
      protocol: 'https:',
      hostname: 'port-3017.jamtools.dev',
      port: '',
    })).toBe('https://port-3018.jamtools.dev');
  });

  it('derives backend origin from localhost dev ports', () => {
    expect(getApiBaseForLocation({
      protocol: 'http:',
      hostname: 'localhost',
      port: '3007',
    })).toBe('http://localhost:3008');
  });

  it('prefers explicit backend URL env var', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.example.test');
    vi.resetModules();
    const { getApiBase } = await import('../api-base');

    expect(getApiBase()).toBe('https://api.example.test');
  });
});
