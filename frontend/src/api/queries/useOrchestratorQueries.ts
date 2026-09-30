import { useMutation } from '@tanstack/react-query';
import { extractPolicyDocuments } from '../orchestrator';

export function useExtractPolicyDocuments() {
  return useMutation({
    mutationFn: (policyId: string) => extractPolicyDocuments(policyId),
  });
}
