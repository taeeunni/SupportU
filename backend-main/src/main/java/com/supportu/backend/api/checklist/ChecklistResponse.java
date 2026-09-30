package com.supportu.backend.api.checklist;

import com.supportu.backend.domain.policy.Policy;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record ChecklistResponse(
        long id,
        String policyId,
        String policyName,
        String documentName,
        String category,
        String deadlineText,
        boolean checked,
        String label,
        String deadline,
        String categoryColor,
        String categoryBg,
        String deadlineColor,
        String deadlineBg,
        boolean done
) {
    public static ChecklistResponse from(long id, Policy policy, boolean checked) {
        String policyName = firstNonBlank(policy.getTitle(), policy.getPolicyTitle());
        String taskName = policyName + " 신청";
        String category = toKoreanCategory(policy.getCategory());
        String deadlineText = toDeadline(policy);
        boolean urgent = deadlineText.equals("D-day") || deadlineText.equals("D-1");

        return new ChecklistResponse(
                id,
                policy.getPolicyId(),
                policyName,
                taskName,
                category,
                deadlineText,
                checked,
                taskName,
                deadlineText,
                categoryColor(category),
                categoryBg(category),
                urgent ? "#ba1a1a" : "#f97316",
                urgent ? "rgba(186,26,26,0.1)" : "#fff7ed",
                checked
        );
    }

    private static String toDeadline(Policy policy) {
        if (policy.getPend() == null) {
            return "상시";
        }

        long days = ChronoUnit.DAYS.between(LocalDate.now(), policy.getPend());

        if (days < 0) {
            return "마감";
        }

        if (days == 0) {
            return "D-day";
        }

        return "D-" + days;
    }

    private static String toKoreanCategory(String category) {
        String value = category == null ? "" : category;

        if (value.contains("주거")) return "주거";
        if (value.contains("일자리") || value.contains("취업") || value.contains("창업")) return "일자리";
        if (value.contains("복지") || value.contains("금융") || value.contains("건강")) return "복지";

        return "복지";
    }

    private static String categoryColor(String category) {
        return switch (category) {
            case "주거" -> "#2563eb";
            case "일자리" -> "#16a34a";
            case "복지" -> "#9333ea";
            default -> "#64748b";
        };
    }

    private static String categoryBg(String category) {
        return switch (category) {
            case "주거" -> "#eff6ff";
            case "일자리" -> "#f0fdf4";
            case "복지" -> "#faf5ff";
            default -> "#f8fafc";
        };
    }

    private static String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value;
    }
}