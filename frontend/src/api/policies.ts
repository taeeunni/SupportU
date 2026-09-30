import { apiClient } from './client';
import type { Policy, PolicyDetail, BookmarkResponse } from './types';
import {
  MOCK_POLICIES,
  MOCK_POLICY_DETAILS,
} from './__mocks__/policies.mock';

// VITE_USE_MOCK_DATA=true 인 동안에는 mock 응답을, false면 실제 API를 호출한다.
// 백엔드 API가 구현되면 .env에서 한 줄만 바꾸면 전체 코드가 실제 API로 전환된다.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// mock 응답에 약간의 지연을 주어 실제 네트워크 환경과 비슷하게 시뮬레이션
const MOCK_LATENCY_MS = 150;
const delay = <T>(value: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));

/** 정책 목록 조회 */
export async function fetchPolicies(params?: { category?: string; sort?: string }): Promise<Policy[]> {
  if (USE_MOCK) return delay(MOCK_POLICIES);
  const query = new URLSearchParams();
  if (params?.category && params.category !== '전체') query.set('category', params.category);
  if (params?.sort === '마감일 임박순') query.set('sort', 'deadline');
  const qs = query.toString();
  return apiClient.get<Policy[]>(qs ? `/policies?${qs}` : '/policies');
}

/** 정책 상세 조회 */
export async function fetchPolicyDetail(id: string): Promise<PolicyDetail | null> {
  if (USE_MOCK) return delay(MOCK_POLICY_DETAILS[id] ?? null);
  return apiClient.get<PolicyDetail>(`/policies/${id}`);
}

/** AI 추천 정책 조회 (홈 화면용) */
export async function fetchRecommendedPolicies(): Promise<Policy[]> {
  if (USE_MOCK) return delay(MOCK_POLICIES.slice(0, 3));
  return apiClient.get<Policy[]>('/policies/recommended');
}

/** 북마크된 정책 조회 */
export async function fetchBookmarkedPolicies(): Promise<Policy[]> {
  if (USE_MOCK) return delay(MOCK_POLICIES.filter((p) => p.bookmarked));
  return apiClient.get<Policy[]>('/policies/bookmarked');
}

/**
 * 정책 북마크 상태 변경.
 * 현재 북마크된 상태면 DELETE, 아니면 POST.
 */
export async function togglePolicyBookmark(
    id: string,
    bookmarked: boolean,
): Promise<BookmarkResponse> {
  if (USE_MOCK) {
    console.info('[mock] toggle bookmark', id, bookmarked);
    return { policyId: id, bookmarked: !bookmarked };
  }

  if (bookmarked) {
    return apiClient.delete<BookmarkResponse>(`/policies/${id}/bookmark`);
  }

  return apiClient.post<BookmarkResponse>(`/policies/${id}/bookmark`);
}