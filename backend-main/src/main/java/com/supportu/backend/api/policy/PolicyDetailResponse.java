package com.supportu.backend.api.policy;

import com.supportu.backend.domain.policy.Policy;

import java.util.List;

public record PolicyDetailResponse(
        String fullDesc,
        List<String> benefits,
        String amount,
        String scope,
        String duration,
        String target,
        String method,
        List<EligibilityItem> eligibility,
        String detailUrl
) {
    public static PolicyDetailResponse from(Policy policy) {
        return new PolicyDetailResponse(
                firstNonBlank(policy.getSupportContent(), "지원 내용 확인 필요"),
                parseBenefits(policy.getSupportContent()),
                firstNonBlank(policy.getSupportContent(), "지원금 확인 필요"),
                firstNonBlank(policy.getSupportContent(), "지원 범위 확인 필요"),
                toDuration(policy),
                firstNonBlank(policy.getEligibility(), "지원 대상 확인 필요"),
                firstNonBlank(policy.getApplicationMethod(), "신청 방법 확인 필요"),
                List.of(
                        new EligibilityItem("연령", toAgeCondition(policy)),
                        new EligibilityItem("지역", toRegionCondition(policy)),
                        new EligibilityItem("소득", firstNonBlank(policy.getIncome(), "제한 없음 또는 확인 필요")),
                        new EligibilityItem("취업 상태", firstNonBlank(policy.getEmployment(), "제한 없음 또는 확인 필요"))
                ),
                policy.getDetailUrl()
        );
    }

    private static List<String> parseBenefits(String supportContent) {
        if (supportContent == null || supportContent.isBlank()) {
            return List.of("지원 내용 확인 필요");
        }

        return List.of(supportContent);
    }

    private static String toDuration(Policy policy) {
        if (policy.getPstart() == null && policy.getPend() == null) {
            return "상시 또는 공고문 확인 필요";
        }

        if (policy.getPstart() == null) {
            return "~ " + policy.getPend();
        }

        if (policy.getPend() == null) {
            return policy.getPstart() + " ~";
        }

        return policy.getPstart() + " ~ " + policy.getPend();
    }

    private static String toAgeCondition(Policy policy) {
        if (policy.getAmin() == null && policy.getAmax() == null) {
            return "연령 제한 확인 필요";
        }

        if (policy.getAmin() == null) {
            return "만 " + policy.getAmax().intValue() + "세 이하";
        }

        if (policy.getAmax() == null) {
            return "만 " + policy.getAmin().intValue() + "세 이상";
        }

        return "만 " + policy.getAmin().intValue() + "세 ~ " + policy.getAmax().intValue() + "세";
    }

    private static String toRegionCondition(Policy policy) {
        String region = firstNonBlank(policy.getRegion(), "전국");
        String scity = policy.getScity();

        if (scity == null || scity.isBlank()) {
            return region;
        }

        return region + " " + scity;
    }

    private static String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value;
    }

    public record EligibilityItem(
            String label,
            String value
    ) {
    }
}