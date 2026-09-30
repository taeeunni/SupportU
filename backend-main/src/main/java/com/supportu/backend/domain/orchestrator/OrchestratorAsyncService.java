package com.supportu.backend.domain.orchestrator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrchestratorAsyncService {

    private final OrchestratorClient orchestratorClient;

    @Async
    public void precomputeEligibility(String userId) {
        try {
            orchestratorClient.precomputeEligibility(userId);
        } catch (Exception e) {
            log.warn("자격 검증 사전 계산 오케스트레이터 호출 실패. userId={}", userId, e);
        }
    }
}