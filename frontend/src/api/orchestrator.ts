import { apiClient } from './client';
import type { ExtractPolicyDocumentsResponse } from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

const mockExtractPolicyDocuments = (
  policyId: string,
): ExtractPolicyDocumentsResponse => ({
  policyId,
  documentCount: 3,
  documents: [
    {
      id: 1,
      name: '신청서',
      required: true,
      description: '정책 신청 시 기본 제출',
      url: null,
    },
    {
      id: 2,
      name: '주민등록등본',
      required: true,
      description: '거주지 확인용',
      url: null,
    },
    {
      id: 3,
      name: '소득 증빙 서류',
      required: false,
      description: '해당자 제출',
      url: null,
    },
  ],
});

export async function extractPolicyDocuments(
  policyId: string,
): Promise<ExtractPolicyDocumentsResponse> {
  if (USE_MOCK) {
    return mockExtractPolicyDocuments(policyId);
  }

  return apiClient.post<ExtractPolicyDocumentsResponse>(
    '/orchestrator/extract-policy-documents',
    { policyId },
  );
}
