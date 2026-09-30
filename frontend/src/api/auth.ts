import { apiClient, ApiError, NetworkError } from './client';
import type { AuthUser } from './types';

/**
 * 인증 모듈.
 *
 * 두 가지 모드를 지원한다:
 * 1. 실제 OAuth2 모드 (VITE_MOCK_AUTH=false)
 *    - `/oauth2/authorization/google`로 리다이렉트 → 구글 인증 → 백엔드 세션 → `/api/auth/success`
 * 2. Mock 모드 (VITE_MOCK_AUTH=true)
 *    - 백엔드 없이 동일한 UX를 시뮬레이션. 로그인 버튼 클릭 시 localStorage에 플래그 저장 후 홈으로 이동.
 *    - 새로고침 후에도 로그인 상태 유지. 로그아웃 시 플래그 제거.
 *
 * 컴포넌트 코드는 모드를 알 필요가 없도록 같은 함수 시그니처를 유지한다.
 */

const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
const MOCK_AUTH_STORAGE_KEY = 'supportu-mock-auth';

const MOCK_USER: AuthUser = {
  message: '로그인 성공 (mock)',
  name: '김지원',
  email: 'mock@supportu.dev',
  attributes: {
    sub: 'mock-google-id-12345',
    name: '김지원',
    email: 'mock@supportu.dev',
    picture: '',
  },
};

function getBackendBaseUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  return apiBaseUrl.replace(/\/api\/?$/, '');
}

function isMockAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MOCK_AUTH_STORAGE_KEY) === '1';
}

function setMockAuthenticated(value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(MOCK_AUTH_STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  }
}

/**
 * 현재 로그인된 사용자 조회.
 * 인증 여부를 판별하는 단일 진실 공급원이므로 *어떤 에러도 throw하지 않고* null을 반환한다.
 *
 * - 200 + body  → 로그인 됨
 * - 401         → 미로그인 (정상)
 * - 500         → 백엔드가 미인증 OAuth2User를 처리 못해 NullPointerException을 던지는 케이스.
 *                 의미상 "미로그인"이므로 null 처리. (백엔드에서 401로 응답하도록 수정되면 이 분기 제거 가능)
 * - 네트워크 에러 → 백엔드 다운. 미로그인으로 처리.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (USE_MOCK_AUTH) {
    return isMockAuthenticated() ? MOCK_USER : null;
  }

  try {
    return await apiClient.get<AuthUser>('/auth/success');
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.isUnauthorized) return null;
      if (err.status === 500) {
        console.warn('[auth] /auth/success 500 - 미인증 상태로 처리합니다.');
        return null;
      }
    }
    if (err instanceof NetworkError) {
      console.warn('[auth] 백엔드 연결 실패:', err.message);
      return null;
    }
    console.error('[auth] 예상치 못한 에러:', err);
    return null;
  }
}

/**
 * 로그인 흐름 시작.
 * 실제 모드: 백엔드 OAuth2 엔드포인트로 리다이렉트.
 * Mock 모드: localStorage 플래그를 세우고 홈으로 이동해 실제 OAuth 리다이렉트 후 흐름을 시뮬레이션.
 */
export function initiateGoogleLogin(): void {
  if (USE_MOCK_AUTH) {
    setMockAuthenticated(true);
    window.location.href = '/';
    return;
  }
  window.location.href = `${getBackendBaseUrl()}/oauth2/authorization/google`;
}

/**
 * 로그아웃.
 * Mock 모드: localStorage 플래그 제거.
 * 실제 모드: 백엔드 세션 무효화.
 */
export async function logout(): Promise<void> {
  if (USE_MOCK_AUTH) {
    setMockAuthenticated(false);
    window.location.href = '/';
    return;
  }
  try {
    await apiClient.post('/logout');
  } finally {
    window.location.href = '/';
  }
}