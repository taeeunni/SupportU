package com.supportu.backend.domain.policy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "policy_documents")
public class PolicyDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "doc_id")
    private Long docId;

    @Column(name = "policy_id")
    private String policyId;

    @Column(name = "doc_name")
    private String docName;

    @Column(name = "is_required")
    private Boolean required;

    @Column(name = "doc_guide")
    private String docGuide;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "doc_url")
    private String docUrl;

    private PolicyDocument(String policyId, String docName, Boolean required, String docGuide, String docUrl) {
        this.policyId = policyId;
        this.docName = docName;
        this.required = required;
        this.docGuide = docGuide;
        this.docUrl = docUrl;
    }

    public static PolicyDocument create(String policyId, String docName, Boolean required, String docGuide, String docUrl) {
        return new PolicyDocument(policyId, docName, required, docGuide, docUrl);
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}