import JSONbig from 'json-bigint';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const DEFAULT_TIMEOUT_MS = 15_000;

const jsonParser = JSONbig({ storeAsString: true });

// HTTP 응답을 받았으나 상태 코드가 실패인 경우 (4xx, 5xx)
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

// 네트워크 단절, CORS, 타임아웃 등 응답 자체를 못 받은 경우
export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  // 인증 필요한 요청에서 401이 와도 throw하지 않고 null 반환 받으려면 true
  // (현재 로그인 상태 확인용)
  allowUnauthorized?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const text = await res.text();
      return jsonParser.parse(text);
    } catch {
      return null;
    }
  }
  const text = await res.text();
  return text || null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NetworkError(`요청 시간 초과 (${timeoutMs}ms): ${path}`, err);
    }
    throw new NetworkError(`네트워크 오류: ${path}`, err);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errorBody = await parseBody(res);
    const message = extractErrorMessage(errorBody, res.statusText);
    throw new ApiError(res.status, message, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  if (typeof body === 'string' && body.length > 0) return body;
  return fallback;
}

export const apiClient = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};


