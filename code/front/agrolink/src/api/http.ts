/** Requisições com este header não disparam o overlay global (ex.: polling). */
export const SILENT_LOADING_HEADER = 'X-Agrolink-Silent';

export type ApiFetchInit = RequestInit & { silent?: boolean };

export function apiFetch(input: RequestInfo | URL, init?: ApiFetchInit): Promise<Response> {
  if (!init?.silent) {
    return fetch(input, init);
  }
  const { silent: _silent, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set(SILENT_LOADING_HEADER, '1');
  return fetch(input, { ...rest, headers });
}

export function isApiRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return url.includes('/api/');
}

export function isSilentRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (init?.headers) {
    const h = new Headers(init.headers);
    if (h.get(SILENT_LOADING_HEADER) === '1') return true;
  }
  if (input instanceof Request && input.headers.get(SILENT_LOADING_HEADER) === '1') {
    return true;
  }
  return false;
}
