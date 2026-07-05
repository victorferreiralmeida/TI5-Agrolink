import { isApiRequest, isSilentRequest } from '../api/http';

export type FetchLoadingHandlers = {
  onStart: (label?: string) => void;
  onEnd: () => void;
};

let installed = false;
let nativeFetch: typeof fetch;

/** Handlers estáveis; LoadingProvider atualiza os refs a cada render. */
export const fetchLoadingHandlers: FetchLoadingHandlers = {
  onStart: () => {},
  onEnd: () => {},
};

/** Desativa overlay ao desmontar o provider. */
export function clearFetchLoadingHandlers() {
  fetchLoadingHandlers.onStart = () => {};
  fetchLoadingHandlers.onEnd = () => {};
}

/** ngrok free: sem este header o POST /api/* responde 403 no browser. */
const NGROK_SKIP_HEADER = 'ngrok-skip-browser-warning';

function isNgrokHost(): boolean {
  const h = window.location.hostname;
  return h.includes('ngrok-free.dev') || h.includes('ngrok-free.app');
}

function withNgrokHeaders(input: RequestInfo | URL, init?: RequestInit): [RequestInfo | URL, RequestInit?] {
  if (!isNgrokHost()) return [input, init];

  if (input instanceof Request) {
    const headers = new Headers(input.headers);
    headers.set(NGROK_SKIP_HEADER, 'true');
    const req = new Request(input, { headers });
    return [req, init];
  }

  const headers = new Headers(init?.headers);
  headers.set(NGROK_SKIP_HEADER, 'true');
  return [input, { ...init, headers }];
}

/** Instala o patch de fetch uma vez, antes do primeiro render (main.tsx). */
export function installFetchLoadingInterceptor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const [nextInput, nextInit] = withNgrokHeaders(input, init);
    const track = isApiRequest(nextInput, nextInit) && !isSilentRequest(nextInput, nextInit);
    if (track) fetchLoadingHandlers.onStart();
    try {
      return await nativeFetch(nextInput, nextInit);
    } finally {
      if (track) fetchLoadingHandlers.onEnd();
    }
  };
}
