import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPolicies,
  fetchPolicyDetail,
  fetchRecommendedPolicies,
  fetchBookmarkedPolicies,
  togglePolicyBookmark,
} from '../policies';
import { queryKeys } from '../../lib/queryClient';
import type { Policy, BookmarkResponse } from '../types';

type ToggleBookmarkVariables = {
  id: string;
  bookmarked: boolean;
};

type ToggleBookmarkContext = {
  previousList?: Policy[];
  previousRecommended?: Policy[];
  previousBookmarked?: Policy[];
};

export function usePolicies(params?: { category?: string; sort?: string }) {
  return useQuery({
    queryKey: [...queryKeys.policies.list(), params?.category, params?.sort],
    queryFn: () => fetchPolicies(params),
  });
}

export function usePolicyDetail(policyId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.policies.detail(policyId ?? ''),
    queryFn: () => fetchPolicyDetail(policyId!),
    enabled: !!policyId,
  });
}

export function useRecommendedPolicies() {
  return useQuery({
    queryKey: queryKeys.policies.recommended(),
    queryFn: fetchRecommendedPolicies,
  });
}

export function useBookmarkedPolicies() {
  return useQuery({
    queryKey: queryKeys.policies.bookmarked(),
    queryFn: fetchBookmarkedPolicies,
  });
}

/**
 * 북마크 토글 mutation - optimistic update 패턴 적용.
 * 사용자 클릭 즉시 UI에 반영하고, 실패 시 롤백한다.
 */
export function useTogglePolicyBookmark() {
  const queryClient = useQueryClient();

  return useMutation<BookmarkResponse, Error, ToggleBookmarkVariables, ToggleBookmarkContext>({
    mutationFn: ({ id, bookmarked }) => togglePolicyBookmark(id, bookmarked),

    onMutate: async ({ id, bookmarked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.policies.list() }),
        queryClient.cancelQueries({ queryKey: queryKeys.policies.recommended() }),
        queryClient.cancelQueries({ queryKey: queryKeys.policies.bookmarked() }),
      ]);

      const previousList = queryClient.getQueryData<Policy[]>(queryKeys.policies.list());
      const previousRecommended = queryClient.getQueryData<Policy[]>(
          queryKeys.policies.recommended(),
      );
      const previousBookmarked = queryClient.getQueryData<Policy[]>(
          queryKeys.policies.bookmarked(),
      );

      const toggleInList = (items?: Policy[]) =>
          items?.map((policy) =>
              policy.id === id
                  ? { ...policy, bookmarked: !policy.bookmarked }
                  : policy,
          );

      if (previousList) {
        queryClient.setQueryData<Policy[]>(
            queryKeys.policies.list(),
            toggleInList(previousList),
        );
      }

      if (previousRecommended) {
        queryClient.setQueryData<Policy[]>(
            queryKeys.policies.recommended(),
            toggleInList(previousRecommended),
        );
      }

      if (previousBookmarked) {
        if (bookmarked) {
          // 북마크 제거: 캐시에서 즉시 삭제
          queryClient.setQueryData<Policy[]>(
              queryKeys.policies.bookmarked(),
              previousBookmarked.filter((policy) => policy.id !== id),
          );
        } else {
          // 북마크 추가: recommended/list 캐시에서 찾아 즉시 삽입
          const policyToAdd =
              previousRecommended?.find((p) => p.id === id) ??
              previousList?.find((p) => p.id === id);
          if (policyToAdd) {
            queryClient.setQueryData<Policy[]>(
                queryKeys.policies.bookmarked(),
                [...previousBookmarked, { ...policyToAdd, bookmarked: true }],
            );
          }
        }
      }

      return {
        previousList,
        previousRecommended,
        previousBookmarked,
      };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.policies.list(), context.previousList);
      }

      if (context?.previousRecommended) {
        queryClient.setQueryData(
            queryKeys.policies.recommended(),
            context.previousRecommended,
        );
      }

      if (context?.previousBookmarked) {
        queryClient.setQueryData(
            queryKeys.policies.bookmarked(),
            context.previousBookmarked,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.recommended() });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.bookmarked() });
    },
  });
}