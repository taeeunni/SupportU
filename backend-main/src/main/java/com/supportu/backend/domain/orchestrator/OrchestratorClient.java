package com.supportu.backend.domain.orchestrator;

import com.supportu.backend.api.orchestrator.ExtractPolicyDocumentsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class OrchestratorClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${orchestrator.base-url}")
    private String orchestratorBaseUrl;

    public ExtractPolicyDocumentsResponse extractPolicyDocuments(String policyId) {
        return restClientBuilder
                .baseUrl(orchestratorBaseUrl)
                .build()
                .post()
                .uri("/api/orchestrator/extract-policy-documents")
                .body(Map.of("policy_id", policyId))
                .retrieve()
                .body(ExtractPolicyDocumentsResponse.class);
    }

    public void precomputeEligibility(String userId) {
        restClientBuilder
                .baseUrl(orchestratorBaseUrl)
                .build()
                .post()
                .uri("/api/orchestrator/precompute-eligibility")
                .body(Map.of("uid", userId))
                .retrieve()
                .toBodilessEntity();
    }

    public void totalBenefit(String userId) {
        restClientBuilder
                .baseUrl(orchestratorBaseUrl)
                .build()
                .post()
                .uri("/api/orchestrator/total-benefit")
                .body(Map.of("uid", userId))
                .retrieve()
                .toBodilessEntity();
    }
}