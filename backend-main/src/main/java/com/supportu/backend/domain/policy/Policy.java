package com.supportu.backend.domain.policy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@Table(name = "policies")
public class Policy {

    @Id
    @Column(name = "policy_id")
    private String policyId;

    @Column(name = "policy_title")
    private String policyTitle;

    @Column(name = "title")
    private String title;

    @Column(name = "source_name")
    private String sourceName;

    @Column(name = "support_content")
    private String supportContent;

    @Column(name = "region")
    private String region;

    @Column(name = "scity")
    private String scity;

    @Column(name = "category")
    private String category;

    @Column(name = "pend")
    private LocalDate pend;

    @Column(name = "pstart")
    private LocalDate pstart;

    @Column(name = "ostart")
    private LocalDate ostart;

    @Column(name = "oend")
    private LocalDate oend;

    @Column(name = "amin")
    private BigDecimal amin;

    @Column(name = "amax")
    private BigDecimal amax;

    @Column(name = "income")
    private String income;

    @Column(name = "asset")
    private String asset;

    @Column(name = "education")
    private String education;

    @Column(name = "employment")
    private String employment;

    @Column(name = "disability")
    private String disability;

    @Column(name = "gender")
    private String gender;

    @Column(name = "required_documents")
    private String requiredDocuments;

    @Column(name = "application_method")
    private String applicationMethod;

    @Column(name = "eligibility")
    private String eligibility;

    @Column(name = "add_condition")
    private String addCondition;

    @Column(name = "detail_url")
    private String detailUrl;

    @Column(name = "sync_updated_at")
    private LocalDateTime syncUpdatedAt;
}