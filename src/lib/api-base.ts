/**
 * Build frontend URLs for the Beads Web backend.
 *
 * In the released desktop/server binary, the Next frontend is exported as
 * static assets and served by the Rust backend. Defaulting to a relative base
 * keeps that binary portable across hosts and PORT values. Set
 * NEXT_PUBLIC_BACKEND_URL only for explicit split frontend/backend deployments.
 */
const configuredApiBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') || '';

export function apiUrl(path: string): string {
  return `${configuredApiBase}${path}`;
}

export { configuredApiBase as API_BASE };
