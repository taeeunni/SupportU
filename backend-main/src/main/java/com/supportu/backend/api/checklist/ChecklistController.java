package com.supportu.backend.api.checklist;

import com.supportu.backend.domain.bookmark.Bookmark;
import com.supportu.backend.domain.bookmark.BookmarkRepository;
import com.supportu.backend.domain.calendar.UserCalendarEvent;
import com.supportu.backend.domain.calendar.UserCalendarEventRepository;
import com.supportu.backend.domain.policy.Policy;
import com.supportu.backend.domain.policy.PolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/checklist")
@RequiredArgsConstructor
public class ChecklistController {

    private static final String STATUS_APPLIED = "applied";
    private static final String STATUS_REQUIRED = "apply_now";

    private final PolicyRepository policyRepository;
    private final BookmarkRepository bookmarkRepository;
    private final UserCalendarEventRepository userCalendarEventRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<ChecklistResponse> getChecklist(
            @AuthenticationPrincipal OAuth2User oauth2User
    ) {
        String uid = getGoogleUid(oauth2User);

        List<String> bookmarkedPolicyIds = getBookmarkedPolicyIds(uid);

        if (bookmarkedPolicyIds.isEmpty()) {
            return List.of();
        }

        Set<String> completedPolicyIds = userCalendarEventRepository.findByUidOrderByEventStartAtAsc(uid)
                .stream()
                .filter(event -> isCompleted(event.getApplyStatus()))
                .map(UserCalendarEvent::getPolicyId)
                .collect(Collectors.toSet());

        List<String> checklistPolicyIds = bookmarkedPolicyIds.stream()
                .filter(policyId -> !completedPolicyIds.contains(policyId))
                .toList();

        if (checklistPolicyIds.isEmpty()) {
            return List.of();
        }

        Map<String, Policy> policiesById = policyRepository.findAllById(checklistPolicyIds)
                .stream()
                .collect(Collectors.toMap(Policy::getPolicyId, Function.identity()));

        return checklistPolicyIds.stream()
                .map(policiesById::get)
                .filter(policy -> policy != null)
                .map(policy -> ChecklistResponse.from(
                        createStableId(uid, policy.getPolicyId()),
                        policy,
                        false
                ))
                .limit(10)
                .toList();
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateChecklistItem(
            @AuthenticationPrincipal OAuth2User oauth2User,
            @PathVariable Long id,
            @RequestBody ChecklistUpdateRequest request
    ) {
        String uid = getGoogleUid(oauth2User);
        String policyId = findPolicyIdByChecklistId(uid, id);

        Policy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new NoSuchElementException("정책을 찾을 수 없습니다. policyId=" + policyId));

        UserCalendarEvent event = userCalendarEventRepository.findByUidAndPolicyId(uid, policyId)
                .orElseGet(() -> new UserCalendarEvent(
                        uid,
                        policyId,
                        null,
                        null,
                        STATUS_REQUIRED,
                        toEventDateTime(policy),
                        toEventDateTime(policy),
                        toEventDateTime(policy)
                ));

        event.updateApplyStatus(request.checked() ? STATUS_APPLIED : STATUS_REQUIRED);
        userCalendarEventRepository.save(event);

        return Map.of(
                "id", id,
                "checked", request.checked()
        );
    }

    private String findPolicyIdByChecklistId(String uid, Long checklistId) {
        return getBookmarkedPolicyIds(uid)
                .stream()
                .filter(policyId -> createStableId(uid, policyId) == checklistId)
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("체크리스트 항목을 찾을 수 없습니다."));
    }

    private List<String> getBookmarkedPolicyIds(String uid) {
        return bookmarkRepository.findByUidOrderByCreatedAtDesc(uid)
                .stream()
                .map(Bookmark::getPolicyId)
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();
    }

    private boolean isCompleted(String applyStatus) {
        return STATUS_APPLIED.equalsIgnoreCase(applyStatus)
                || "지원 완료".equals(applyStatus);
    }

    private LocalDateTime toEventDateTime(Policy policy) {
        if (policy.getPend() == null) {
            return LocalDateTime.now();
        }

        return policy.getPend().atStartOfDay();
    }

    private String getGoogleUid(OAuth2User oauth2User) {
        String sub = oauth2User.getAttribute("sub");

        if (sub == null || sub.isBlank()) {
            throw new IllegalArgumentException("Google OAuth sub 값이 없습니다.");
        }

        return sub;
    }

    private long createStableId(String uid, String policyId) {
        String raw = uid + ":" + policyId;
        return Math.abs((long) raw.hashCode());
    }
}