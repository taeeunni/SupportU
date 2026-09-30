import { apiClient } from './client';
import type { ProfileRequest, ProfileResponse } from './types';

const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
const MOCK_AUTH_STORAGE_KEY = 'supportu-mock-auth';

const MOCK_PROFILE: ProfileResponse = {
  uid: 'mock-google-id-12345',
  createdAt: new Date().toISOString(),
  age: 26,
  gender: '남성',
  city: '서울',
  scity: '강남구',
  education: '대학교 재학',
  employment: '구직 중',
  disability: false,
  incomeInteger: 2000000,
  asset: '5000만원 미만',
  preferredCategories: ['일자리', '주거'],
};

/** 내 프로필 조회 */
export async function getProfile(): Promise<ProfileResponse | null> {
  if (USE_MOCK_AUTH) {
    const isLoggedIn = typeof window !== 'undefined' && window.localStorage.getItem(MOCK_AUTH_STORAGE_KEY) === '1';
    return isLoggedIn ? MOCK_PROFILE : null;
  }

  try {
    return await apiClient.get<ProfileResponse>('/profiles/me');
  } catch {
    return null;
  }
}

/**
 * 프로필 저장/수정.
 * Mock 모드에선 백엔드 호출 대신 mock 사용자로 인증 처리해 동일한 후속 흐름을 시뮬레이션한다.
 */
export async function saveProfile(data: ProfileRequest): Promise<ProfileResponse> {
  if (USE_MOCK_AUTH) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOCK_AUTH_STORAGE_KEY, '1');
    }

    return {
      uid: 'mock-google-id-12345',
      createdAt: new Date().toISOString(),
      ...data,
    };
  }

  return apiClient.put<ProfileResponse>('/profiles/me', data);
}