import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import type { Policy } from "../../api/types";
import { useRecommendedPolicies, useTogglePolicyBookmark } from "../../api/queries/usePolicyQueries";
import { usePolicyFiltersStore } from "../../stores/usePolicyFiltersStore";
import { P } from "./common/Typography";
import { Spinner } from "./common/Spinner";
import { getCategoryStyle, getDeadlineColor } from "../../constants/categories";
import { PolicyDetailSidePanel } from "./common/PolicyDetailSidePanel";

const categoryColor = {
  주거: { bg: getCategoryStyle("주거").bg, text: getCategoryStyle("주거").text },
  일자리: { bg: getCategoryStyle("일자리").bg, text: getCategoryStyle("일자리").text },
  복지: { bg: getCategoryStyle("복지").bg, text: getCategoryStyle("복지").text },
};

const deadlineColor = getDeadlineColor;

interface PolicyListPageProps {
  onNavigate: (page: string, id?: string) => void;
}

function EmptyPoliciesState({ onNavigate }: Pick<PolicyListPageProps, "onNavigate">) {
  return (
      <div className="min-h-screen pt-16" style={{ backgroundColor: "#f5fbf8" }}>
        <main className="max-w-[1280px] mx-auto px-8 py-10">
          <div
              className="flex min-h-[520px] flex-col items-center justify-center gap-5 rounded-2xl bg-white px-6 text-center"
              style={{
                border: "1px solid rgba(187,201,199,0.4)",
                boxShadow: "0 8px 24px -4px rgba(79,209,197,0.06)",
              }}
          >
            <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(79,209,197,0.16)" }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                <path d="M8 7.5H22C23.1046 7.5 24 8.39543 24 9.5V24L15 19.5L6 24V9.5C6 8.39543 6.89543 7.5 8 7.5Z" stroke="#006a63" strokeWidth="2" strokeLinejoin="round" />
                <path d="M11 12.5H19M11 16H17" stroke="#006a63" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h1 style={{ fontFamily: "Pretendard, sans-serif", fontWeight: 700, fontSize: 28, color: "#171d1c", margin: 0 }}>
                내 조건에 맞는 공고가 없어요
              </h1>
              <P style={{ fontSize: 15, color: "#64748b" }}>
                마이페이지에서 내 정보를 확인하고 조건을 다시 조정해보세요.
              </P>
            </div>
            <button
                onClick={() => onNavigate("mypage")}
                className="mt-2 rounded-xl px-6 py-3 transition-all hover:opacity-90"
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
        </main>
      </div>
  );
}

