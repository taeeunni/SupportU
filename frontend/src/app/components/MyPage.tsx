import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import imgUserAvatar from "figma:asset/d53360f080d65508be933ce1738e47c95909ed9e.png";
import type { Policy, PolicyDetail, PolicyDocument } from "../../api/types";
import type { CalendarApplyStatus, CalendarEvent } from "../../api/calendar";
import { fetchPolicyDetail } from "../../api/policies";
import { queryKeys } from "../../lib/queryClient";
import { useBookmarkedPolicies, usePolicyDetail, useRecommendedPolicies, useTogglePolicyBookmark } from "../../api/queries/usePolicyQueries";
import { useAuthUser } from "../../api/queries/useAuthQueries";
import { useProfile, useSaveProfile } from "../../api/queries/useProfileQueries";
import { useBenefitSummary } from "../../api/queries/useBenefitQueries";
import { useCalendarEvents, useCreateCalendarEventFromPolicy, useUpdateCalendarEventStatus } from "../../api/queries/useCalendarQueries";
import { useExtractPolicyDocuments } from "../../api/queries/useOrchestratorQueries";
import { useCompareStore } from "../../stores/useCompareStore";
import { P } from "./common/Typography";
import { PolicyDetailSidePanel } from "./common/PolicyDetailSidePanel";
import { getCategoryStyle } from "../../constants/categories";

/* ─────────────────────────── Data ─────────────────────────── */

type MyPagePolicy = Policy;

type PolicyCategoryLabel = "주거" | "일자리" | "복지";
type DashboardCategoryFilter = "전체" | PolicyCategoryLabel;
type ProfileInterest = "주거" | "일자리" | "복지";

type ProfileFormState = {
  email: string;
  age: string;
  gender: string;
  region: string;
  district: string;
  education: string;
  employmentStatus: string;
  hasDisability: boolean;
  annualIncome: string;
  assets: string;
  createdAt: string;
  interests: ProfileInterest[];
};

const emptyProfileData: ProfileFormState = {
  email: "",
  age: "",
  gender: "",
  region: "",
  district: "",
  education: "",
  employmentStatus: "",
  hasDisability: false,
  annualIncome: "",
  assets: "",
  createdAt: "",
  interests: [],
};

const districtsByRegion: Record<string, string[]> = {
  서울특별시: ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
  경기도: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "군포시", "오산시", "이천시", "양주시", "안성시", "구리시", "포천시", "의왕시", "하남시", "여주시", "동두천시", "과천시"],
};

function getPolicyCategoryLabel(policy: MyPagePolicy): PolicyCategoryLabel {
  if (policy.categoryKr === "주거" || policy.categoryKr === "일자리" || policy.categoryKr === "복지") {
    return policy.categoryKr;
  }
  return "복지";
}

// 카테고리 색상은 constants/categories.ts에 정의된 토큰을 사용한다.
// 한글 라벨 기반 매핑이 필요할 때 보조용으로 categoryColor를 유지.
const categoryColor: Record<string, { bg: string; text: string; border: string }> = {
  주거: getCategoryStyle("주거"),
  일자리: getCategoryStyle("일자리"),
  복지: getCategoryStyle("복지"),
};

const compareFields: { key: keyof MyPagePolicy; label: string }[] = [
  { key: "org", label: "주관 기관" },
  { key: "support", label: "지원 규모" },
  { key: "desc", label: "지원 개요" },
];

function getStatusStyle(applyStatus: string) {
  switch (applyStatus) {
    case "지원 완료":
    case "applied":
      return { statusColor: "#3b6661", statusBg: "rgba(59,102,97,0.1)", progress: 70, journeyStep: 2 };
    case "결과 대기":
      return { statusColor: "#3b6661", statusBg: "rgba(59,102,97,0.1)", progress: 70, journeyStep: 2 };
    case "수혜 완료":
    case "benefited":
      return { statusColor: "#004d40", statusBg: "rgba(0,77,64,0.1)", progress: 100, journeyStep: 3 };
    default:
      return { statusColor: "#ba1a1a", statusBg: "rgba(186,26,26,0.1)", progress: 0, journeyStep: 0 };
  }
}

function normalizePolicyCardApplyStatus(applyStatus: string) {
  if (applyStatus === "benefited" || applyStatus === "수혜 완료" || applyStatus === "수혜완료") {
    return "benefited";
  }
  if (applyStatus === "applied" || applyStatus === "지원 완료" || applyStatus === "지원완료" || applyStatus === "결과 대기" || applyStatus === "결과대기") {
    return "applied";
  }
  return "apply_now";
}

function formatPolicyCardApplyStatus(applyStatus: string) {
  const normalizedStatus = normalizePolicyCardApplyStatus(applyStatus);

  if (normalizedStatus === "benefited") return "수혜완료";
  if (normalizedStatus === "applied") return "지원완료";
  return "지원 필요";
}

function getPolicyCardStatusStyle(applyStatus: string) {
  const normalizedStatus = normalizePolicyCardApplyStatus(applyStatus);

  if (normalizedStatus === "benefited") {
    return { statusColor: "#7c2d12", statusBg: "rgba(251,146,60,0.18)" };
  }
  if (normalizedStatus === "applied") {
    return { statusColor: "#0f766e", statusBg: "rgba(20,184,166,0.16)" };
  }
  return { statusColor: "#b42318", statusBg: "rgba(244,63,94,0.14)" };
}

function getApplyStatusForJourneyStep(step: number): CalendarApplyStatus {
  if (step === 3) return "benefited";
  if (step === 1 || step === 2) return "applied";
  return "apply_now";
}

function isDashboardCategoryMatch(category: string | undefined, filter: DashboardCategoryFilter) {
  if (filter === "전체") return true;
  return category === filter;
}

function toDashboardCategoryLabel(category: string | undefined): PolicyCategoryLabel | undefined {
  if (category === "주거" || category === "일자리" || category === "복지") {
    return category;
  }
  return undefined;
}

function getCalendarEventDate(event: CalendarEvent) {
  return new Date(event.eventEndAt || event.eventStartAt);
}

function isOngoingCalendarEvent(event: CalendarEvent, now = new Date()) {
  const eventDate = getCalendarEventDate(event);
  if (Number.isNaN(eventDate.getTime())) return false;
  return eventDate.getTime() >= now.getTime();
}

function isThisMonthCalendarEvent(event: CalendarEvent, now = new Date()) {
  const eventDate = getCalendarEventDate(event);
  if (Number.isNaN(eventDate.getTime())) return false;
  return eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth();
}

function clampFunnelCounts(counts: number[]) {
  return counts.reduce<number[]>((acc, count, index) => {
    if (index === 0) return [count];
    acc.push(Math.min(count, acc[index - 1]));
    return acc;
  }, []);
}

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

type CalendarDay = {
  day: number;
  events: { text: string; color: string; textColor: string }[];
  today: boolean;
};

function toCalendarColor(category: string) {
  if (category === "주거") {
    return { color: "#ffdad6", textColor: "#93000a" };
  }

  if (category === "일자리") {
    return { color: "rgba(79,209,197,0.2)", textColor: "#006a63" };
  }

  if (category === "복지") {
    return { color: "#e8def8", textColor: "#4a4458" };
  }

  return { color: "rgba(255,171,103,0.3)", textColor: "#8e4e11" };
}

function buildCalendarDays(
    events: CalendarEvent[],
    year: number,
    month: number,
): CalendarDay[] {
  const today = new Date();
  const lastDay = new Date(year, month, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const dayEvents = events
        .filter((event) => {
          const date = new Date(event.eventStartAt);
          return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
        })
        .map((event) => {
          const colors = { color: "rgba(79,209,197,0.2)", textColor: "#006a63" };

          return {
            text: event.title,
            color: colors.color,
            textColor: colors.textColor,
          };
        });

    return {
      day,
      events: dayEvents,
      today: today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day,
    };
  });
}

/* ─────────────────────────── Compare Modal ─────────────────────────── */

