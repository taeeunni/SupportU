package com.supportu.backend.api.orchestrator;

import com.supportu.backend.domain.orchestrator.OrchestratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/orchestrator")
@RequiredArgsConstructor
public class OrchestratorController {

    private final OrchestratorService orchestratorService;

    @PostMapping("/extract-policy-documents")
    public ExtractPolicyDocumentsResponse extractPolicyDocuments(
            @RequestBody ExtractPolicyDocumentsRequest request
    ) {
        if (request.policyId() == null || request.policyId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "정책 ID가 필요합니다.");
        }

        ExtractPolicyDocumentsResponse response = orchestratorService.extractPolicyDocuments(request.policyId());

        if (response == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "오케스트레이터 응답이 없습니다.");
        }

        return response;
    }
}