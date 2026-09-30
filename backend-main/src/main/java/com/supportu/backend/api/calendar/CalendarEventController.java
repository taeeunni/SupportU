package com.supportu.backend.api.calendar;

import com.supportu.backend.domain.calendar.GoogleCalendarService;
import com.supportu.backend.domain.calendar.GoogleCalendarService.GoogleCalendarResult;
import com.supportu.backend.domain.calendar.UserCalendarEvent;
import com.supportu.backend.domain.calendar.UserCalendarEventRepository;
import com.supportu.backend.domain.orchestrator.OrchestratorService;
import com.supportu.backend.domain.policy.Policy;
import com.supportu.backend.domain.policy.PolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.annotation.RegisteredOAuth2AuthorizedClient;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/calendar/events")
@RequiredArgsConstructor
public class CalendarEventController {

    private final UserCalendarEventRepository calendarEventRepository;
    private final PolicyRepository policyRepository;
    private final GoogleCalendarService googleCalendarService;
    private final OrchestratorService orchestratorService;

    @GetMapping
    public List<CalendarEventResponse> getMyCalendarEvents(
            @AuthenticationPrincipal OAuth2User oauth2User
    ) {
        String uid = getGoogleUid(oauth2User);

        return calendarEventRepository.findByUidOrderByEventStartAtAsc(uid).stream()
                .map(event -> {
                    Policy policy = policyRepository.findById(event.getPolicyId()).orElse(null);
                    return CalendarEventResponse.from(event, policy);
                })
                .toList();
    }

    @PostMapping("/from-policy/{policyId}")
    @Transactional
    public CalendarEventResponse createCalendarEventFromPolicy(
            @AuthenticationPrincipal OAuth2User oauth2User,
            @RegisteredOAuth2AuthorizedClient("google") OAuth2AuthorizedClient authorizedClient,
            @PathVariable String policyId
    ) {
        String uid = getGoogleUid(oauth2User);

        Policy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "정책을 찾을 수 없습니다."));

        UserCalendarEvent existingEvent = calendarEventRepository
                .findByUidAndPolicyId(uid, policyId)
                .orElse(null);

        if (existingEvent != null) {
            return CalendarEventResponse.from(existingEvent, policy);
        }

        LocalDateTime eventStartAt = resolveEventStartAt(policy);
        LocalDateTime eventEndAt = eventStartAt.plusHours(1);
        LocalDateTime reminderAt = eventStartAt.minusDays(1);

        String title = "[SupportU] " + firstNonBlank(policy.getTitle(), policy.getPolicyTitle());
        String description = buildDescription(policy);

        GoogleCalendarResult googleResult = googleCalendarService.createPolicyEvent(
                authorizedClient,
                title,
                description,
                eventStartAt,
                eventEndAt
        );

        UserCalendarEvent calendarEvent = new UserCalendarEvent(
                uid,
                policyId,
                googleResult.googleEventId(),
                googleResult.googleEventLink(),
                "pending",
                eventStartAt,
                eventEndAt,
                reminderAt
        );

        UserCalendarEvent savedEvent = calendarEventRepository.save(calendarEvent);

        return CalendarEventResponse.from(savedEvent, policy);
    }

    @PutMapping("/{cid}/status")
    @Transactional
    public CalendarEventResponse updateCalendarEventStatus(
            @AuthenticationPrincipal OAuth2User oauth2User,
            @PathVariable Long cid,
            @RequestBody Map<String, String> request
    ) {
        String uid = getGoogleUid(oauth2User);
        String applyStatus = normalizeApplyStatus(request.get("applyStatus"));

        UserCalendarEvent calendarEvent = calendarEventRepository.findByCidAndUid(cid, uid)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "일정을 찾을 수 없습니다."));

        String previousApplyStatus = normalizeApplyStatus(calendarEvent.getApplyStatus());

        calendarEvent.updateApplyStatus(applyStatus);

        if (!"benefited".equals(previousApplyStatus)
                && "benefited".equals(applyStatus)) {
            orchestratorService.totalBenefit(uid);
        }

        Policy policy = policyRepository.findById(calendarEvent.getPolicyId()).orElse(null);

        return CalendarEventResponse.from(calendarEvent, policy);
    }

    @DeleteMapping("/{cid}")
    @Transactional
    public void deleteCalendarEvent(
            @AuthenticationPrincipal OAuth2User oauth2User,
            @RegisteredOAuth2AuthorizedClient("google") OAuth2AuthorizedClient authorizedClient,
            @PathVariable Long cid
    ) {
        String uid = getGoogleUid(oauth2User);

        UserCalendarEvent calendarEvent = calendarEventRepository.findByCidAndUid(cid, uid)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "일정을 찾을 수 없습니다."));

        googleCalendarService.deleteEvent(authorizedClient, calendarEvent.getGid());
        calendarEventRepository.delete(calendarEvent);
    }

    private String normalizeApplyStatus(String applyStatus) {
        if (applyStatus == null || applyStatus.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "applyStatus 값이 없습니다.");
        }

        if ("pending".equalsIgnoreCase(applyStatus)) {
            return "pending";
        }

        if ("apply_now".equalsIgnoreCase(applyStatus)
                || "applynow".equalsIgnoreCase(applyStatus)
                || "지원 필요".equals(applyStatus)) {
            return "apply_now";
        }

        if ("applied".equalsIgnoreCase(applyStatus)
                || "지원 완료".equals(applyStatus)
                || "결과 대기".equals(applyStatus)) {
            return "applied";
        }

        if ("benefited".equalsIgnoreCase(applyStatus)
                || "수혜 완료".equals(applyStatus)) {
            return "benefited";
        }

        throw new ResponseStatusException(BAD_REQUEST, "지원 상태 값이 올바르지 않습니다.");
    }

    private LocalDateTime resolveEventStartAt(Policy policy) {
        LocalDate eventDate = firstNonNull(
                policy.getPend(),
                policy.getOend(),
                policy.getPstart(),
                policy.getOstart()
        );

        if (eventDate == null) {
            return LocalDateTime.now().plusDays(7).withHour(9).withMinute(0).withSecond(0).withNano(0);
        }

        return LocalDateTime.of(eventDate, LocalTime.of(9, 0));
    }

    private String buildDescription(Policy policy) {
        StringBuilder description = new StringBuilder();

        description.append("정책명: ")
                .append(firstNonBlank(policy.getTitle(), policy.getPolicyTitle()))
                .append("\n");

        description.append("기관: ")
                .append(firstNonBlank(policy.getSourceName(), "지원기관 미상"))
                .append("\n\n");

        description.append("지원 내용:\n")
                .append(firstNonBlank(policy.getSupportContent(), "지원내용 확인 필요"))
                .append("\n\n");

        description.append("신청 방법:\n")
                .append(firstNonBlank(policy.getApplicationMethod(), "신청 방법 확인 필요"))
                .append("\n\n");

        if (policy.getDetailUrl() != null && !policy.getDetailUrl().isBlank()) {
            description.append("원본 공고: ")
                    .append(policy.getDetailUrl());
        }

        return description.toString();
    }

    @SafeVarargs
    private <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }

        return null;
    }

    private String firstNonBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value;
    }

    private String getGoogleUid(OAuth2User oauth2User) {
        String sub = oauth2User.getAttribute("sub");

        if (sub == null || sub.isBlank()) {
            throw new IllegalArgumentException("Google OAuth sub 값이 없습니다.");
        }

        return sub;
    }
}