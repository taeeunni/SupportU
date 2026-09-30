package com.supportu.backend.domain.policy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PolicyDocumentRepository extends JpaRepository<PolicyDocument, Long> {

    List<PolicyDocument> findTop10ByOrderByCreatedAtDesc();

    List<PolicyDocument> findByPolicyIdOrderByDocIdAsc(String policyId);

    boolean existsByPolicyId(String policyId);

    void deleteByPolicyId(String policyId);
}