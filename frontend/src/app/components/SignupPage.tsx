import { useState } from "react";
import { toast } from "sonner";
import type { ProfileRequest } from "../../api/types";
import { useSaveProfile } from "../../api/queries/useProfileQueries";
import { P } from "./common/Typography";

interface SignupPageProps {
  onComplete: () => void;
  onCancel: () => void;
}

// 회원가입 폼 단계 정보 — 컴포넌트 외부에 두어 매 렌더 시 재생성 방지
const TOTAL_STEPS = 4;
const GENDER_API_VALUE: Record<string, string> = {
  남성: "M",
  여성: "F",
  "선택 안함": "NONE",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i;

export function SignupPage({ onComplete, onCancel }: SignupPageProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const saveProfileMutation = useSaveProfile();
  const [formData, setFormData] = useState({
    email: "",
    age: 25,
    gender: "선택 안함",
    region: "",
    district: "",
    education: "",
    employment: "",
    annualIncome: 0,
    assets: 0,
    hasDisability: false,
    interests: [] as string[],
  });

  const totalSteps = TOTAL_STEPS;
  const isSubmitting = saveProfileMutation.isPending;
  const submitError = saveProfileMutation.error?.message ?? null;
  const isEmailValid = EMAIL_PATTERN.test(formData.email.trim());

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const profileData: ProfileRequest = {
      age: formData.age,
      gender: GENDER_API_VALUE[formData.gender] ?? "NONE",
      city: formData.region,
      scity: formData.district,
      education: formData.education,
      employment: formData.employment,
      disability: formData.hasDisability,
      incomeInteger: formData.annualIncome * 10000,
      asset: String(formData.assets * 10000),
      preferredCategories: formData.interests,
    };

    saveProfileMutation.mutate(profileData, {
      onSuccess: () => {
        toast.success("프로필이 저장되었습니다.");
        onComplete();
      },
      onError: (err) => {
        toast.error(err.message || "프로필 저장에 실패했습니다.");
      },
    });
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleInterest = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(category)
        ? prev.interests.filter((i) => i !== category)
        : [...prev.interests, category],
    }));
  };

  const districtsByRegion: Record<string, string[]> = {
    서울특별시: ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
    경기도: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "군포시", "오산시", "이천시", "양주시", "안성시", "구리시", "포천시", "의왕시", "하남시", "여주시", "동두천시", "과천시"],
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      return isEmailValid && formData.age > 0;
    }
    if (currentStep === 2) {
      return formData.region && formData.district && formData.education && formData.employment;
    }
    if (currentStep === 3) {
      return true; // 경제 정보는 선택사항으로 처리
    }
    if (currentStep === 4) {
      return formData.interests.length > 0;
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5fbf8" }}>
      {/* Header */}
      <div className="bg-white border-b" style={{ borderColor: "#e9efed" }}>
        <div className="max-w-4xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#006a63" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12.5 7.5L18 8.5L14 13L15 18.5L10 15.5L5 18.5L6 13L2 8.5L7.5 7.5L10 2Z" fill="white" />
              </svg>
            </div>
            <P style={{ fontSize: 20, fontWeight: 700, color: "#171d1c" }}>회원가입</P>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-slate-100"
            style={{ fontFamily: "Pretendard, sans-serif", color: "#64748b", background: "none", border: "1px solid #e9efed", cursor: "pointer" }}
          >
            취소
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b" style={{ borderColor: "#e9efed" }}>
        <div className="max-w-4xl mx-auto px-8 py-6">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((step) => {
              const isCompleted = step < currentStep;
              const isActive = step === currentStep;
              const stepLabels = ["기본 정보", "거주지 & 학력", "경제 상황", "관심 카테고리"];

              return (
                <div key={step} className="flex items-center" style={{ flex: 1 }}>
                  <div className="flex flex-col items-center" style={{ flex: 1 }}>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all"
                      style={{
                        backgroundColor: isCompleted || isActive ? "#006a63" : "#e9efed",
                        color: isCompleted || isActive ? "white" : "#94a3b8",
                        fontWeight: 700,
                        fontSize: 15,
                        border: isActive ? "3px solid rgba(0,106,99,0.2)" : "none",
                      }}
                    >
                      {isCompleted ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8L6.5 11.5L13 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        step
                      )}
                    </div>
                    <P style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#006a63" : "#64748b", textAlign: "center" }}>
                      {stepLabels[step - 1]}
                    </P>
                  </div>
                  {step < 4 && (
                    <div
                      className="h-0.5 mx-2"
                      style={{ flex: 1, backgroundColor: step < currentStep ? "#006a63" : "#e9efed" }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#e9efed" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%`, backgroundColor: "#006a63" }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-2xl">
          <div
            className="bg-white rounded-3xl p-10 shadow-lg"
            style={{ border: "1px solid rgba(0,106,99,0.1)" }}
          >
            {/* Step 1: 기본 정보 */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-8">
                <div>
                  <P style={{ fontSize: 26, fontWeight: 700, color: "#171d1c", marginBottom: 8 }}>기본 정보를 입력해주세요</P>
                  <P style={{ fontSize: 15, color: "#64748b" }}>정확한 정보를 입력하면 더 정확한 정책을 추천받을 수 있어요.</P>
                </div>

                {/* 이메일 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>이메일</P>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@email.com"
                    pattern="^[^\s@]+@[^\s@]+\.com$"
                    title="example@email.com 형식으로 입력해주세요"
                    className="w-full px-5 py-4 rounded-xl border transition-all"
                    style={{ fontFamily: "Pretendard, sans-serif", fontSize: 15, borderColor: "#e9efed", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#006a63")}
                    onBlur={(e) => (e.target.style.borderColor = "#e9efed")}
                  />
                  {formData.email.length > 0 && !isEmailValid && (
                    <P style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>
                      example@email.com 형식으로 입력해주세요.
                    </P>
                  )}
                </div>

                {/* 나이 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>나이</P>
                  <select
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                    className="w-full px-5 py-4 rounded-xl border"
                    style={{ fontFamily: "Pretendard, sans-serif", fontSize: 15, borderColor: "#e9efed", outline: "none", cursor: "pointer" }}
                  >
                    {Array.from({ length: 21 }, (_, i) => i + 19).map((age) => (
                      <option key={age} value={age}>{age}세</option>
                    ))}
                  </select>
                </div>

                {/* 성별 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>성별</P>
                  <div className="flex gap-3">
                    {["남성", "여성", "선택 안함"].map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setFormData({ ...formData, gender })}
                        className="flex-1 py-4 rounded-xl transition-all"
                        style={{
                          fontFamily: "Pretendard, sans-serif",
                          fontSize: 15,
                          fontWeight: formData.gender === gender ? 700 : 500,
                          backgroundColor: formData.gender === gender ? "rgba(0,106,99,0.1)" : "white",
                          color: formData.gender === gender ? "#006a63" : "#64748b",
                          border: `2px solid ${formData.gender === gender ? "#006a63" : "#e9efed"}`,
                          cursor: "pointer",
                        }}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: 거주지 & 학력 */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-8">
                <div>
                  <P style={{ fontSize: 26, fontWeight: 700, color: "#171d1c", marginBottom: 8 }}>거주지와 학력을 알려주세요</P>
                  <P style={{ fontSize: 15, color: "#64748b" }}>지역 맞춤 정책을 추천해드려요.</P>
                </div>

                {/* 거주지 시/도 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>거주지 (시/도)</P>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value, district: "" })}
                    className="w-full px-5 py-4 rounded-xl border"
                    style={{ fontFamily: "Pretendard, sans-serif", fontSize: 15, borderColor: "#e9efed", outline: "none", cursor: "pointer" }}
                  >
                    <option value="">선택해주세요</option>
                    <option value="서울특별시">서울특별시</option>
                    <option value="경기도">경기도</option>
                  </select>
                </div>

                {/* 거주지 구/군 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>거주지 (구/군)</P>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    disabled={!formData.region}
                    className="w-full px-5 py-4 rounded-xl border"
                    style={{
                      fontFamily: "Pretendard, sans-serif",
                      fontSize: 15,
                      borderColor: "#e9efed",
                      outline: "none",
                      cursor: formData.region ? "pointer" : "not-allowed",
                      backgroundColor: formData.region ? "white" : "#f8fafc",
                    }}
                  >
                    <option value="">선택해주세요</option>
                    {formData.region && districtsByRegion[formData.region]?.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                {/* 최종 학력 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>최종 학력</P>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      "고졸 이하",
                      "대학(교) 재학·휴학",
                      "전문대졸(초대졸)",
                      "대학졸업(학사)",
                      "대학원 석·박사 이상"
                    ].map((edu, index) => (
                      <button
                        key={edu}
                        onClick={() => setFormData({ ...formData, education: edu })}
                        className="py-4 rounded-xl transition-all"
                        style={{
                          fontFamily: "Pretendard, sans-serif",
                          fontSize: 13,
                          fontWeight: formData.education === edu ? 700 : 500,
                          backgroundColor: formData.education === edu ? "rgba(0,106,99,0.1)" : "white",
                          color: formData.education === edu ? "#006a63" : "#64748b",
                          border: `2px solid ${formData.education === edu ? "#006a63" : "#e9efed"}`,
                          cursor: "pointer",
                          gridColumn: index === 4 ? "span 2" : "auto",
                        }}
                      >
                        {edu}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 취업 상태 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>취업 상태</P>
                  <div className="grid grid-cols-2 gap-3">
                    {["재직 중", "구직 중", "프리랜서", "학생", "자영업", "기타"].map((emp) => (
                      <button
                        key={emp}
                        onClick={() => setFormData({ ...formData, employment: emp })}
                        className="py-4 rounded-xl transition-all"
                        style={{
                          fontFamily: "Pretendard, sans-serif",
                          fontSize: 14,
                          fontWeight: formData.employment === emp ? 700 : 500,
                          backgroundColor: formData.employment === emp ? "rgba(0,106,99,0.1)" : "white",
                          color: formData.employment === emp ? "#006a63" : "#64748b",
                          border: `2px solid ${formData.employment === emp ? "#006a63" : "#e9efed"}`,
                          cursor: "pointer",
                        }}
                      >
                        {emp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: 경제 상황 */}
            {currentStep === 3 && (
              <div className="flex flex-col gap-8">
                <div>
                  <P style={{ fontSize: 26, fontWeight: 700, color: "#171d1c", marginBottom: 8 }}>경제 상황을 입력해주세요</P>
                  <P style={{ fontSize: 15, color: "#64748b" }}>소득 기준에 맞는 정책을 찾아드려요. (선택사항)</P>
                </div>

                {/* 연소득 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>연소득 (만원)</P>
                  <input
                    type="number"
                    value={formData.annualIncome}
                    onChange={(e) => setFormData({ ...formData, annualIncome: parseInt(e.target.value) || 0 })}
                    placeholder="예: 2500"
                    className="w-full px-5 py-4 rounded-xl border transition-all"
                    style={{ fontFamily: "Pretendard, sans-serif", fontSize: 15, borderColor: "#e9efed", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#006a63")}
                    onBlur={(e) => (e.target.style.borderColor = "#e9efed")}
                  />
                </div>

                {/* 자산현황 */}
                <div>
                  <P style={{ fontSize: 14, fontWeight: 600, color: "#3c4947", marginBottom: 10 }}>자산현황 (만원)</P>
                  <input
                    type="number"
                    value={formData.assets}
                    onChange={(e) => setFormData({ ...formData, assets: parseInt(e.target.value) || 0 })}
                    placeholder="예: 5000"
                    className="w-full px-5 py-4 rounded-xl border transition-all"
                    style={{ fontFamily: "Pretendard, sans-serif", fontSize: 15, borderColor: "#e9efed", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#006a63")}
                    onBlur={(e) => (e.target.style.borderColor = "#e9efed")}
                  />
                </div>

                {/* 장애 유무 */}
                <div>
                  <div className="flex items-center justify-between p-5 rounded-xl border" style={{ borderColor: "#e9efed" }}>
                    <div>
                      <P style={{ fontSize: 15, fontWeight: 600, color: "#171d1c", marginBottom: 4 }}>장애 유무</P>
                      <P style={{ fontSize: 13, color: "#64748b" }}>장애인 대상 정책을 추천받으실 수 있어요.</P>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, hasDisability: !formData.hasDisability })}
                      className="relative w-14 h-7 rounded-full transition-all flex-shrink-0"
                      style={{
                        backgroundColor: formData.hasDisability ? "#006a63" : "#cbd5e1",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        className="absolute w-6 h-6 rounded-full bg-white transition-all"
                        style={{
                          top: "2px",
                          left: formData.hasDisability ? "30px" : "2px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: 관심 카테고리 */}
            {currentStep === 4 && (
              <div className="flex flex-col gap-8">
                <div>
                  <P style={{ fontSize: 26, fontWeight: 700, color: "#171d1c", marginBottom: 8 }}>관심 있는 분야를 선택하세요</P>
                  <P style={{ fontSize: 15, color: "#64748b" }}>선택하신 카테고리의 정책을 우선 추천해드려요. (중복 선택 가능)</P>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { category: "주거", icon: "🏠", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
                    { category: "복지", icon: "💝", color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" },
                    { category: "일자리", icon: "💼", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
                  ].map((item) => {
                    const isSelected = formData.interests.includes(item.category);

                    return (
                      <button
                        key={item.category}
                        onClick={() => toggleInterest(item.category)}
                        className="p-8 rounded-2xl transition-all relative"
                        style={{
                          backgroundColor: isSelected ? item.bg : "white",
                          border: `3px solid ${isSelected ? item.border : "#e9efed"}`,
                          cursor: "pointer",
                          transform: isSelected ? "scale(1.02)" : "scale(1)",
                        }}
                      >
                        {isSelected && (
                          <div
                            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: item.color }}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                        <div className="text-5xl mb-4">{item.icon}</div>
                        <P style={{ fontSize: 18, fontWeight: 700, color: isSelected ? item.color : "#171d1c" }}>{item.category}</P>
                      </button>
                    );
                  })}
                </div>

                {formData.interests.length > 0 && (
                  <div
                    className="p-4 rounded-xl flex items-center gap-2"
                    style={{ backgroundColor: "rgba(0,106,99,0.08)", border: "1px solid rgba(0,106,99,0.2)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="8" stroke="#006a63" strokeWidth="1.5" />
                      <path d="M6 9L8 11L12 7" stroke="#006a63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <P style={{ fontSize: 14, color: "#006a63" }}>
                      <strong>{formData.interests.join(", ")}</strong> 분야의 정책을 우선 추천해드릴게요!
                    </P>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t" style={{ borderColor: "#e9efed" }}>
        <div className="max-w-2xl mx-auto px-8 py-6 flex gap-4">
          {currentStep > 1 && (
            <button
              onClick={handlePrev}
              className="px-8 py-4 rounded-xl text-base font-bold transition-all hover:bg-slate-100"
              style={{
                fontFamily: "Pretendard, sans-serif",
                backgroundColor: "white",
                color: "#64748b",
                border: "2px solid #e9efed",
                cursor: "pointer",
              }}
            >
              이전
            </button>
          )}
          <div className="flex-1 flex flex-col gap-2">
            {submitError && (
              <P style={{ fontSize: 13, color: "#ba1a1a" }}>{submitError}</P>
            )}
            <button
              onClick={handleNext}
              disabled={!isStepValid() || isSubmitting}
              className="w-full py-4 rounded-xl text-base font-bold transition-all"
              style={{
                fontFamily: "Pretendard, sans-serif",
                backgroundColor: isStepValid() && !isSubmitting ? "#006a63" : "#e9efed",
                color: isStepValid() && !isSubmitting ? "white" : "#94a3b8",
                border: "none",
                cursor: isStepValid() && !isSubmitting ? "pointer" : "not-allowed",
                boxShadow: isStepValid() && !isSubmitting ? "0 4px 12px rgba(0,106,99,0.25)" : "none",
              }}
            >
              {isSubmitting
                ? "저장 중..."
                : currentStep === totalSteps
                  ? "맞춤 공고 보러가기"
                  : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
