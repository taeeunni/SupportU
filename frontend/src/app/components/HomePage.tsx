import { useState } from "react";
import { toast } from "sonner";
import { useAuthUser } from "../../api/queries/useAuthQueries";
import { useProfile } from "../../api/queries/useProfileQueries";
import { useBenefitSummary } from "../../api/queries/useBenefitQueries";
import { useRecommendedPolicies } from "../../api/queries/usePolicyQueries";
import { useChecklist, useToggleChecklistItem } from "../../api/queries/useChecklistQueries";
import { P } from "./common/Typography";
import { getCategoryStyle } from "../../constants/categories";

interface HomePageProps {
  onNavigate: (page: string, id?: string) => void;
}

function EmptyRecommendedPolicies({ onNavigate }: Pick<HomePageProps, "onNavigate">) {
  return (
      <div
          className="flex min-h-60 w-full flex-col items-center justify-center gap-4 rounded-3xl bg-white px-6 py-10 text-center"
          style={{ border: "1px solid rgba(0,106,99,0.08)" }}
      >
        <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(79,209,197,0.16)" }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M7.5 6.5H20.5C21.6046 6.5 22.5 7.39543 22.5 8.5V23L14 18.75L5.5 23V8.5C5.5 7.39543 6.39543 6.5 7.5 6.5Z" stroke="#006a63" strokeWidth="2" strokeLinejoin="round" />
            <path d="M10.5 11.5H17.5M10.5 15H15.5" stroke="#006a63" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex flex-col gap-2">
          <P style={{ fontSize: 22, color: "#171d1c", fontWeight: 700 }}>
            내 조건에 맞는 공고가 없어요
          </P>
          <P style={{ fontSize: 15, color: "#64748b" }}>
            마이페이지에서 내 정보를 확인하고 조건을 다시 조정해보세요.
          </P>
        </div>
        <button
            onClick={() => onNavigate("mypage")}
            className="mt-1 rounded-xl px-5 py-3 transition-all hover:opacity-90"
            style={{
              fontFamily: "Pretendard, sans-serif",
              fontSize: 15,
              fontWeight: 700,
              backgroundColor: "#006a63",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
        >
          마이페이지로 이동
        </button>
      </div>
  );
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { data: user } = useAuthUser();
  const { data: profile } = useProfile();
  const { data: benefitSummary, isLoading: isBenefitSummaryLoading } = useBenefitSummary(profile?.uid);
  const { data: recommendedPolicies = [], error: recommendedPoliciesError } = useRecommendedPolicies();
  const { data: checklist = [], isLoading: isChecklistLoading, error: checklistError } = useChecklist();
  const toggleMutation = useToggleChecklistItem();

  const [activeFilter, setActiveFilter] = useState("전체");
  const greetingName = user?.name ?? "청년";

  const doneCount = checklist.filter((i) => i.done).length;
  const progress = checklist.length === 0 ? 0 : Math.round((doneCount / checklist.length) * 100);
  const totalBenefitManwon = Math.floor((benefitSummary?.totalBenefitAmount ?? 0) / 10000);
  const benefitPeriodText = benefitSummary?.benefitPeriodText ?? "현재 기준";

  // 체크리스트 토글: optimistic update + 에러 시 토스트 알림
  const toggleItem = (id: number, currentDone: boolean) => {
    toggleMutation.mutate(
        { id, done: !currentDone },
        {
          onError: () => toast.error("체크리스트 업데이트에 실패했습니다."),
        },
    );
  };

  const filteredPolicies =
      activeFilter === "전체"
          ? recommendedPolicies
          : recommendedPolicies.filter((p) => p.categoryKr === activeFilter);

  return (
      <div className="min-h-screen pt-16" style={{ backgroundColor: "#f5fbf8" }}>
        <main className="max-w-[1280px] mx-auto px-8 py-12 flex flex-col gap-12">
          {/* Header */}
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <h1 style={{ fontFamily: "Pretendard, sans-serif", fontWeight: 700, fontSize: 40, color: "#171d1c", letterSpacing: "-1px", margin: 0 }}>
                안녕하세요, {greetingName}님 👋
              </h1>
              <P style={{ fontSize: 18, color: "#64748b", margin: 0 }}>오늘도 맞춤 정책을 확인해보세요.</P>
            </div>
            <P style={{ fontSize: 14, color: "#94a3b8", paddingBottom: 8 }}>2025년 5월 20일 화요일</P>
          </div>

          {/* Top Grid */}
          <div className="grid gap-6" style={{ gridTemplateColumns: "5fr 7fr" }}>
            {/* Checklist Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border" style={{ borderColor: "rgba(0,106,99,0.08)" }}>
              <div className="flex items-center justify-between mb-6">
                <P style={{ fontSize: 20, color: "#171d1c", fontWeight: 400 }}>이번주 나의 체크리스트</P>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>•••</button>
              </div>

              {isChecklistLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 rounded-xl">
                          <div className="w-6 h-6 rounded" style={{ backgroundColor: "#f1f5f9" }} />
                          <div className="flex-1 h-4 rounded" style={{ backgroundColor: "#f1f5f9" }} />
                          <div className="w-20 h-6 rounded" style={{ backgroundColor: "#f1f5f9" }} />
                        </div>
                    ))}
                  </div>
              ) : checklistError ? (
                  <div
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl px-5 py-10 text-center"
                      style={{ backgroundColor: "rgba(186,26,26,0.05)", border: "1px solid rgba(186,26,26,0.12)" }}
                  >
                    <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>체크리스트를 불러오지 못했어요</P>
                    <P style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                      잠시 후 다시 확인해주세요.
                    </P>
                  </div>
              ) : checklist.length === 0 ? (
                  <div
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl px-5 py-10 text-center"
                      style={{ backgroundColor: "rgba(0,106,99,0.04)", border: "1px solid rgba(0,106,99,0.1)" }}
                  >
                    <P style={{ fontSize: 15, fontWeight: 700, color: "#171d1c" }}>이번주 체크리스트가 없어요</P>
                    <P style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                      필요한 서류가 생기면 여기에 표시됩니다.
                    </P>
                  </div>
              ) : (
                  <div className="flex flex-col gap-2">
                    {checklist.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => toggleItem(item.id, item.done)}
                        >
                          <div
                              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                              style={{
                                backgroundColor: item.done ? "#4fd1c5" : "transparent",
                                border: item.done ? "2px solid #4fd1c5" : "2px solid #cbd5e1",
                              }}
                          >
                            {item.done && (
                                <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                                  <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <P
                                style={{
                                  fontSize: 16,
                                  fontWeight: 500,
                                  color: item.done ? "#94a3b8" : "#171d1c",
                                  textDecoration: item.done ? "line-through" : "none",
                                }}
                            >
                              {item.label}
                            </P>
                            <div className="flex items-center gap-2">
                          <span
                              className="px-2 py-1 rounded text-xs font-bold"
                              style={{ backgroundColor: item.deadlineBg, color: item.deadlineColor }}
                          >
                            {item.deadline}
                          </span>
                              <span
                                  className="px-2 py-1 rounded text-xs"
                                  style={{ backgroundColor: item.categoryBg, color: item.categoryColor, fontFamily: "Pretendard, sans-serif" }}
                              >
                            {item.category}
                          </span>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                <P style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>{doneCount}/{checklist.length} 완료</P>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f1f5f9" }}>
                  <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, background: "linear-gradient(to right, #4fd1c5, #79f7ea)" }}
                  />
                </div>
              </div>
            </div>

            {/* AI Report Panel */}
            <div
                className="rounded-3xl p-10 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, rgba(59,102,97,0.95) 0%, rgba(43,76,72,0.9) 100%)", minHeight: 320 }}
            >
              <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-5 top-[-50px] right-[-50px] bg-white" />
              <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-10 bottom-[-50px] left-[-50px]" style={{ backgroundColor: "#4fd1c5" }} />

              <div className="relative flex flex-col justify-center items-center h-full gap-6">
                <div className="flex flex-col items-center gap-4">
                  <P style={{ fontSize: 18, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                    정책 지원을 통해
                  </P>
                  <div className="flex items-baseline gap-3">
                    <P style={{ fontSize: 72, color: "#79f7ea", fontWeight: 800, lineHeight: 1, textShadow: "0 0 30px rgba(121,247,234,0.5)" }}>
                      {isBenefitSummaryLoading ? "..." : totalBenefitManwon.toLocaleString()}
                    </P>
                    <P style={{ fontSize: 32, color: "white", fontWeight: 600, marginBottom: 8 }}>만원</P>
                  </div>
                  <P style={{ fontSize: 18, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                    을 지원받으셨어요
                  </P>
                  <P style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginTop: 4 }}>
                    {benefitPeriodText}
                  </P>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Policies Section */}
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-4">
                <P style={{ fontSize: 24, color: "#171d1c", fontWeight: 500 }}>나를 위한 추천 정책</P>
                <div className="flex gap-2">
                  {["전체", "주거", "일자리", "복지"].map((filter) => (
                      <button
                          key={filter}
                          onClick={() => setActiveFilter(filter)}
                          className="px-4 py-2 rounded-full text-base flex items-center gap-2 transition-all"
                          style={{
                            fontFamily: "Pretendard, sans-serif",
                            fontWeight: 500,
                            backgroundColor: activeFilter === filter ? "rgba(0,106,99,0.1)" : "white",
                            color: activeFilter === filter ? "#006a63" : "#475569",
                            border: `1px solid ${activeFilter === filter ? "transparent" : "#e2e8f0"}`,
                            cursor: "pointer",
                          }}
                      >
                        {activeFilter === filter && <span className="w-1.5 h-1.5 rounded-full bg-[#006a63]" />}
                        {filter}
                      </button>
                  ))}
                </div>
              </div>
              <button
                  onClick={() => onNavigate("policies")}
                  className="flex items-center gap-1 pb-2 transition-colors hover:opacity-80"
                  style={{ fontFamily: "Pretendard, sans-serif", fontSize: 16, color: "#006a63", background: "none", border: "none", cursor: "pointer" }}
              >
                전체보기
                <svg width="7" height="10" viewBox="0 0 7 10" fill="none">
                  <path d="M1 1L6 5L1 9" stroke="#006A63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {recommendedPoliciesError || filteredPolicies.length === 0 ? (
                <EmptyRecommendedPolicies onNavigate={onNavigate} />
            ) : (
                <div className="flex gap-6 overflow-x-auto pb-4">
                  {filteredPolicies.map((policy) => {
                    const categoryStyle = getCategoryStyle(policy.category);
                    const deadlineDays = parseInt(policy.deadline?.replace("D-", "") ?? "", 10);
                    const deadlineColor = !Number.isNaN(deadlineDays) && deadlineDays <= 3 ? "#ba1a1a" : "#475569";
                    return (
                    <div
                        key={policy.id}
                        className="flex-shrink-0 w-80 h-60 bg-white rounded-3xl p-6 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow border"
                        style={{ borderColor: "rgba(0,106,99,0.08)" }}
                        onClick={() => onNavigate("policy-detail", policy.id)}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                              className="px-2.5 py-1 rounded text-xs font-bold"
                              style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text, fontFamily: "Pretendard, sans-serif" }}
                          >
                            {policy.categoryKr}
                          </span>
                          {policy.region && (
                            <P style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 700, letterSpacing: "0.5px" }}>{policy.region}</P>
                          )}
                        </div>
                        <P style={{ fontSize: 18, color: "#171d1c", fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>{policy.title}</P>
                        <P style={{ fontSize: 14, color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>{policy.desc}</P>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "#f1f5f9" }}>
                        <P style={{ fontSize: 16, fontWeight: 700, color: deadlineColor }}>
                          {policy.deadline}
                        </P>
                        <button
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "#f8fafc" }}
                            onClick={(e) => { e.stopPropagation(); onNavigate("policy-detail", policy.id); }}
                        >
                          <svg width="12" height="15" viewBox="0 0 12 15" fill="none">
                            <path d="M2 1H10C10.552 1 11 1.448 11 2V14L6 11L1 14V2C1 1.448 1.448 1 2 1Z" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    );
                  })}

                  {/* More card */}
                  <div
                      className="flex-shrink-0 w-80 h-60 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      style={{ border: "2px dashed #cbd5e1" }}
                      onClick={() => onNavigate("policies")}
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1V13M1 7H13" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <P style={{ fontSize: 16, color: "#64748b" }}>더 많은 정책 찾기</P>
                  </div>
                </div>
            )}
          </div>
        </main>

        {/* FAB */}
        <button
            className="fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: "#4fd1c5", boxShadow: "0 8px 12px rgba(79,209,197,0.4)" }}
            onClick={() => onNavigate("policies")}
        >
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            <path d="M13 1L24 7V15L13 21L2 15V7L13 1Z" fill="white" />
            <path d="M13 5L20 9V15L13 19L6 15V9L13 5Z" fill="rgba(0,106,99,0.3)" />
          </svg>
        </button>
      </div>
  );
}
