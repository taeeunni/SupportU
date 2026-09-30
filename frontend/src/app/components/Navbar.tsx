import imgUserAvatar from "figma:asset/d53360f080d65508be933ce1738e47c95909ed9e.png";
import { useRecommendedPolicies } from "../../api/queries/usePolicyQueries";

type Page = "home" | "policies" | "mypage" ;

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const { data: recommendedPolicies } = useRecommendedPolicies();
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b"
      style={{ backgroundColor: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.2)" }}
    >
      <div className="max-w-[1280px] mx-auto h-16 flex items-center justify-between px-8">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("home")}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#4fd1c5" }}>
            <svg width="17" height="16" viewBox="0 0 17 16" fill="none">
              <path d="M8.5 1L15 4.5V11.5L8.5 15L2 11.5V4.5L8.5 1Z" fill="white" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: "#171d1c", fontFamily: "Pretendard, sans-serif" }}>
            SupportU
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex items-center gap-8">
          {[
            { id: "home" as Page, label: "홈" },
            { id: "policies" as Page, label: "공고", badge: recommendedPolicies?.length ? `${recommendedPolicies.length}건` : undefined },
            { id: "mypage" as Page, label: "마이페이지" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex items-center gap-2 text-base transition-colors"
              style={{
                fontFamily: "Pretendard, sans-serif",
                fontWeight: currentPage === item.id ? 600 : 500,
                color: currentPage === item.id ? "#006a63" : "#64748b",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              {item.label}
              {item.badge && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "#79f7ea", color: "#006a63", fontFamily: "Pretendard, sans-serif" }}
                >
                  {item.badge}
                </span>
              )}
              {currentPage === item.id && (
                <span
                  className="absolute bottom-[-21px] left-0 right-0 h-0.5 rounded-t-full"
                  style={{ backgroundColor: "#006a63" }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-5">
          <button className="relative p-1" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path d="M8 0C7.172 0 6.5 0.672 6.5 1.5V2.07C3.916 2.554 2 4.827 2 7.5V13L0 15V16H16V15L14 13V7.5C14 4.827 12.084 2.554 9.5 2.07V1.5C9.5 0.672 8.828 0 8 0ZM8 20C9.105 20 10 19.105 10 18H6C6 19.105 6.895 20 8 20Z" fill="#64748B" />
            </svg>
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ backgroundColor: "#ba1a1a" }} />
          </button>
          <div className="w-10 h-10 rounded-full border-2 overflow-hidden" style={{ borderColor: "#4fd1c5" }}>
            <img src={imgUserAvatar} alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>
  );
}
