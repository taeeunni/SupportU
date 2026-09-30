package com.supportu.backend.api.orchestrator;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExtractPolicyDocumentsResponse {

    @JsonAlias("policy_id")
    private String policyId;

    @JsonAlias("document_count")
    private Integer documentCount;

    private List<DocumentResponse> documents;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocumentResponse {

        @JsonAlias({"doc_id", "id"})
        private Long id;

        @JsonAlias({"doc_name", "name"})
        private String name;

        @JsonAlias({"is_required", "required"})
        private Boolean required;

        @JsonAlias({"doc_guide", "description", "guide"})
        private String description;

        @JsonAlias({"doc_url", "url"})
        private String url;
    }
}