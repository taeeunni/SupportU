import { QueryClient } from '@tanstack/react-query';
import { ApiError, NetworkError } from '../api/client';

// 프로젝트 전역에서 사용하는 QueryClient.
// staleTime/gcTime/retry 정책을 한 곳에 두어 모든 쿼리가 같은 기본값을 따르게 한다.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 인증/프로필처럼 자주 안 바뀌는 데이터를 매 mount마다 다시 안 가져오도록.
      // 신선해야 하는 쿼리는 훅에서 staleTime: 0으로 오버라이드.
      staleTime: 1000 * 60, // 1분
      gcTime: 1000 * 60 * 5, // 5분
      refetchOnWindowFocus: false,
      // 4xx는 재시도하지 않는 게 표준. 5xx/네트워크는 2회까지.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        if (error instanceof NetworkError) {
          return failureCount < 1;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// 쿼리 키는 한 곳에서 관리해 오타/중복을 방지한다.
// 도메인별로 factory를 두어 invalidate/refetch 시에도 정확한 키를 사용한다.
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  policies: {
    all: () => ['policies'] as const,
    list: () => ['policies', 'list'] as const,
    detail: (id: string) => ['policies', 'detail', id] as const,
    recommended: () => ['policies', 'recommended'] as const,
    bookmarked: () => ['policies', 'bookmarked'] as const,
  },
  checklist: {
    all: () => ['checklist'] as const,
    list: () => ['checklist', 'list'] as const,
  },
  calendar: {
    all: () => ['calendar'] as const,
    events: () => ['calendar', 'events'] as const,
  },
  benefits: {
    all: () => ['benefits'] as const,
    summary: (userId: string) => ['benefits', 'summary', userId] as const,
  },
} as const;