import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { initiateGoogleLogin } from "../../api/auth";
import { P } from "./common/Typography";

export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const loginError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("message");
  const oauthErrorMessage = useMemo(() => {
    if (!loginError) return null;
    if (loginError === "access_denied") return "구글 로그인이 취소되었습니다.";
    return errorDescription ?? "구글 로그인에 실패했습니다. 다시 시도해주세요.";
  }, [errorDescription, loginError]);

  const handleGoogleLogin = () => {
    if (loginError) {
      setSearchParams({}, { replace: true });
    }
    // Spring Boot OAuth2 엔드포인트로 리다이렉트 (Vite proxy → localhost:8080)
    initiateGoogleLogin();
  };

  const badges = [
    { label: "복지", color: "#9333ea", bg: "#faf5ff" },
    { label: "일자리", color: "#16a34a", bg: "#f0fdf4" },
    { label: "주거", color: "#2563eb", bg: "#eff6ff" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - 55% */}
      <div
        className="flex flex-col justify-between p-16"
        style={{
          width: "55%",
          background: "linear-gradient(135deg, #006a63 0%, #00897b 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          {/* Service Logo */}
          <div className="mb-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L20 12L28 14L22 20L24 28L16 24L8 28L10 20L4 14L12 12L16 4Z" fill="white" />
              </svg>
            </div>
            <P style={{ fontSize: 32, fontWeight: 700, color: "white", lineHeight: 1.3, marginBottom: 16 }}>
              내게 맞는 청년 정책,<br />한눈에 찾아보세요
            </P>
            <P style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
              AI 기반 맞춤 추천으로 놓치는 지원 없이,<br />
              나에게 꼭 필요한 정책을 확인하세요.
            </P>
          </div>

          {/* Illustration Area */}
          <div className="mb-12 relative">
            <div
              className="rounded-3xl p-12 flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.2)",
                minHeight: 320,
              }}
            >
              {/* Simple illustration using SVG shapes */}
              <div className="relative w-full max-w-md">
                {/* Buildings */}
                <svg width="100%" viewBox="0 0 400 250" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Background buildings */}
                  <rect x="20" y="80" width="80" height="170" rx="4" fill="rgba(255,255,255,0.15)" />
                  <rect x="30" y="100" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="55" y="100" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="30" y="130" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="55" y="130" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="30" y="160" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="55" y="160" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />

                  <rect x="300" y="60" width="80" height="190" rx="4" fill="rgba(255,255,255,0.15)" />
                  <rect x="310" y="80" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="335" y="80" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="310" y="110" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="335" y="110" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="310" y="140" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />
                  <rect x="335" y="140" width="15" height="15" rx="2" fill="rgba(255,255,255,0.3)" />

                  {/* Center person with document */}
                  <circle cx="200" cy="120" r="30" fill="rgba(255,255,255,0.9)" />
                  <circle cx="200" cy="115" r="12" fill="#006a63" />
                  <path d="M170 145C170 135 180 128 200 128C220 128 230 135 230 145V165H170V145Z" fill="#006a63" />

                  {/* Document */}
                  <rect x="150" y="180" width="100" height="60" rx="6" fill="white" />
                  <rect x="165" y="195" width="70" height="6" rx="3" fill="#006a63" opacity="0.3" />
                  <rect x="165" y="210" width="50" height="6" rx="3" fill="#006a63" opacity="0.2" />
                  <rect x="165" y="225" width="60" height="6" rx="3" fill="#006a63" opacity="0.2" />

                  {/* Checkmark */}
                  <circle cx="260" cy="190" r="20" fill="#4fd1c5" />
                  <path d="M252 190L258 196L268 184" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Badges */}
        <div className="relative z-10 flex items-center gap-4">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className="flex-1 px-4 py-3 rounded-xl text-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <P style={{ fontSize: 14, fontWeight: 700, color: "#006a63" }}>{badge.label}</P>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - 45% */}
      <div className="flex flex-col justify-center px-20" style={{ width: "45%", backgroundColor: "#ffffff" }}>
        <div className="w-full max-w-md mx-auto">
          {/* Logo & Title */}
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "#006a63" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3.5L17.5 10.5L24.5 12.25L19.25 17.5L21 24.5L14 21L7 24.5L8.75 17.5L3.5 12.25L10.5 10.5L14 3.5Z" fill="white" />
              </svg>
            </div>
            <P style={{ fontSize: 28, fontWeight: 700, color: "#171d1c", marginBottom: 8 }}>청년정책 플랫폼</P>
            <P style={{ fontSize: 15, color: "#64748b" }}>정책을 더 쉽고 빠르게</P>
          </div>

          {/* Social Login */}
          <div className="flex flex-col gap-4">
            <P style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 8 }}>
              소셜 계정으로 간편하게 시작하세요
            </P>

            {oauthErrorMessage && (
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                role="alert"
                aria-live="polite"
                style={{
                  backgroundColor: "rgba(186,26,26,0.08)",
                  border: "1px solid rgba(186,26,26,0.18)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
                  <circle cx="9" cy="9" r="8" stroke="#ba1a1a" strokeWidth="1.5" />
                  <path d="M9 5V9.5M9 12.5V13" stroke="#ba1a1a" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div className="flex-1">
                  <P style={{ fontSize: 14, fontWeight: 700, color: "#ba1a1a", marginBottom: 4 }}>
                    로그인을 완료하지 못했어요
                  </P>
                  <P style={{ fontSize: 13, color: "#3c4947", lineHeight: 1.5 }}>
                    {oauthErrorMessage}
                  </P>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchParams({}, { replace: true })}
                  aria-label="로그인 오류 메시지 닫기"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-4 rounded-xl text-base font-semibold transition-all hover:shadow-lg active:scale-98 flex items-center justify-center gap-3"
              style={{
                backgroundColor: "#006a63",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontFamily: "Pretendard, sans-serif",
                boxShadow: "0 4px 12px rgba(0,106,99,0.25)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="white" opacity="0.9"/>
                <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0 0 10 20z" fill="white" opacity="0.9"/>
                <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 0 0 0 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="white" opacity="0.9"/>
                <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="white" opacity="0.9"/>
              </svg>
              구글로 로그인
            </button>

            {/* Google Signup Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-4 rounded-xl text-base font-semibold transition-all hover:shadow-lg active:scale-98 flex items-center justify-center gap-3"
              style={{
                backgroundColor: "white",
                color: "#3c4947",
                border: "1.5px solid #e9efed",
                cursor: "pointer",
                fontFamily: "Pretendard, sans-serif",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
                <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0 0 10 20z" fill="#34A853"/>
                <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 0 0 0 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC04"/>
                <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
              </svg>
              구글로 회원가입
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px" style={{ backgroundColor: "#e9efed" }} />
            <P style={{ fontSize: 13, color: "#94a3b8" }}>간편 시작</P>
            <div className="flex-1 h-px" style={{ backgroundColor: "#e9efed" }} />
          </div>

          {/* Info Box */}
          <div
            className="p-5 rounded-xl"
            style={{
              backgroundColor: "rgba(0,106,99,0.05)",
              border: "1px solid rgba(0,106,99,0.15)",
            }}
          >
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mt-0.5">
                <circle cx="10" cy="10" r="9" stroke="#006a63" strokeWidth="1.5" />
                <path d="M10 6V10.5M10 13V13.5" stroke="#006a63" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div>
                <P style={{ fontSize: 14, fontWeight: 600, color: "#006a63", marginBottom: 6 }}>
                  구글 계정으로 간편하게 시작하세요
                </P>
                <P style={{ fontSize: 13, color: "#3c4947", lineHeight: 1.6 }}>
                  회원가입 시 프로필 정보를 입력하면 AI가 맞춤 정책을 추천해드립니다.
                </P>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
