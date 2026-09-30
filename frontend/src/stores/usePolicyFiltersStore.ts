import { create } from 'zustand';

// URL 동기화가 필요한 필터/정렬은 React Router searchParams로 처리하는 게 더 좋지만,
// 페이지 간 이동 시에도 유지하고 싶은 사용자 선호도는 store로 둔다.

export type CategoryFilter = '전체' | '주거' | '일자리' | '복지';
export type SortOption = '마감일 임박순' | '최신순';

interface PolicyFiltersState {
  category: CategoryFilter;
  sort: SortOption;
  setCategory: (category: CategoryFilter) => void;
  setSort: (sort: SortOption) => void;
  reset: () => void;
}

export const usePolicyFiltersStore = create<PolicyFiltersState>((set) => ({
  category: '전체',
  sort: '마감일 임박순',
  setCategory: (category) => set({ category }),
  setSort: (sort) => set({ sort }),
  reset: () => set({ category: '전체', sort: '마감일 임박순' }),
}));