export function PolicyListPage({ onNavigate }: PolicyListPageProps) {
  const { category: activeFilter, setCategory: setActiveFilter, sort, setSort } = usePolicyFiltersStore();
  const { data: recommendedPolicies = [], isLoading, error } = useRecommendedPolicies();
  const toggleBookmarkMutation = useTogglePolicyBookmark();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [detailPolicy, setDetailPolicy] = useState<Policy | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const detailPolicyId = searchParams.get("detail");

  const filteredPolicies = activeFilter === "전체"
      ? recommendedPolicies
      : recommendedPolicies.filter((p) => p.categoryKr === activeFilter);

  const bookmarks = new Set(filteredPolicies.filter((p) => p.bookmarked).map((p) => p.id));

  const sorted = sort === "최신순"
      ? [...filteredPolicies].reverse()
      : filteredPolicies;

  useEffect(() => {
    if (!detailPolicyId) return;
    const policy = recommendedPolicies.find((item) => item.id === detailPolicyId);
    if (policy) setDetailPolicy(policy);
  }, [detailPolicyId, recommendedPolicies]);

  const openDetailPolicy = (policy: Policy) => {
    setDetailPolicy(policy);
    const next = new URLSearchParams(searchParams);
    next.set("detail", policy.id);
    setSearchParams(next, { replace: true });
  };

  const closeDetailPolicy = () => {
    setDetailPolicy(null);
    if (!detailPolicyId) return;

    const next = new URLSearchParams(searchParams);
    next.delete("detail");
    setSearchParams(next, { replace: true });
  };

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    toggleBookmarkMutation.mutate(
        {
          id,
          bookmarked: bookmarks.has(id),
        },
        {
          onSuccess: () => toast.success(bookmarks.has(id) ? "스크랩을 취소했습니다." : "스크랩함에 추가했습니다."),
          onError: () => toast.error("북마크 변경에 실패했습니다."),
        },
    );
  };

  const requestToggleBookmarkFromDetail = (id: string) => {
    if (bookmarks.has(id)) {
      setRemoveConfirmId(id);
      return;
    }

    toggleBookmark(id);
  };

  const confirmRemoveBookmark = (id: string) => {
    toggleBookmarkMutation.mutate(
        {
          id,
          bookmarked: true,
        },
        {
          onSuccess: () => toast.success("스크랩을 취소했습니다."),
          onError: () => toast.error("북마크 변경에 실패했습니다."),
          onSettled: () => setRemoveConfirmId(null),
        },
    );
  };

  if (isLoading) {
    return (
        <div className="min-h-screen pt-16" style={{ backgroundColor: "#f5fbf8" }}>
          <Spinner label="정책을 불러오는 중..." />
        </div>
    );
  }

  if (error || (!isLoading && recommendedPolicies.length === 0)) {
    return <EmptyPoliciesState onNavigate={onNavigate} />;
  }

  return (
      <div className="min-h-screen pt-16" style={{ backgroundColor: "#f5fbf8" }}>
        <main className="max-w-[1280px] mx-auto px-8 py-10 flex flex-col gap-6">
          {/* Page Header */}
          <div className="flex flex-col gap-1">
            <h1 style={{ fontFamily: "Pretendard, sans-serif", fontWeight: 700, fontSize: 32, color: "#171d1c", margin: 0 }}>공고</h1>
            <P style={{ color: "#3c4947", fontSize: 16 }}>맞춤 정책을 찾아 지원 기회를 놓치지 마세요.</P>
          </div>

          {/* Filters */}
          <div className="sticky top-16 z-10 flex items-center gap-2 py-3" style={{ backgroundColor: "rgba(245,251,248,0.95)", backdropFilter: "blur(6px)" }}>
            {(["전체", "주거", "일자리", "복지"] as const).map((f) => (
                <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className="px-4 py-2 rounded-full text-sm transition-all"
                    style={{
                      fontFamily: "Pretendard, sans-serif",
                      fontWeight: activeFilter === f ? 600 : 500,
                      backgroundColor: activeFilter === f ? "rgba(79,209,197,0.2)" : "white",
                      color: activeFilter === f ? "#005750" : "#3c4947",
                      border: `1px solid ${activeFilter === f ? "rgba(79,209,197,0.3)" : "rgba(187,201,199,0.5)"}`,
                      cursor: "pointer",
                    }}
                >
                  {f}
                </button>
            ))}
            <div className="ml-auto relative">
              <button
                  className="px-4 py-2 rounded-xl text-sm flex items-center gap-1"
                  style={{
                    fontFamily: "Pretendard, sans-serif",
                    fontWeight: 700,
                    backgroundColor: "white",
                    color: "#3c4947",
                    border: "1px solid rgba(187,201,199,0.6)",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
              >
                {sort}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: showSortDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M1 1L5 5L9 1" stroke="#3C4947" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showSortDropdown && (
                  <>
                    <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowSortDropdown(false)}
                    />
                    <div
                        className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg overflow-hidden z-30"
                        style={{ border: "1px solid rgba(187,201,199,0.3)", minWidth: "160px" }}
                    >
                      {(["마감일 임박순", "최신순"] as const).map((option) => (
                          <button
                              key={option}
                              className="w-full px-4 py-3 text-sm text-left transition-colors hover:bg-slate-50"
                              style={{
                                fontFamily: "Pretendard, sans-serif",
                                fontWeight: sort === option ? 600 : 500,
                                color: sort === option ? "#006a63" : "#3c4947",
                                backgroundColor: sort === option ? "rgba(79,209,197,0.08)" : "white",
                                border: "none",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                setSort(option);
                                setShowSortDropdown(false);
                              }}
                          >
                            {option}
                          </button>
                      ))}
                    </div>
                  </>
              )}
            </div>
          </div>

          {/* Summary Bar */}
          <div
              className="flex items-center justify-between p-5 rounded-2xl"
              style={{ background: "linear-gradient(to right, rgba(79,209,197,0.1), rgba(79,209,197,0))", border: "1px solid rgba(79,209,197,0.2)" }}
          >
            <div className="flex items-center gap-3">
              <div
                  className="w-12 h-12 rounded-xl bg-white flex items-center justify-center"
                  style={{ border: "1px solid rgba(79,209,197,0.2)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 2L13.5 8H20L14.5 12L16.5 18L11 14L5.5 18L7.5 12L2 8H8.5L11 2Z" fill="#4fd1c5" />
                </svg>
              </div>
              <P style={{ fontSize: 18, color: "#171d1c", fontWeight: 500 }}>
                회원님 프로필 기준 추천 공고{" "}
                <span style={{ color: "#006a63", fontWeight: 700 }}>{recommendedPolicies.length}건</span>
              </P>
            </div>
          </div>

          {/* Policy Grid */}
          <div className="grid grid-cols-2 gap-6 pb-12">
            {sorted.map((policy) => {
              const catStyle = getCategoryStyle(policy.category);
              const isBookmarked = bookmarks.has(policy.id);
              return (
                <div
                    key={policy.id}
                    className="bg-white rounded-2xl p-7 cursor-pointer hover:shadow-md transition-all border relative"
                    style={{ border: "1px solid rgba(187,201,199,0.4)", boxShadow: "0 8px 24px -4px rgba(79,209,197,0.06)" }}
                    onClick={() => openDetailPolicy(policy)}
                >
                  {/* Gradient corner */}
                  <div
                      className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-50"
                      style={{ background: `linear-gradient(135deg, ${catStyle.bg} 0%, transparent 100%)` }}
                  />

                  <div className="relative">
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span
                            className="px-2.5 py-1 rounded text-xs"
                            style={{ backgroundColor: catStyle.bg, color: catStyle.text, fontFamily: "Pretendard, sans-serif", fontWeight: 500 }}
                        >
                          {policy.categoryKr}
                        </span>
                      </div>
                      <button
                          onClick={(e) => toggleBookmark(policy.id, e)}
                          className="p-1 transition-colors"
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                      >
                        <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                          <path
                              d="M2 2H16C16.552 2 17 2.448 17 3V19L9 15L1 19V3C1 2.448 1.448 2 2 2Z"
                              stroke={isBookmarked ? "#006a63" : "#6C7A77"}
                              fill={isBookmarked ? "#006a63" : "none"}
                              strokeWidth="1.375"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Title & Org */}
                    <P style={{ fontSize: 12, color: "#3c4947", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 4 }}>{policy.org}</P>
                    <P style={{ fontSize: 18, color: "#171d1c", fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>{policy.title}</P>
                    <P style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>{policy.desc}</P>

                    {/* Footer */}
                    <div
                        className="flex items-center justify-between pt-4"
                        style={{ borderTop: "1px solid rgba(187,201,199,0.3)" }}
                    >
                      <P style={{ fontSize: 12, color: "#3c4947" }}>지원규모: {policy.support}</P>
                      <button
                          className="text-base font-medium transition-colors hover:opacity-70"
                          style={{ fontFamily: "Pretendard, sans-serif", color: "#006a63", background: "none", border: "none", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); openDetailPolicy(policy); }}
                      >
                        상세보기
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* ── Policy Detail Side Panel ── */}
        {detailPolicy && (
            <PolicyDetailSidePanel
                policy={detailPolicy}
                onClose={closeDetailPolicy}
                isBookmarked={bookmarks.has(detailPolicy.id)}
                onToggleBookmark={requestToggleBookmarkFromDetail}
            />
        )}

        {removeConfirmId && (() => {
          const policy = recommendedPolicies.find((item) => item.id === removeConfirmId);

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
                    <svg width="24" height="26" viewBox="0 0 18 20" fill="none">
                      <path d="M2 2H16C16.552 2 17 2.448 17 3V19L9 15L1 19V3C1 2.448 1.448 2 2 2Z" stroke="#006a63" fill="#006a63" strokeWidth="1.375" />
                    </svg>
                  </div>
                  <div className="text-center flex flex-col gap-2">
                    <h3 style={{ fontFamily: "Pretendard, sans-serif", fontSize: 22, fontWeight: 700, color: "#171d1c", margin: 0 }}>
                      북마크를 취소할까요?
                    </h3>
                    <P style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                      {policy?.title ?? "선택한 공고"}를 스크랩 목록에서 제거합니다.
                    </P>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        className="h-12 rounded-xl transition-all hover:bg-slate-50"
                        style={{ border: "1px solid #cbd5e1", background: "white", color: "#3c4947", fontFamily: "Pretendard, sans-serif", fontWeight: 700, cursor: "pointer" }}
                        onClick={() => setRemoveConfirmId(null)}
                    >
                      아니요
                    </button>
                    <button
                        className="h-12 rounded-xl transition-all hover:opacity-90"
                        style={{ border: "none", background: "#006a63", color: "white", fontFamily: "Pretendard, sans-serif", fontWeight: 700, cursor: "pointer" }}
                        onClick={() => confirmRemoveBookmark(removeConfirmId)}
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
