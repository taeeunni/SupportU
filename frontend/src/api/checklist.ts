import { apiClient } from './client';
import type { ChecklistItem } from './types';
import { MOCK_CHECKLIST } from './__mocks__/checklist.mock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/** 체크리스트 조회 */
export async function fetchChecklist(): Promise<ChecklistItem[]> {
  if (USE_MOCK) return MOCK_CHECKLIST;
  return apiClient.get<ChecklistItem[]>('/checklist');
}

/** 체크리스트 항목 완료 상태 업데이트 */
export async function updateChecklistItem(id: number, done: boolean): Promise<void> {
  if (USE_MOCK) {
    console.info('[mock] update checklist', id, done);
    return;
  }
  await apiClient.put(`/checklist/${id}`, { checked: done });
}
