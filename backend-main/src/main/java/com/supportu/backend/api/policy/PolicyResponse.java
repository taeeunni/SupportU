package com.supportu.backend.api.policy;

import com.supportu.backend.domain.policy.Policy;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record PolicyResponse(
        String id,
        String title,
        String org,
        String category,
        String categoryKr,
        String deadline,
        String support,
        String desc,
        String region,
        boolean bookmarked,
        String detailUrl
) {
    public static PolicyResponse from(Policy policy) {
        return from(policy, false);
    }

    public static PolicyResponse from(Policy policy, boolean bookmarked) {
        return new PolicyResponse(
                policy.getPolicyId(),
                firstNonBlank(policy.getTitle(), policy.getPolicyTitle()),
                firstNonBlank(policy.getSourceName(), "지원기관 미상"),
                toFrontendCategory(policy.getCategory()),
                toKoreanCategory(policy.getCategory()),
                toDeadline(policy.getPend()),
                firstNonBlank(policy.getSupportContent(), "지원내용 확인 필요"),
                firstNonBlank(policy.getSupportContent(), "지원 내용 확인 필요"),
                firstNonBlank(policy.getRegion(), "전국"),
                bookmarked,
                policy.getDetailUrl()
        );
    }

    private static String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value;
    }

    private static String toDeadline(LocalDate endDate) {
        if (endDate == null) {
            return "상시";
        }

        long days = ChronoUnit.DAYS.between(LocalDate.now(), endDate);

        if (days < 0) {
            return "마감";
        }

        if (days == 0) {
            return "D-day";
        }

        return "D-" + days;
    }

    private static String toFrontendCategory(String category) {
        String value = category == null ? "" : category;

        if (value.contains("주거")) {
            return "Housing";
        }

        if (value.contains("일자리") || value.contains("취업") || value.contains("창업")) {
            return "Jobs";
        }

        if (value.contains("복지") || value.contains("금융") || value.contains("건강")) {
            return "Welfare";
        }

        return "Welfare";
    }

    private static String toKoreanCategory(String category) {
        String value = category == null ? "" : category;

        if (value.contains("주거")) {
            return "주거";
        }

        if (value.contains("일자리") || value.contains("취업") || value.contains("창업")) {
            return "일자리";
        }

        if (value.contains("복지") || value.contains("금융") || value.contains("건강")) {
            return "복지";
        }

        return firstNonBlank(category, "복지");
    }
}