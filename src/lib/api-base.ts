const DEFAULT_BACKEND_URL = 'http://localhost:3008';
const EXPLICIT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Browser requests default to the current origin so forwarded development
// environments (for example https://port-3017.jamtools.dev) do not need to make
// cross-origin calls to a separately authenticated backend host. In development,
// next.config.js rewrites /api/* to the Rust backend.
type BrowserLocation = Pick<Location, 'hostname' | 'port' | 'protocol'>;

export function getApiBaseForLocation(_location: BrowserLocation): string {
  return '';
}

export function getApiBase(): string {
  if (EXPLICIT_BACKEND_URL) return EXPLICIT_BACKEND_URL;

  if (typeof window !== 'undefined') {
    return getApiBaseForLocation(window.location);
  }

  return DEFAULT_BACKEND_URL;
}
