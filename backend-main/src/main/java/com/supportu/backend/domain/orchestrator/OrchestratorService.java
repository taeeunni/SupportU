package com.supportu.backend.domain.orchestrator;

import com.supportu.backend.api.orchestrator.ExtractPolicyDocumentsResponse;
import com.supportu.backend.domain.policy.PolicyDocument;
import com.supportu.backend.domain.policy.PolicyDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrchestratorService {

    private final OrchestratorClient orchestratorClient;
    private final PolicyDocumentRepository policyDocumentRepository;

    @Transactional
    public ExtractPolicyDocumentsResponse extractPolicyDocuments(String policyId) {
        List<PolicyDocument> existingDocuments = policyDocumentRepository.findByPolicyIdOrderByDocIdAsc(policyId);

        if (!existingDocuments.isEmpty()) {
            return toResponse(policyId, existingDocuments);
        }

        ExtractPolicyDocumentsResponse response = orchestratorClient.extractPolicyDocuments(policyId);

        if (response == null || response.getDocuments() == null || response.getDocuments().isEmpty()) {
            return new ExtractPolicyDocumentsResponse(policyId, 0, List.of());
        }

        List<PolicyDocument> documents = response.getDocuments().stream()
                .map(document -> PolicyDocument.create(
                        policyId,
                        document.getName(),
                        document.getRequired(),
                        document.getDescription(),
                        document.getUrl()
                ))
                .collect(Collectors.toList());

        List<PolicyDocument> savedDocuments = policyDocumentRepository.saveAll(documents);

        return toResponse(policyId, savedDocuments);
    }

    private ExtractPolicyDocumentsResponse toResponse(String policyId, List<PolicyDocument> documents) {
        List<ExtractPolicyDocumentsResponse.DocumentResponse> documentResponses = documents.stream()
                .map(document -> new ExtractPolicyDocumentsResponse.DocumentResponse(
                        document.getDocId(),
                        document.getDocName(),
                        document.getRequired(),
                        document.getDocGuide(),
                        document.getDocUrl()
                ))
                .collect(Collectors.toList());

        return new ExtractPolicyDocumentsResponse(
                policyId,
                documentResponses.size(),
                documentResponses
        );
    }

    public void totalBenefit(String userId) {
        orchestratorClient.totalBenefit(userId);
    }
}