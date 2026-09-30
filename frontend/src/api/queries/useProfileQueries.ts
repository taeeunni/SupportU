import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, saveProfile } from '../profile';
import { queryKeys } from '../../lib/queryClient';
import { useAuthUser } from './useAuthQueries';
import type { ProfileRequest, ProfileResponse } from '../types';

/**
 * 내 프로필 조회.
 * 인증된 사용자가 있을 때만 fetch한다 (불필요한 401/500 호출 방지).
 */
export function useProfile() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: getProfile,
    enabled: !!user,
    retry: false,
  });
}

/**
 * 프로필 저장 mutation.
 * 성공 시 캐시를 즉시 갱신하고 auth 정보도 invalidate해서
 * 화면 헤더의 사용자 이름 등이 같이 업데이트되도록 한다.
 */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation<ProfileResponse, Error, ProfileRequest>({
    mutationFn: saveProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile.me(), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.recommended() });
    },
  });
}
