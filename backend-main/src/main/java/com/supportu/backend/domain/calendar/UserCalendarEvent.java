package com.supportu.backend.domain.calendar;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "user_calendar_events")
public class UserCalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cid")
    private Long cid;

    @Column(name = "uid", nullable = false)
    private String uid;

    @Column(name = "policy_id", nullable = false)
    private String policyId;

    @Column(name = "gid")
    private String gid;

    @Column(name = "elink")
    private String elink;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "apply_status")
    private String applyStatus;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "apply_reason")
    private String applyReason;

    @Column(name = "event_start_at")
    private LocalDateTime eventStartAt;

    @Column(name = "event_end_at")
    private LocalDateTime eventEndAt;

    @Column(name = "reminder_at")
    private LocalDateTime reminderAt;

    public UserCalendarEvent(
            String uid,
            String policyId,
            String gid,
            String elink,
            String applyStatus,
            LocalDateTime eventStartAt,
            LocalDateTime eventEndAt,
            LocalDateTime reminderAt
    ) {
        this.uid = uid;
        this.policyId = policyId;
        this.gid = gid;
        this.elink = elink;
        this.applyStatus = applyStatus;
        this.eventStartAt = eventStartAt;
        this.eventEndAt = eventEndAt;
        this.reminderAt = reminderAt;
        this.createdAt = LocalDateTime.now();
    }

    public void updateGoogleCalendarInfo(String gid, String elink) {
        this.gid = gid;
        this.elink = elink;
    }

    public void updateApplyStatus(String applyStatus) {
        this.applyStatus = applyStatus;

        if ("applied".equalsIgnoreCase(applyStatus)
                || "benefited".equalsIgnoreCase(applyStatus)
                || "apply_now".equalsIgnoreCase(applyStatus)
                || "applynow".equalsIgnoreCase(applyStatus)
                || "지원 완료".equals(applyStatus)
                || "수혜 완료".equals(applyStatus)) {
            this.appliedAt = LocalDateTime.now();
        }
    }
}