function CompareModal({
                        policies,
                        onClose,
                        onSchedule,
                      }: {
  policies: MyPagePolicy[];
  onClose: () => void;
  onSchedule: (id: string) => void;
}) {
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());
  const cols = policies.length;
  const firstCategoryLabel = getPolicyCategoryLabel(policies[0]);

  const detailResults = useQueries({
    queries: policies.map((p) => ({
      queryKey: queryKeys.policies.detail(p.id),
      queryFn: () => fetchPolicyDetail(p.id),
    })),
  });
  const details = detailResults.map((r) => r.data ?? null);

  const handleSchedule = (id: string) => {
    setScheduled((prev) => new Set([...prev, id]));
    onSchedule(id);
  };

  return (
      <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
            className="relative bg-white rounded-3xl overflow-hidden flex flex-col"
            style={{
              width: cols === 2 ? 760 : 1040,
              maxHeight: "90vh",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "#e9efed" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#006a63" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4H14M2 8H10M2 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <P style={{ fontSize: 18, fontWeight: 700, color: "#171d1c" }}>공고 비교</P>
              <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: categoryColor[firstCategoryLabel].bg, color: categoryColor[firstCategoryLabel].text, fontFamily: "Pretendard, sans-serif" }}
              >
              {firstCategoryLabel} · {cols}개 비교
            </span>
            </div>
            <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1">
            {/* Policy Title Row */}
            <div
                className="grid gap-px sticky top-0 z-10"
                style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)`, backgroundColor: "#e9efed" }}
            >
              <div className="bg-slate-50 px-5 py-4">
                <P style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>항목</P>
              </div>
              {policies.map((p) => {
                const categoryLabel = getPolicyCategoryLabel(p);

                return (
                    <div key={p.id} className="bg-white px-5 py-4">
                <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs mb-2"
                    style={{ backgroundColor: categoryColor[categoryLabel].bg, color: categoryColor[categoryLabel].text, fontFamily: "Pretendard, sans-serif", fontWeight: 600 }}
                >
                  {categoryLabel}
                </span>
                      <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c", lineHeight: 1.4 }}>{p.title}</P>
                      <P style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.org}</P>
                    </div>
                );
              })}
            </div>

            {/* Deadline Row */}
            <div
                className="grid gap-px"
                style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)`, backgroundColor: "#e9efed" }}
            >
              <div className="bg-slate-50 px-5 py-4 flex items-center">
                <P style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>마감일</P>
              </div>
              {policies.map((p) => (
                  <div key={p.id} className="bg-white px-5 py-4">
                    <P
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: p.deadline === "상시" ? "#006a63" : parseInt(p.deadline.replace("D-", "")) <= 7 ? "#ba1a1a" : "#f97316",
                        }}
                    >
                      {p.deadline}
                    </P>
                  </div>
              ))}
            </div>

            {/* Data Rows — Policy 자체 필드 (organization, supportScale, description) */}
            {compareFields.map((field, i) => (
                <div
                    key={field.key}
                    className="grid gap-px"
                    style={{
                      gridTemplateColumns: `160px repeat(${cols}, 1fr)`,
                      backgroundColor: "#e9efed",
                    }}
                >
                  <div className="px-5 py-4 flex items-start" style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : "#f1f5f9" }}>
                    <P style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{field.label}</P>
                  </div>
                  {policies.map((p) => {
                    const value = p[field.key as keyof MyPagePolicy] ?? "-";
                    return (
                        <div key={p.id} className="bg-white px-5 py-4">
                          {field.key === "support" ? (
                              <P style={{ fontSize: 14, fontWeight: 700, color: "#006a63" }}>{String(value)}</P>
                          ) : (
                              <P style={{ fontSize: 14, color: "#171d1c", lineHeight: 1.5 }}>{String(value)}</P>
                          )}
                        </div>
                    );
                  })}
                </div>
            ))}
          </div>

          {/* CTA Row */}
          <div
              className="grid gap-px border-t"
              style={{ gridTemplateColumns: `160px repeat(${cols}, 1fr)`, backgroundColor: "#e9efed", borderColor: "#e9efed" }}
          >
            <div className="bg-slate-50 px-5 py-5 flex items-center">
              <P style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>일정 추가</P>
            </div>
            {policies.map((p) => (
                <div key={p.id} className="bg-white px-5 py-5">
                  {scheduled.has(p.id) ? (
                      <div
                          className="h-11 rounded-xl flex items-center justify-center gap-2"
                          style={{ backgroundColor: "#f0fdf4", border: "1px solid #16a34a" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="#16a34a" />
                          <path d="M5 8L7 10.5L11 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <P style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>일정 등록 완료</P>
                      </div>
                  ) : (
                      <button
                          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90"
                          style={{ backgroundColor: "#006a63", border: "none", cursor: "pointer" }}
                          onClick={() => handleSchedule(p.id)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="2" width="14" height="13" rx="2" stroke="white" strokeWidth="1.3" />
                          <path d="M5 1V3.5M11 1V3.5M1 6H15" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                          <path d="M5 9.5H8M5 12H7" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        <P style={{ fontSize: 13, fontWeight: 700, color: "white" }}>지원 일정 관리하기</P>
                      </button>
                  )}
                </div>
            ))}
          </div>
        </div>
      </div>
  );
}

/* ─────────────────────────── MyPage ─────────────────────────── */

interface MyPageProps {
  onNavigate: (page: string, id?: string) => void;
}

export function MyPage({ onNavigate }: MyPageProps) {
  const { data: user } = useAuthUser();
  const { data: profile } = useProfile();
  const saveProfileMutation = useSaveProfile();
  const { data: benefitSummary, isLoading: isBenefitSummaryLoading } = useBenefitSummary(profile?.uid);
  const { data: recommendedPolicies = [] } = useRecommendedPolicies();
  const { data: bookmarkedPolicies = [] } = useBookmarkedPolicies();
  const toggleBookmarkMutation = useTogglePolicyBookmark();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const createCalendarEventMutation = useCreateCalendarEventFromPolicy();
  const updateCalendarEventStatusMutation = useUpdateCalendarEventStatus();
  const extractPolicyDocumentsMutation = useExtractPolicyDocuments();
  const [policyDocumentsById, setPolicyDocumentsById] = useState<Record<string, PolicyDocument[]>>({});
  const [documentErrorByPolicyId, setDocumentErrorByPolicyId] = useState<Record<string, string>>({});

  const managedPolicies = calendarEvents.map((event) => {
    const { progress, journeyStep } = getStatusStyle(event.applyStatus);
    const { statusColor, statusBg } = getPolicyCardStatusStyle(event.applyStatus);
    const deadline = event.eventEndAt ?? "상시";
    const dday = event.eventEndAt
        ? Math.max(0, Math.ceil((new Date(event.eventEndAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    return {
      cid: event.cid,
      id: event.policyId,
      title: event.title,
      org: event.org,
      status: formatPolicyCardApplyStatus(event.applyStatus),
      statusColor,
      statusBg,
      progress,
      deadline,
      dday,
      submittedDate: null,
      journeyStep,
      documents: policyDocumentsById[event.policyId] ?? [],
    };
  });

  // 비교 선택은 Zustand store에서 가져와 페이지 이동 후에도 유지된다
  const selected = useCompareStore((s) => s.selectedIds);
  const toggleCompareSelection = useCompareStore((s) => s.toggle);
  const clearCompareSelection = useCompareStore((s) => s.clear);

  const [mainTab, setMainTab] = useState<"scraps" | "management" | "profile">("scraps");
  const [subTab, setSubTab] = useState<"calendar" | "dashboard" | "policy">("dashboard");
  const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<DashboardCategoryFilter>("전체");
  const [showCompare, setShowCompare] = useState(false);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [detailPolicyId, setDetailPolicyId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [policyJourneySteps, setPolicyJourneySteps] = useState<Record<string, number>>({});
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);

  const baseCalendarDate = calendarEvents.length > 0
      ? new Date(calendarEvents[0].eventStartAt)
      : new Date();
  const visibleCalendarDate = new Date(
      baseCalendarDate.getFullYear(),
      baseCalendarDate.getMonth() + calendarMonthOffset,
      1,
  );
  const calendarYear = visibleCalendarDate.getFullYear();
  const calendarMonth = visibleCalendarDate.getMonth() + 1;
  const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const calendarDays = buildCalendarDays(calendarEvents, calendarYear, calendarMonth);
  const registeredPolicyIds = new Set(calendarEvents.map((event) => event.policyId));
  const selectedManagedPolicyId = selectedPolicyId || managedPolicies[0]?.id || "";
  const selectedManagedPolicyDetailQuery = usePolicyDetail(selectedManagedPolicyId);

  const dashboardPolicyCategoryById = new Map<string, PolicyCategoryLabel>();
  [...recommendedPolicies, ...bookmarkedPolicies].forEach((policy) => {
    dashboardPolicyCategoryById.set(policy.id, getPolicyCategoryLabel(policy));
  });

  const getDashboardCalendarEventCategory = (event: CalendarEvent) =>
      toDashboardCategoryLabel((event as CalendarEvent & { category?: string }).category) ??
      dashboardPolicyCategoryById.get(event.policyId);

  const filteredRecommendedPolicies = recommendedPolicies.filter((policy) =>
      isDashboardCategoryMatch(getPolicyCategoryLabel(policy), dashboardCategoryFilter),
  );
  const filteredBookmarkedPolicies = bookmarkedPolicies.filter((policy) =>
      isDashboardCategoryMatch(getPolicyCategoryLabel(policy), dashboardCategoryFilter),
  );
  const filteredCalendarEvents = calendarEvents.filter((event) =>
      isDashboardCategoryMatch(getDashboardCalendarEventCategory(event), dashboardCategoryFilter),
  );

  const appliedCalendarEvents = filteredCalendarEvents.filter((event) =>
      normalizePolicyCardApplyStatus(event.applyStatus) === "applied",
  );
  const benefitedCalendarEvents = filteredCalendarEvents.filter((event) =>
      normalizePolicyCardApplyStatus(event.applyStatus) === "benefited",
  );
  const funnelCounts = clampFunnelCounts([
    filteredRecommendedPolicies.length,
    filteredBookmarkedPolicies.length,
    filteredCalendarEvents.length,
    appliedCalendarEvents.length,
    benefitedCalendarEvents.length,
  ]);
  const dashboardFunnelData = [
    { label: "맞춤 추천", value: funnelCounts[0] ?? 0, color: "#80cbc4" },
    { label: "스크랩", value: funnelCounts[1] ?? 0, color: "#26a69a" },
    { label: "일정 등록", value: funnelCounts[2] ?? 0, color: "#00897b" },
    { label: "지원 완료", value: funnelCounts[3] ?? 0, color: "#00695c" },
    { label: "수혜 완료", value: funnelCounts[4] ?? 0, color: "#004d40" },
  ];
  const dashboardFunnelMax = Math.max(dashboardFunnelData[0]?.value ?? 0, 1);
  const requiredActionCount = filteredCalendarEvents.filter((event) =>
      isOngoingCalendarEvent(event) && normalizePolicyCardApplyStatus(event.applyStatus) === "apply_now",
  ).length;
  const monthlyAppliedCount = appliedCalendarEvents.filter((event) => isThisMonthCalendarEvent(event)).length;
  const benefitedCount = benefitedCalendarEvents.length;
  const appliedCount = calendarEvents.filter((event) =>
      normalizePolicyCardApplyStatus(event.applyStatus) === "applied",
  ).length;

  const totalBenefitAmount = benefitSummary?.totalBenefitAmount ?? 0;
  const totalBenefitManwon = Math.floor(totalBenefitAmount / 10000);
  const formattedTotalBenefitAmount = totalBenefitAmount.toLocaleString();
  const serviceBenefits = benefitSummary?.serviceBenefits ?? [];

  const handleSchedulePolicy = (id: string) => {
    createCalendarEventMutation.mutate(id, {
      onSuccess: () => {
        setScheduledIds((prev) => new Set([...prev, id]));
      },
    });
  };

  const handleExtractPolicyDocuments = (policyId: string) => {
    setDocumentErrorByPolicyId((prev) => {
      const next = { ...prev };
      delete next[policyId];
      return next;
    });

    extractPolicyDocumentsMutation.mutate(policyId, {
      onSuccess: (response) => {
        setPolicyDocumentsById((prev) => ({
          ...prev,
          [policyId]: response.documents ?? [],
        }));
      },
      onError: () => {
        setDocumentErrorByPolicyId((prev) => ({
          ...prev,
          [policyId]: "지원 서류 추출에 실패했습니다. 잠시 후 다시 시도해주세요.",
        }));
      },
    });
  };

  // Profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState<ProfileFormState>(emptyProfileData);

  useEffect(() => {
    if (!profile) {
      setProfileData((prev) => ({
        ...emptyProfileData,
        email: user?.email ?? prev.email,
      }));
      return;
    }

    setProfileData({
      email: user?.email ?? "",
      age: profile.age != null ? String(profile.age) : "",
      gender: profile.gender ?? "",
      region: profile.city ?? "",
      district: profile.scity ?? "",
      education: profile.education ?? "",
      employmentStatus: profile.employment ?? "",
      hasDisability: !!profile.disability,
      annualIncome: profile.incomeInteger != null ? String(profile.incomeInteger) : "",
      assets: profile.asset ?? "",
      createdAt: profile.createdAt ?? "",
      interests: (profile.preferredCategories ?? []).filter(
          (category): category is ProfileInterest =>
              category === "주거" || category === "일자리" || category === "복지",
      ),
    });
  }, [profile, user?.email]);

  const toggleInterest = (category: ProfileInterest) => {
    if (!isEditingProfile) return;
    setProfileData((prev) => ({
      ...prev,
      interests: prev.interests.includes(category)
          ? prev.interests.filter((i) => i !== category)
          : [...prev.interests, category],
    }));
  };

  const handleSaveProfile = () => {
    saveProfileMutation.mutate(
        {
          age: Number(profileData.age) || 0,
          gender: profileData.gender,
          city: profileData.region,
          scity: profileData.district,
          education: profileData.education,
          employment: profileData.employmentStatus,
          disability: profileData.hasDisability,
          incomeInteger: Number(profileData.annualIncome) || 0,
          asset: profileData.assets,
          preferredCategories: profileData.interests,
        },
        {
          onSuccess: () => setIsEditingProfile(false),
        },
    );
  };

  const profileName = user?.name ?? "청년";
  const profileSummary = [
    profile?.age ? `만 ${profile.age}세` : null,
    [profile?.city, profile?.scity].filter(Boolean).join(" ") || null,
    profile?.employment ?? null,
  ].filter(Boolean).join(" · ") || "프로필 정보를 불러오는 중입니다.";
  const districtOptions = districtsByRegion[profileData.region] ?? [];

  /* derive locked category from first selection */
  const lockedCategory = selected.length > 0
      ? bookmarkedPolicies.find((p) => p.id === selected[0])
          ? getPolicyCategoryLabel(bookmarkedPolicies.find((p) => p.id === selected[0])!)
          : null
      : null;

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const policy = bookmarkedPolicies.find((p) => p.id === id);
    if (!policy) return;

    const policyCategory = getPolicyCategoryLabel(policy);

    // 같은 카테고리만, 최대 3개까지 선택 가능 - 비즈니스 규칙을 가드로 표현
    toggleCompareSelection(id, (current) => {
      if (lockedCategory && policyCategory !== lockedCategory) return false;
      if (current.length >= 3) return false;
      return true;
    });
  };

  const confirmRemoveBookmark = (id: string) => {
    if (selected.includes(id)) {
      toggleCompareSelection(id);
    }

    toggleBookmarkMutation.mutate(
        { id, bookmarked: true },
        {
          onSettled: () => {
            setRemoveConfirmId(null);
            if (detailPolicyId === id) {
              setDetailPolicyId(null);
            }
          },
        },
    );
  };

  const requestRemoveBookmarkFromDetail = (id: string) => setRemoveConfirmId(id);

  const clearSelection = () => clearCompareSelection();

  const selectedPolicies = bookmarkedPolicies.filter((p) => selected.includes(p.id));
  const detailPolicy = detailPolicyId
      ? bookmarkedPolicies.find((policy) => policy.id === detailPolicyId)
      : null;

  const groupedByCategory = ["주거", "일자리", "복지"].map((cat) => ({
    category: cat as "주거" | "일자리" | "복지",
    policies: bookmarkedPolicies.filter((p) => getPolicyCategoryLabel(p) === cat),
  }));

  return (
      <div className="min-h-screen pt-16" style={{ backgroundColor: "#f8fafb" }}>
        <main className="max-w-[1280px] mx-auto px-6 py-10 pb-32">
          {/* Page Header */}
          <div className="flex flex-col gap-1 mb-6">
            <h1 style={{ fontFamily: "Pretendard, sans-serif", fontWeight: 700, fontSize: 32, color: "#171d1c", margin: 0 }}>마이페이지</h1>
            <P style={{ color: "#3c4947", fontSize: 16 }}>관심 있는 정책을 비교하고 지원 일정을 체계적으로 관리하세요.</P>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-4 mb-8 p-5 bg-white rounded-2xl border" style={{ borderColor: "rgba(226,232,240,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="w-14 h-14 rounded-full border-2 overflow-hidden flex-shrink-0" style={{ borderColor: "#4fd1c5" }}>
              <img src={imgUserAvatar} alt="User" className="w-full h-full object-cover" />
            </div>
            <div>
              <P style={{ fontSize: 18, fontWeight: 700, color: "#171d1c" }}>{profileName}</P>
              <P style={{ fontSize: 14, color: "#64748b" }}>{profileSummary}</P>
            </div>
            <div className="ml-auto flex gap-6">
              {[
                { label: "스크랩", value: bookmarkedPolicies.length.toLocaleString() },
                { label: "지원 완료", value: appliedCount.toString() },
                { label: "수혜 금액", value: isBenefitSummaryLoading ? "..." : `${totalBenefitManwon.toLocaleString()}만원` },
              ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <P style={{ fontSize: 18, fontWeight: 700, color: "#006a63" }}>{stat.value}</P>
                    <P style={{ fontSize: 12, color: "#64748b" }}>{stat.label}</P>
                  </div>
              ))}
            </div>
          </div>

          {/* Main Tabs */}
          <div className="sticky top-16 z-10 mb-6 border-b" style={{ backgroundColor: "rgba(248,250,251,0.95)", backdropFilter: "blur(2px)", borderColor: "#e3e9e7" }}>
            <div className="flex gap-6">
              {[
                { id: "scraps", label: "스크랩함" },
                { id: "management", label: "지원 관리" },
                { id: "profile", label: "개인 정보 수정" },
              ].map((tab) => (
                  <button
                      key={tab.id}
                      onClick={() => { setMainTab(tab.id as typeof mainTab); clearSelection(); }}
                      className="relative py-3 text-lg transition-colors"
                      style={{
                        fontFamily: "Pretendard, sans-serif",
                        fontWeight: mainTab === tab.id ? 700 : 400,
                        color: mainTab === tab.id ? "#006a63" : "#3c4947",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        borderBottom: mainTab === tab.id ? "2px solid #006a63" : "2px solid transparent",
                        marginBottom: -1,
                      }}
                  >
                    {tab.label}
                  </button>
              ))}
            </div>
          </div>

          {/* ── Scrap Tab ── */}
          {mainTab === "scraps" && (
              <div className="flex flex-col gap-10">
                {/* Guide hint */}
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(79,209,197,0.08)", border: "1px solid rgba(79,209,197,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#006a63" strokeWidth="1.3" />
                    <path d="M8 5V8.5M8 10.5V11" stroke="#006a63" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <P style={{ fontSize: 14, color: "#006a63" }}>
                    같은 카테고리의 공고를 <strong>최대 3개</strong>까지 선택해 비교할 수 있어요.
                  </P>
                </div>

                {groupedByCategory.map(({ category, policies }) => (
                    <div key={category}>
                      {/* Category Header */}
                      <div className="flex items-center gap-2 mb-4">
                  <span
                      className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{ backgroundColor: categoryColor[category].bg, color: categoryColor[category].text, fontFamily: "Pretendard, sans-serif" }}
                  >
                    {category}
                  </span>
                        <P style={{ fontSize: 14, color: "#94a3b8" }}>{policies.length}건 스크랩됨</P>
                        {lockedCategory && lockedCategory !== category && (
                            <P style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>— {lockedCategory} 카테고리 선택 중</P>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-5">
                        {policies.map((p) => {
                          const categoryLabel = getPolicyCategoryLabel(p);
                          const isSelected = selected.includes(p.id);
                          const isDisabled = !!(lockedCategory && categoryLabel !== lockedCategory);
                          const isFull = selected.length >= 3 && !isSelected;
                          const isScheduled = scheduledIds.has(p.id) || registeredPolicyIds.has(p.id);

                          return (
                              <div
                                  key={p.id}
                                  className="bg-white rounded-2xl border flex flex-col transition-all"
                                  style={{
                                    borderColor: isSelected
                                        ? categoryColor[category].border
                                        : "rgba(187,201,199,0.4)",
                                    boxShadow: isSelected ? `0 0 0 2px ${categoryColor[category].border}` : "none",
                                    opacity: isDisabled ? 0.4 : 1,
                                    cursor: isDisabled ? "not-allowed" : "default",
                                  }}
                              >
                                {/* Select Button Row */}
                                <div
                                    className="flex items-center justify-between px-5 pt-4 pb-3 border-b"
                                    style={{ borderColor: "#f1f5f9" }}
                                >
                                  <button
                                      className="flex items-center gap-2 transition-all"
                                      disabled={isDisabled || (isFull && !isSelected)}
                                      onClick={(e) => toggleSelect(p.id, e)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: isDisabled || (isFull && !isSelected) ? "not-allowed" : "pointer",
                                        padding: 0,
                                      }}
                                  >
                                    <div
                                        className="w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0"
                                        style={{
                                          backgroundColor: isSelected ? categoryColor[category].text : "white",
                                          border: `2px solid ${isSelected ? categoryColor[category].text : "#cbd5e1"}`,
                                        }}
                                    >
                                      {isSelected && (
                                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                      )}
                                    </div>
                                    <P style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? categoryColor[category].text : "#64748b" }}>
                                      {isSelected ? "선택됨" : "선택"}
                                    </P>
                                  </button>

                                  <div className="flex items-center gap-2">
                                    <P style={{ fontSize: 13, fontWeight: 700, color: p.deadline === "상시" ? "#006a63" : "#ba1a1a" }}>
                                      {p.deadline}
                                    </P>

                                    <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRemoveConfirmId(p.id);
                                        }}
                                        title="북마크 취소"
                                        style={{
                                          background: "none",
                                          border: "none",
                                          cursor: "pointer",
                                          padding: 4,
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                    >
                                      <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                                        <path
                                            d="M1 2C1 1.44772 1.44772 1 2 1H16C16.5523 1 17 1.44772 17 2V18.382C17 18.7607 16.5724 18.9899 16.2764 18.7764L9 13.618L1.7236 18.7764C1.4276 18.9899 1 18.7607 1 18.382V2Z"
                                            fill="#006a63"
                                            stroke="#006a63"
                                            strokeWidth="1.5"
                                            strokeLinejoin="round"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Card Body */}
                                <div
                                    className="p-5 flex flex-col flex-1 cursor-pointer hover:bg-slate-50 transition-colors rounded-b-2xl"
                                    onClick={() => setDetailPolicyId(p.id)}
                                >
                                  <P style={{ fontSize: 17, fontWeight: 600, color: "#171d1c", lineHeight: 1.4, marginBottom: 6 }}>{p.title}</P>
                                  <P style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{p.org}</P>
                                  <P style={{ fontSize: 14, fontWeight: 700, color: "#006a63", marginBottom: 12 }}>{p.support}</P>
                                  <P style={{ fontSize: 13, color: "#3c4947" }}>지원규모: {p.support}</P>

                                  <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: "#e9efed" }}>
                                    <P style={{ fontSize: 13, color: "#006a63", fontWeight: 500 }}>상세보기 →</P>
                                    {isScheduled && (
                                        <span className="flex items-center gap-1 text-xs" style={{ color: "#16a34a", fontFamily: "Pretendard, sans-serif" }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <circle cx="6" cy="6" r="5" fill="#16a34a" />
                                  <path d="M3.5 6L5 7.5L8.5 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                                </svg>
                                일정 등록됨
                              </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                    </div>
                ))}
              </div>
          )}

          {/* ── Management Tab ── */}
          {mainTab === "management" && (
              <div className="flex flex-col gap-6">
                <div className="flex gap-2 p-1 rounded-xl self-start" style={{ backgroundColor: "#eff5f3" }}>
                  {[
                    { id: "calendar", label: "캘린더 뷰" },
                    { id: "dashboard", label: "대시보드 뷰" },
                    { id: "policy", label: "정책별 관리" },
                  ].map((t) => (
                      <button
                          key={t.id}
                          onClick={() => setSubTab(t.id as typeof subTab)}
                          className="px-6 py-2 rounded-lg text-base transition-all"
                          style={{
                            fontFamily: "Pretendard, sans-serif",
                            fontWeight: 400,
                            backgroundColor: subTab === t.id ? "white" : "transparent",
                            color: subTab === t.id ? "#006a63" : "#3c4947",
                            border: "none",
                            cursor: "pointer",
                            boxShadow: subTab === t.id ? "0 1px 1px rgba(0,0,0,0.05)" : "none",
                          }}
                      >
                        {t.label}
                      </button>
                  ))}
                </div>

                {subTab === "dashboard" && (
                    <div className="flex flex-col gap-8">
                      <div className="rounded-2xl p-8" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <P style={{ fontSize: 24, fontWeight: 700, color: "#171d1c" }}>지원 현황 요약</P>
                            <P style={{ fontSize: 14, color: "#3c4947", marginTop: 2 }}>추천부터 수혜까지의 단계를 한눈에 확인하세요.</P>
                          </div>
                          <div className="flex gap-2">
                            {(["전체", "주거", "일자리", "복지"] as DashboardCategoryFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setDashboardCategoryFilter(filter)}
                                    className="px-4 py-2 rounded-full text-sm"
                                    style={{
                                      fontFamily: "Pretendard, sans-serif",
                                      backgroundColor: dashboardCategoryFilter === filter ? "#006a63" : "#eff5f3",
                                      color: dashboardCategoryFilter === filter ? "white" : "#3c4947",
                                      border: "none",
                                      cursor: "pointer",
                                      fontWeight: 500,
                                    }}
                                >
                                  {filter}
                                </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-8">
                          {/* Left: Funnel Chart - 60% */}
                          <div className="flex flex-col gap-3" style={{ width: "60%" }}>
                            {dashboardFunnelData.map((item) => (
                                <div key={item.label} className="flex items-center gap-6">
                                  <div className="flex-1 flex justify-end">
                                    <div className="h-10 rounded-lg" style={{ width: `${(item.value / dashboardFunnelMax) * 100}%`, backgroundColor: item.color, minWidth: item.value > 0 ? 40 : 0 }} />
                                  </div>
                                  <div className="flex items-center gap-3" style={{ minWidth: 180 }}>
                                    <div className="h-px w-8" style={{ backgroundColor: "#bbc9c7" }} />
                                    <P style={{ fontSize: 14, fontWeight: 700, color: "#171d1c", whiteSpace: "nowrap" }}>{item.label}</P>
                                    <P style={{ fontSize: 16, color: "#006a63", marginLeft: "auto" }}>{item.value}</P>
                                  </div>
                                </div>
                            ))}
                          </div>

                          {/* Right: Status Cards Container - 40% */}
                          <div style={{ width: "40%" }}>
                            <div className="rounded-2xl p-5" style={{ backgroundColor: "rgba(0,106,99,0.04)", border: "1.5px solid rgba(0,106,99,0.15)" }}>
                              <div className="flex items-center gap-2 mb-4">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                  <circle cx="9" cy="9" r="8" stroke="#006a63" strokeWidth="1.5" />
                                  <path d="M9 5V9.5L12 11.5" stroke="#006a63" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <P style={{ fontSize: 13, fontWeight: 700, color: "#006a63", letterSpacing: "0.3px" }}>현재 진행 중인 내용</P>
                              </div>
                              <div className="flex flex-col gap-3">
                                {[
                                  { label: "지원 필요", sub: "진행 중인 지원 관리 정책", value: `${requiredActionCount}건`, color: "#ba1a1a", bg: "rgba(186,26,26,0.1)" },
                                  { label: "지원 완료", sub: "이번 달 누적", value: `${monthlyAppliedCount}건`, color: "#006a63", bg: "rgba(0,106,99,0.1)" },
                                  { label: "수혜 받은 건", sub: "수혜 완료", value: `${benefitedCount}건`, color: "#7c2d12", bg: "rgba(251,146,60,0.18)" },
                                ].map((card) => (
                                    <div key={card.label} className="flex items-center justify-between p-4 rounded-xl bg-white" style={{ border: "1px solid #e9efed" }}>
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <circle cx="8" cy="8" r="7" stroke={card.color} strokeWidth="1.3" />
                                            <path d="M8 5V8.5L10.5 10" stroke={card.color} strokeWidth="1.3" strokeLinecap="round" />
                                          </svg>
                                        </div>
                                        <div>
                                          <P style={{ fontSize: 14, fontWeight: 700, color: "#171d1c", whiteSpace: "nowrap" }}>{card.label}</P>
                                          <P style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{card.sub}</P>
                                        </div>
                                      </div>
                                      <P style={{ fontSize: 20, fontWeight: 800, color: card.color, flexShrink: 0 }}>{card.value}</P>
                                    </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                        <div className="px-8 py-6 border-b" style={{ borderColor: "#e9efed" }}>
                          <P style={{ fontSize: 24, fontWeight: 700, color: "#171d1c" }}>혜택 리포트</P>
                          <P style={{ fontSize: 14, color: "#3c4947", marginTop: 2 }}>현재까지 받으신 경제적·물질적 혜택 총계입니다.</P>
                        </div>
                        <div className="grid grid-cols-2">
                          <div className="p-8 border-r flex flex-col justify-center items-center" style={{ borderColor: "#e9efed" }}>
                            <P style={{ fontSize: 14, fontWeight: 700, color: "#3c4947", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 16 }}>현금성 혜택 현황</P>
                            <div className="flex flex-col items-center gap-3">
                              <div className="flex items-baseline gap-2">
                                <P style={{ fontSize: 56, fontWeight: 800, color: "#006a63", lineHeight: 1 }}>
                                  {isBenefitSummaryLoading ? "..." : formattedTotalBenefitAmount}
                                </P>
                                <P style={{ fontSize: 24, fontWeight: 700, color: "#3c4947" }}>원</P>
                              </div>
                              <P style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
                                현재까지 받으신 현금성 혜택 총액
                              </P>
                            </div>
                          </div>
                          <div className="p-8 flex flex-col">
                            <P style={{ fontSize: 14, fontWeight: 700, color: "#3c4947", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 16 }}>물품 및 서비스 혜택</P>
                            <div className="flex-1 flex items-center">
                              <div
                                  className="w-full p-6 rounded-xl"
                                  style={{
                                    backgroundColor: "rgba(0,106,99,0.05)",
                                    border: "1px solid rgba(0,106,99,0.15)"
                                  }}
                              >
                                {serviceBenefits.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                      {serviceBenefits.map((benefit, index) => (
                                          <div key={`${benefit.benefitItem ?? "benefit"}-${index}`} className="flex flex-col gap-1">
                                            <P style={{ fontSize: 15, color: "#171d1c", lineHeight: 1.6, fontWeight: 700 }}>
                                              {benefit.benefitItem ?? benefit.benefitType ?? "서비스 혜택"}
                                            </P>
                                            <P style={{ fontSize: 14, color: "#3c4947", lineHeight: 1.6, fontWeight: 400 }}>
                                              {benefit.effectSummary ?? "상세 혜택 정보가 집계되었습니다."}
                                            </P>
                                          </div>
                                      ))}
                                    </div>
                                ) : (
                                    <P style={{ fontSize: 15, color: "#64748b", lineHeight: 1.8, fontWeight: 400 }}>
                                      아직 집계된 물품 및 서비스 혜택이 없습니다.
                                    </P>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                )}

                {subTab === "calendar" && (
                    <div className="rounded-2xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                      <div className="flex items-center justify-between mb-6">
                        <P style={{ fontSize: 20, fontWeight: 700, color: "#171d1c" }}>{calendarYear}년 {calendarMonth}월</P>
                        <div className="flex gap-2">
                          <button
                              type="button"
                              aria-label="이전 달"
                              onClick={() => setCalendarMonthOffset((month) => month - 1)}
                              style={{ background: "none", border: "1px solid #e3e9e7", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#3c4947", fontFamily: "Pretendard, sans-serif" }}
                          >
                            ‹
                          </button>
                          <button
                              type="button"
                              aria-label="다음 달"
                              onClick={() => setCalendarMonthOffset((month) => month + 1)}
                              style={{ background: "none", border: "1px solid #e3e9e7", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#3c4947", fontFamily: "Pretendard, sans-serif" }}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 mb-2">
                        {weekDays.map((d) => (
                            <div key={d} className="text-center py-2">
                              <P style={{ fontSize: 12, fontWeight: 500, color: "#3c4947" }}>{d}</P>
                            </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDayOfMonth }, (_, i) => (
                            <div key={`e-${i}`} className="h-24 rounded" style={{ border: "1px solid #e3e9e7" }} />
                        ))}
                        {calendarDays.map((d) => (
                            <div key={d.day} className="h-24 rounded-md p-1.5 flex flex-col gap-1" style={{ border: d.today ? "2px solid #006a63" : "1px solid #e3e9e7", backgroundColor: d.today ? "rgba(0,106,99,0.05)" : "transparent" }}>
                              <div className="flex items-center">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: d.today ? "#006a63" : "transparent" }}>
                                  <P style={{ fontSize: 12, fontWeight: d.today ? 700 : 500, color: d.today ? "white" : "#171d1c" }}>{d.day}</P>
                                </div>
                              </div>
                              {d.events.map((ev, i) => (
                                  <div key={i} className="rounded px-1 py-0.5" style={{ backgroundColor: ev.color }}>
                                    <P style={{ fontSize: 9, color: ev.textColor, lineHeight: 1.3 }}>{ev.text}</P>
                                  </div>
                              ))}
                            </div>
                        ))}
                      </div>
                    </div>
                )}

                {subTab === "policy" && (
                    <div className="flex gap-6">
                      {/* Left: Policy List - 30% */}
                      <div style={{ width: "30%" }} className="flex flex-col gap-3">
                        {managedPolicies.length === 0 && (
                            <div
                                className="bg-white rounded-2xl p-5 border"
                                style={{
                                  borderColor: "rgba(226,232,240,0.8)",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                }}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <span
                                    className="px-2.5 py-1 rounded-full text-xs"
                                    style={{ backgroundColor: "rgba(0,106,99,0.1)", color: "#006a63", fontFamily: "Pretendard, sans-serif", fontWeight: 700 }}
                                >
                                  관리할 정책 없음
                                </span>
                              </div>

                              <P style={{ fontSize: 16, fontWeight: 600, color: "#171d1c", marginBottom: 6, lineHeight: 1.4 }}>
                                아직 지원 관리 중인 정책이 없어요
                              </P>
                              <P style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                                관심 정책에서 지원 일정을 등록하면 여기에 표시됩니다.
                              </P>

                              <div className="flex items-center justify-between mb-3">
                                <div
                                    className="px-3 py-1.5 rounded-lg flex items-center gap-2"
                                    style={{ backgroundColor: "rgba(0,106,99,0.1)" }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <circle cx="7" cy="7" r="6" stroke="#006a63" strokeWidth="1.2" />
                                    <path d="M7 3.5V7L9 9" stroke="#006a63" strokeWidth="1.2" strokeLinecap="round" />
                                  </svg>
                                  <P style={{ fontSize: 13, fontWeight: 700, color: "#006a63" }}>일정 미등록</P>
                                </div>
                              </div>

                            </div>
                        )}

                        {managedPolicies.map((p) => {
                          const ddayColor = p.dday <= 7 ? "#ba1a1a" : p.dday <= 14 ? "#f97316" : "#006a63";
                          const ddayBg = p.dday <= 7 ? "rgba(186,26,26,0.1)" : p.dday <= 14 ? "rgba(249,115,22,0.1)" : "rgba(0,106,99,0.1)";

                          return (
                              <div
                                  key={p.id}
                                  className="bg-white rounded-2xl p-5 cursor-pointer transition-all border"
                                  style={{
                                    borderColor: selectedManagedPolicyId === p.id ? "#006a63" : "rgba(226,232,240,0.8)",
                                    boxShadow: selectedManagedPolicyId === p.id ? "0 0 0 2px rgba(0,106,99,0.2)" : "0 2px 8px rgba(0,0,0,0.05)",
                                    backgroundColor: selectedManagedPolicyId === p.id ? "rgba(0,106,99,0.02)" : "white",
                                  }}
                                  onClick={() => setSelectedPolicyId(p.id)}   // managedPolicy.id는 calendarEvent.policyId로 별도 관리됨
                              >
                                <div className="flex items-start justify-between mb-3">
                          <span
                              className="px-2.5 py-1 rounded-full text-xs"
                              style={{ backgroundColor: p.statusBg, color: p.statusColor, fontFamily: "Pretendard, sans-serif", fontWeight: 700 }}
                          >
                            {p.status}
                          </span>
                                  {selectedManagedPolicyId === p.id && (
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#006a63" }}>
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </div>
                                  )}
                                </div>

                                <P style={{ fontSize: 16, fontWeight: 600, color: "#171d1c", marginBottom: 6, lineHeight: 1.4 }}>{p.title}</P>
                                <P style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{p.org}</P>

                                {/* D-day Badge */}
                                <div className="flex items-center justify-between mb-3">
                                  <div
                                      className="px-3 py-1.5 rounded-lg flex items-center gap-2"
                                      style={{ backgroundColor: ddayBg }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                      <circle cx="7" cy="7" r="6" stroke={ddayColor} strokeWidth="1.2" />
                                      <path d="M7 3.5V7L9 9" stroke={ddayColor} strokeWidth="1.2" strokeLinecap="round" />
                                    </svg>
                                    <P style={{ fontSize: 13, fontWeight: 700, color: ddayColor }}>D-{p.dday}</P>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#eff5f3" }}>
                                      <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, backgroundColor: p.statusColor }} />
                                    </div>
                                  </div>
                                  <P style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{p.progress}%</P>
                                </div>
                              </div>
                          );
                        })}
                      </div>

                      {/* Right: Policy Detail - 70% */}
                      <div style={{ width: "70%" }}>
                        {(() => {
                          const selectedPolicy = managedPolicies.find((p) => p.id === selectedManagedPolicyId);

                          if (!selectedPolicy) {
                            const journeySteps = [
                              { label: "지원 필요", icon: "📝" },
                              { label: "지원 완료", icon: "✅" },
                              { label: "결과 대기", icon: "⏳" },
                              { label: "수혜 완료", icon: "🎉" },
                            ];

                            return (
                                <div className="bg-white rounded-2xl p-6 sticky top-24" style={{ border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                                  {/* Header */}
                                  <div className="pb-4 mb-5 border-b" style={{ borderColor: "#e9efed" }}>
                                    <P style={{ fontSize: 20, fontWeight: 700, color: "#171d1c", marginBottom: 4 }}>관리할 정책을 기다리고 있어요</P>
                                    <P style={{ fontSize: 13, color: "#64748b" }}>지원 일정을 등록하면 정책별 관리 내용이 채워집니다.</P>
                                  </div>

                                  {/* Journey Steps */}
                                  <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                        <path d="M2 9H16M16 9L12 5M16 9L12 13" stroke="#006a63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <P style={{ fontSize: 16, fontWeight: 700, color: "#171d1c" }}>지원 여정</P>
                                    </div>

                                    <div className="flex items-center justify-between relative">
                                      <div
                                          className="absolute top-6 left-0 right-0 h-1 rounded-full"
                                          style={{ backgroundColor: "#e9efed", zIndex: 0, marginLeft: "12px", marginRight: "12px" }}
                                      />

                                      {journeySteps.map((step, idx) => (
                                          <div
                                              key={idx}
                                              className="flex flex-col items-center gap-2 relative"
                                              style={{ flex: 1, zIndex: 1 }}
                                          >
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center"
                                                style={{
                                                  backgroundColor: "white",
                                                  border: "3px solid #e9efed",
                                                }}
                                            >
                                              <P style={{ fontSize: 18 }}>{step.icon}</P>
                                            </div>
                                            <P
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: 500,
                                                  color: "#94a3b8",
                                                  textAlign: "center",
                                                  whiteSpace: "nowrap",
                                                }}
                                            >
                                              {step.label}
                                            </P>
                                          </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Schedule Section */}
                                  <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                        <rect x="2" y="3" width="14" height="13" rx="2" stroke="#006a63" strokeWidth="1.3" />
                                        <path d="M6 1V5M12 1V5M2 7H16" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" />
                                      </svg>
                                      <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>일정 관리</P>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                      <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(245,251,248,0.8)", border: "1px solid rgba(187,201,199,0.3)" }}>
                                        <P style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>마감일</P>
                                        <P style={{ fontSize: 15, fontWeight: 700, color: "#64748b" }}>등록된 일정이 없습니다.</P>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Documents Checklist */}
                                  <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                          <path d="M11 2H4C3.44772 2 3 2.44772 3 3V15C3 15.5523 3.44772 16 4 16H14C14.5523 16 15 15.5523 15 15V6L11 2Z" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                          <path d="M11 2V6H15" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>지원 서류</P>
                                      </div>
                                      <span
                                          className="px-2 py-1 rounded-full text-xs"
                                          style={{ backgroundColor: "rgba(0,106,99,0.1)", color: "#006a63", fontFamily: "Pretendard, sans-serif", fontWeight: 700 }}
                                      >
                                        0/0
                                      </span>
                                    </div>
                                    <div className="p-3 rounded-lg" style={{ border: "1px solid rgba(226,232,240,0.8)" }}>
                                      <P style={{ fontSize: 14, color: "#64748b" }}>아직 확인할 지원 서류가 없습니다.</P>
                                    </div>
                                  </div>

                                  {/* Action Button */}
                                  <button
                                      disabled
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl"
                                      style={{ backgroundColor: "white", border: "1.5px solid #bbc9c7", color: "#94a3b8", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700, cursor: "not-allowed" }}
                                  >
                                    원본 공고가 아직 없습니다
                                  </button>
                                </div>
                            );
                          }

                          const totalDocs = selectedPolicy.documents.length;
                          const requiredDocs = selectedPolicy.documents.filter((doc) => doc.required).length;
                          const isExtractingDocuments =
                              extractPolicyDocumentsMutation.isPending &&
                              extractPolicyDocumentsMutation.variables === selectedPolicy.id;
                          const documentError = documentErrorByPolicyId[selectedPolicy.id];
                          const currentStep = policyJourneySteps[selectedPolicy.id] ?? selectedPolicy.journeyStep;
                          const selectedPolicyDetail = selectedManagedPolicyDetailQuery.data;
                          const originalPolicyUrl = selectedPolicyDetail?.detailUrl ?? null;

                          const journeySteps = [
                            { label: "지원 필요", icon: "📝" },
                            { label: "지원 완료", icon: "✅" },
                            { label: "결과 대기", icon: "⏳" },
                            { label: "수혜 완료", icon: "🎉" },
                          ];

                          const updateJourneyStep = (step: number) => {
                            const nextStep = step === 1 ? 2 : step;
                            const applyStatus = getApplyStatusForJourneyStep(nextStep);

                            updateCalendarEventStatusMutation.mutate(
                                { cid: selectedPolicy.cid, applyStatus },
                                {
                                  onSuccess: () => {
                                    setPolicyJourneySteps((prev) => ({
                                      ...prev,
                                      [selectedPolicy.id]: nextStep,
                                    }));
                                  },
                                },
                            );
                          };

                          return (
                              <div className="bg-white rounded-2xl p-6 sticky top-24" style={{ border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                                {/* Header */}
                                <div className="pb-4 mb-5 border-b" style={{ borderColor: "#e9efed" }}>
                                  <P style={{ fontSize: 20, fontWeight: 700, color: "#171d1c", marginBottom: 4 }}>{selectedPolicy.title}</P>
                                  <P style={{ fontSize: 13, color: "#64748b" }}>{selectedPolicy.org}</P>
                                </div>

                                {/* Journey Steps */}
                                <div className="mb-6">
                                  <div className="flex items-center gap-2 mb-4">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                      <path d="M2 9H16M16 9L12 5M16 9L12 13" stroke="#006a63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <P style={{ fontSize: 16, fontWeight: 700, color: "#171d1c" }}>지원 여정</P>
                                  </div>

                                  <div className="flex items-center justify-between relative">
                                    {/* Progress Line */}
                                    <div
                                        className="absolute top-6 left-0 right-0 h-1 rounded-full"
                                        style={{ backgroundColor: "#e9efed", zIndex: 0, marginLeft: "12px", marginRight: "12px" }}
                                    >
                                      <div
                                          className="h-full rounded-full transition-all duration-500"
                                          style={{
                                            backgroundColor: "#006a63",
                                            width: `${(currentStep / (journeySteps.length - 1)) * 100}%`,
                                          }}
                                      />
                                    </div>

                                    {/* Journey Steps */}
                                    {journeySteps.map((step, idx) => {
                                      const isCompleted = idx <= currentStep;
                                      const isActive = idx === currentStep;

                                      return (
                                          <div
                                              key={idx}
                                              className="flex flex-col items-center gap-2 cursor-pointer transition-all relative"
                                              style={{ flex: 1, zIndex: 1 }}
                                              onClick={() => updateJourneyStep(idx)}
                                          >
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                                                style={{
                                                  backgroundColor: isCompleted ? "#006a63" : "white",
                                                  border: `3px solid ${isCompleted ? "#006a63" : "#e9efed"}`,
                                                  boxShadow: isActive ? "0 0 0 4px rgba(0,106,99,0.1)" : "none",
                                                  transform: isActive ? "scale(1.1)" : "scale(1)",
                                                }}
                                            >
                                              {isCompleted ? (
                                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                    <path d="M4 10L8 14L16 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                  </svg>
                                              ) : (
                                                  <P style={{ fontSize: 18 }}>{step.icon}</P>
                                              )}
                                            </div>
                                            <P
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: isCompleted ? 700 : 500,
                                                  color: isCompleted ? "#006a63" : "#94a3b8",
                                                  textAlign: "center",
                                                  whiteSpace: "nowrap",
                                                }}
                                            >
                                              {step.label}
                                            </P>
                                          </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Schedule Section */}
                                <div className="mb-6">
                                  <div className="flex items-center gap-2 mb-3">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                      <rect x="2" y="3" width="14" height="13" rx="2" stroke="#006a63" strokeWidth="1.3" />
                                      <path d="M6 1V5M12 1V5M2 7H16" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" />
                                    </svg>
                                    <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>일정 관리</P>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(245,251,248,0.8)", border: "1px solid rgba(187,201,199,0.3)" }}>
                                      <P style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>마감일</P>
                                      <P style={{ fontSize: 15, fontWeight: 700, color: selectedPolicy.progress === 0 ? "#ba1a1a" : "#006a63" }}>{selectedPolicy.deadline}</P>
                                    </div>
                                    {selectedPolicy.submittedDate && (
                                        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(245,251,248,0.8)", border: "1px solid rgba(187,201,199,0.3)" }}>
                                          <P style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>지원 완료일</P>
                                          <P style={{ fontSize: 15, fontWeight: 700, color: "#006a63" }}>{selectedPolicy.submittedDate}</P>
                                        </div>
                                    )}
                                  </div>
                                </div>

                                {/* Documents Checklist */}
                                <div className="mb-6">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                        <path d="M11 2H4C3.44772 2 3 2.44772 3 3V15C3 15.5523 3.44772 16 4 16H14C14.5523 16 15 15.5523 15 15V6L11 2Z" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M11 2V6H15" stroke="#006a63" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>지원 서류</P>
                                    </div>
                                    <span
                                        className="px-2 py-1 rounded-full text-xs"
                                        style={{ backgroundColor: totalDocs > 0 ? "rgba(0,106,99,0.1)" : "rgba(186,26,26,0.1)", color: totalDocs > 0 ? "#006a63" : "#ba1a1a", fontFamily: "Pretendard, sans-serif", fontWeight: 700 }}
                                    >
                              필수 {requiredDocs} · 전체 {totalDocs}
                            </span>
                                  </div>
                                  {selectedPolicy.documents.length === 0 ? (
                                      <div className="flex flex-col gap-3">
                                        <div className="p-3 rounded-lg" style={{ border: "1px solid rgba(226,232,240,0.8)" }}>
                                          <P style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                                            아직 추출된 지원 서류가 없습니다.
                                          </P>
                                        </div>
                                        {documentError && (
                                            <P style={{ fontSize: 13, color: "#ba1a1a", lineHeight: 1.5 }}>{documentError}</P>
                                        )}
                                        <button
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: "#006a63", border: "none", color: "white", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700, cursor: isExtractingDocuments ? "not-allowed" : "pointer" }}
                                            onClick={() => handleExtractPolicyDocuments(selectedPolicy.id)}
                                            disabled={isExtractingDocuments}
                                        >
                                          {isExtractingDocuments && (
                                              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                                                <path d="M14 8C14 4.686 11.314 2 8 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                              </svg>
                                          )}
                                          {isExtractingDocuments ? "지원 서류 추출 중..." : "AI로 지원 서류 추출하기"}
                                        </button>
                                      </div>
                                  ) : (
                                      <div className="flex flex-col gap-2">
                                        {selectedPolicy.documents.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-slate-50"
                                                style={{ border: "1px solid rgba(226,232,240,0.8)" }}
                                            >
                                              <span
                                                  className="px-2 py-1 rounded-full text-xs flex-shrink-0"
                                                  style={{
                                                    backgroundColor: doc.required ? "rgba(186,26,26,0.1)" : "rgba(0,106,99,0.1)",
                                                    color: doc.required ? "#ba1a1a" : "#006a63",
                                                    fontFamily: "Pretendard, sans-serif",
                                                    fontWeight: 700,
                                                  }}
                                              >
                                                {doc.required ? "필수" : "선택"}
                                              </span>
                                              <div className="flex-1">
                                                <P style={{ fontSize: 14, color: "#171d1c", fontWeight: 700, lineHeight: 1.5 }}>{doc.name}</P>
                                                {doc.description && (
                                                    <P style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{doc.description}</P>
                                                )}
                                                {doc.url && (
                                                    <button
                                                        className="mt-2"
                                                        style={{ background: "none", border: "none", padding: 0, color: "#006a63", cursor: "pointer", fontFamily: "Pretendard, sans-serif", fontSize: 13, fontWeight: 700 }}
                                                        onClick={() => window.open(doc.url!, "_blank")}
                                                    >
                                                      서류 링크 열기
                                                    </button>
                                                )}
                                              </div>
                                            </div>
                                        ))}
                                        <button
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: "white", border: "1.5px solid #006a63", color: "#006a63", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700, cursor: isExtractingDocuments ? "not-allowed" : "pointer" }}
                                            onClick={() => handleExtractPolicyDocuments(selectedPolicy.id)}
                                            disabled={isExtractingDocuments}
                                        >
                                          {isExtractingDocuments && (
                                              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <circle cx="8" cy="8" r="6" stroke="rgba(0,106,99,0.25)" strokeWidth="2" />
                                                <path d="M14 8C14 4.686 11.314 2 8 2" stroke="#006a63" strokeWidth="2" strokeLinecap="round" />
                                              </svg>
                                          )}
                                          {isExtractingDocuments ? "지원 서류 갱신 중..." : "지원 서류 다시 추출하기"}
                                        </button>
                                        {documentError && (
                                            <P style={{ fontSize: 13, color: "#ba1a1a", lineHeight: 1.5 }}>{documentError}</P>
                                        )}
                                      </div>
                                  )}
                                </div>

                                {/* Action Button */}
                                <button
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all hover:opacity-90"
                                    style={{ backgroundColor: "white", border: `1.5px solid ${originalPolicyUrl ? "#006a63" : "#bbc9c7"}`, color: originalPolicyUrl ? "#006a63" : "#94a3b8", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700, cursor: originalPolicyUrl ? "pointer" : "not-allowed" }}
                                    onClick={() => {
                                      if (!originalPolicyUrl) return;
                                      window.open(originalPolicyUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    disabled={!originalPolicyUrl}
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M14 9V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H7" stroke={originalPolicyUrl ? "#006a63" : "#94a3b8"} strokeWidth="1.3" strokeLinecap="round"/>
                                    <path d="M10 2H14V6M14 2L7 9" stroke={originalPolicyUrl ? "#006a63" : "#94a3b8"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  {selectedManagedPolicyDetailQuery.isLoading ? "원본 공고 확인 중..." : originalPolicyUrl ? "원본 공고 보러가기" : "원본 공고 없음"}
                                </button>
                              </div>
                          );
                        })()}
                      </div>
                    </div>
                )}
              </div>
          )}

          {/* ── Profile Tab ── */}
          {mainTab === "profile" && (
              <div className="max-w-4xl mx-auto">
                <div className="rounded-2xl p-8 flex flex-col gap-8" style={{ backgroundColor: "white", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <P style={{ fontSize: 20, fontWeight: 700, color: "#171d1c" }}>개인 정보 수정</P>
                      <P style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>내 조건에 맞는 정책 추천에 사용되는 정보입니다.</P>
                    </div>
                    {isEditingProfile ? (
                        <div className="flex gap-3">
                          <button
                              onClick={() => setIsEditingProfile(false)}
                              className="px-5 py-2.5 rounded-xl"
                              style={{ backgroundColor: "white", border: "1px solid #e3e9e7", color: "#3c4947", cursor: "pointer", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700 }}
                          >
                            취소
                          </button>
                          <button
                              onClick={handleSaveProfile}
                              disabled={saveProfileMutation.isPending}
                              className="px-5 py-2.5 rounded-xl"
                              style={{ backgroundColor: "#006a63", border: "none", color: "white", cursor: saveProfileMutation.isPending ? "not-allowed" : "pointer", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700, opacity: saveProfileMutation.isPending ? 0.7 : 1 }}
                          >
                            {saveProfileMutation.isPending ? "저장 중..." : "변경사항 저장"}
                          </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditingProfile(true)}
                            className="px-5 py-2.5 rounded-xl"
                            style={{ backgroundColor: "#006a63", border: "none", color: "white", cursor: "pointer", fontFamily: "Pretendard, sans-serif", fontSize: 14, fontWeight: 700 }}
                        >
                          정보 수정하기
                        </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>이메일</P>
                      <input
                          type="text"
                          value={profileData.email}
                          disabled
                          placeholder="정보 없음"
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: "#f8fafb", color: profileData.email ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>나이</P>
                      <input
                          type="number"
                          value={profileData.age}
                          onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                          disabled={!isEditingProfile}
                          placeholder="정보 없음"
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.age ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>성별</P>
                      <select
                          value={profileData.gender}
                          onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.gender ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        <option value="남성">남성</option>
                        <option value="여성">여성</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>지역</P>
                      <select
                          value={profileData.region}
                          onChange={(e) => setProfileData({ ...profileData, region: e.target.value, district: "" })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.region ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        <option value="서울특별시">서울특별시</option>
                        <option value="경기도">경기도</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>시/군/구</P>
                      <select
                          value={profileData.district}
                          onChange={(e) => setProfileData({ ...profileData, district: e.target.value })}
                          disabled={!isEditingProfile || districtOptions.length === 0}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile && districtOptions.length > 0 ? "white" : "#f8fafb", color: profileData.district ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        {districtOptions.map((district) => (
                            <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>학력</P>
                      <select
                          value={profileData.education}
                          onChange={(e) => setProfileData({ ...profileData, education: e.target.value })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.education ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        <option value="고등학교 졸업">고등학교 졸업</option>
                        <option value="대학교 재학">대학교 재학</option>
                        <option value="대학교 졸업">대학교 졸업</option>
                        <option value="대학원 재학">대학원 재학</option>
                        <option value="대학원 졸업">대학원 졸업</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>고용 상태</P>
                      <select
                          value={profileData.employmentStatus}
                          onChange={(e) => setProfileData({ ...profileData, employmentStatus: e.target.value })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.employmentStatus ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        <option value="구직 중">구직 중</option>
                        <option value="재직 중">재직 중</option>
                        <option value="자영업">자영업</option>
                        <option value="프리랜서">프리랜서</option>
                        <option value="학생">학생</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>연소득</P>
                      <input
                          type="number"
                          value={profileData.annualIncome}
                          onChange={(e) => setProfileData({ ...profileData, annualIncome: e.target.value })}
                          disabled={!isEditingProfile}
                          placeholder="정보 없음"
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.annualIncome ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>자산</P>
                      <select
                          value={profileData.assets}
                          onChange={(e) => setProfileData({ ...profileData, assets: e.target.value })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: profileData.assets ? "#171d1c" : "#94a3b8", fontFamily: "Pretendard, sans-serif" }}
                      >
                        <option value="">정보 없음</option>
                        <option value="5,000만원 미만">5,000만원 미만</option>
                        <option value="5,000만원 이상 ~ 1억원 미만">5,000만원 이상 ~ 1억원 미만</option>
                        <option value="1억원 이상 ~ 3억원 미만">1억원 이상 ~ 3억원 미만</option>
                        <option value="3억원 이상">3억원 이상</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>장애 여부</P>
                      <button
                          onClick={() => isEditingProfile && setProfileData({ ...profileData, hasDisability: !profileData.hasDisability })}
                          disabled={!isEditingProfile}
                          className="h-12 rounded-xl px-4 text-left"
                          style={{ border: "1px solid #e3e9e7", backgroundColor: isEditingProfile ? "white" : "#f8fafb", color: "#171d1c", cursor: isEditingProfile ? "pointer" : "default", fontFamily: "Pretendard, sans-serif" }}
                      >
                        {profileData.hasDisability ? "있음" : profile ? "없음" : "정보 없음"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <P style={{ fontSize: 13, fontWeight: 700, color: "#3c4947" }}>관심 분야</P>
                    <div className="flex gap-2">
                      {(["주거", "일자리", "복지"] as const).map((category) => {
                        const isSelected = profileData.interests.includes(category);

                        return (
                            <button
                                key={category}
                                onClick={() => toggleInterest(category)}
                                disabled={!isEditingProfile}
                                className="px-4 py-2 rounded-full"
                                style={{
                                  backgroundColor: isSelected ? "rgba(0,106,99,0.1)" : "white",
                                  color: isSelected ? "#006a63" : "#64748b",
                                  border: `1px solid ${isSelected ? "rgba(0,106,99,0.18)" : "#e3e9e7"}`,
                                  cursor: isEditingProfile ? "pointer" : "default",
                                  fontFamily: "Pretendard, sans-serif",
                                  fontSize: 14,
                                  fontWeight: isSelected ? 700 : 500,
                                }}
                            >
                              {category}
                            </button>
                        );
                      })}
                      {profileData.interests.length === 0 && (
                          <P style={{ fontSize: 13, color: "#94a3b8", alignSelf: "center" }}>정보 없음</P>
                      )}
                    </div>
                  </div>
                </div>
              </div>
          )}
        </main>

        {/* ── Compare Floating Bar ── */}
        {mainTab === "scraps" && selected.length > 0 && (
            <div
                className="fixed bottom-6 left-1/2 z-40 flex items-center gap-4 px-6 py-4 rounded-2xl"
                style={{
                  transform: "translateX(-50%)",
                  backgroundColor: "white",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  border: "1px solid rgba(187,201,199,0.4)",
                  minWidth: 420,
                }}
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#006a63" }}>
                  <P style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{selected.length}</P>
                </div>
                <P style={{ fontSize: 14, fontWeight: 600, color: "#171d1c" }}>공고 선택됨</P>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedPolicies.map((p) => {
                    const label = getPolicyCategoryLabel(p);
                    return (
                        <span
                            key={p.id}
                            className="px-2.5 py-0.5 rounded-full text-xs"
                            style={{ backgroundColor: categoryColor[label].bg, color: categoryColor[label].text, fontFamily: "Pretendard, sans-serif", fontWeight: 600 }}
                        >
                          {p.title.length > 12 ? p.title.slice(0, 12) + "…" : p.title}
                        </span>
                    );
                  })}
                </div>
              </div>
              <button
                  onClick={clearSelection}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 10px", fontFamily: "Pretendard, sans-serif", fontSize: 13, color: "#94a3b8", fontWeight: 500 }}
              >
                초기화
              </button>
              <button
                  disabled={selected.length < 2}
                  onClick={() => setShowCompare(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-95"
                  style={{
                    backgroundColor: selected.length < 2 ? "#e2e8f0" : "#006a63",
                    border: "none",
                    cursor: selected.length < 2 ? "not-allowed" : "pointer",
                    fontFamily: "Pretendard, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: selected.length < 2 ? "#94a3b8" : "white",
                  }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4H14M2 8H10M2 12H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                비교하기
              </button>
            </div>
        )}

        {showCompare && (
            <CompareModal
                policies={selectedPolicies}
                onClose={() => setShowCompare(false)}
                onSchedule={handleSchedulePolicy}
            />
        )}

        {detailPolicy && (
            <PolicyDetailSidePanel
                policy={detailPolicy}
                onClose={() => setDetailPolicyId(null)}
                isBookmarked
                onToggleBookmark={requestRemoveBookmarkFromDetail}
            />
        )}

        {removeConfirmId && (() => {
          const policy = bookmarkedPolicies.find((p) => p.id === removeConfirmId);

          return (
              <div
                  className="fixed inset-0 z-[60] flex items-center justify-center"
                  style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
                  onClick={() => setRemoveConfirmId(null)}
              >
                <div
                    className="bg-white rounded-2xl p-8 flex flex-col items-center gap-5"
                    style={{ width: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
                    onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,106,99,0.08)" }}>
                    <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
                      <path
                          d="M2 3C2 1.89543 2.89543 1 4 1H24C25.1046 1 26 1.89543 26 3V29.382C26 29.7607 25.5724 29.9899 25.2764 29.7764L14 22.118L2.7236 29.7764C2.4276 29.9899 2 29.7607 2 29.382V3Z"
                          fill="#006a63"
                          stroke="#006a63"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <p style={{ fontFamily: "Pretendard, sans-serif", fontWeight: 700, fontSize: 18, color: "#171d1c", margin: "0 0 8px 0" }}>
                      북마크를 취소할까요?
                    </p>
                    <p style={{ fontFamily: "Pretendard, sans-serif", fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600, color: "#3c4947" }}>{policy?.title}</span><br />
                      북마크함에서 삭제됩니다.
                    </p>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                        onClick={() => setRemoveConfirmId(null)}
                        className="flex-1 h-12 rounded-xl"
                        style={{
                          fontFamily: "Pretendard, sans-serif",
                          fontSize: 15,
                          fontWeight: 600,
                          background: "#f1f5f9",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                    >
                      취소
                    </button>

                    <button
                        onClick={() => confirmRemoveBookmark(removeConfirmId)}
                        disabled={toggleBookmarkMutation.isPending}
                        className="flex-1 h-12 rounded-xl"
                        style={{
                          fontFamily: "Pretendard, sans-serif",
                          fontSize: 15,
                          fontWeight: 700,
                          backgroundColor: "#006a63",
                          border: "none",
                          color: "white",
                          cursor: toggleBookmarkMutation.isPending ? "not-allowed" : "pointer",
                          opacity: toggleBookmarkMutation.isPending ? 0.65 : 1,
                        }}
                    >
                      예, 삭제할게요
                    </button>
                  </div>
                </div>
              </div>
          );
        })()}
      </div>
  );
}