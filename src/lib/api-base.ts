const DEFAULT_BACKEND_URL = 'http://localhost:3008';
const EXPLICIT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type BrowserLocation = Pick<Location, 'hostname' | 'port' | 'protocol'>;

function incrementPort(value: string): string | null {
  const port = Number.parseInt(value, 10);
  if (!Number.isFinite(port) || port <= 0 || port >= 65535) return null;
  return String(port + 1);
}

function inferForwardedBackendOrigin(location: BrowserLocation): string | null {
  const forwardedHost = location.hostname.match(/^port-(\d+)(\..+)$/);
  if (!forwardedHost) return null;

  const backendPort = incrementPort(forwardedHost[1]);
  if (!backendPort) return null;

  return `${location.protocol}//port-${backendPort}${forwardedHost[2]}`;
}

function inferLocalBackendOrigin(location: BrowserLocation): string | null {
  if (!location.port) return null;

  const backendPort = incrementPort(location.port);
  if (!backendPort) return null;

  return `${location.protocol}//${location.hostname}:${backendPort}`;
}

export function getApiBaseForLocation(location: BrowserLocation): string {
  return inferForwardedBackendOrigin(location)
    ?? inferLocalBackendOrigin(location)
    ?? DEFAULT_BACKEND_URL;
}

export function getApiBase(): string {
  if (EXPLICIT_BACKEND_URL) return EXPLICIT_BACKEND_URL;

  if (typeof window !== 'undefined') {
    return getApiBaseForLocation(window.location);
  }

  return DEFAULT_BACKEND_URL;
}
