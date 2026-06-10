import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('apiUrl', () => {
  it('uses same-origin relative paths by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    vi.resetModules();

    const { apiUrl, API_BASE } = await import('../api-base');

    expect(API_BASE).toBe('');
    expect(apiUrl('/api/projects')).toBe('/api/projects');
  });

  it('uses NEXT_PUBLIC_BACKEND_URL when explicitly configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://beads.example.test/');
    vi.resetModules();

    const { apiUrl, API_BASE } = await import('../api-base');

    expect(API_BASE).toBe('https://beads.example.test');
    expect(apiUrl('/api/projects')).toBe('https://beads.example.test/api/projects');
  });
});
