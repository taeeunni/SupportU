import { createBrowserRouter, Navigate, Outlet, useNavigate, useParams } from 'react-router';
import { useAuthUser } from '../api/queries/useAuthQueries';
import { useProfile } from '../api/queries/useProfileQueries';
import type { ProfileResponse } from '../api/types';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { PolicyListPage } from './components/PolicyListPage';
import { MyPage } from './components/MyPage';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { Spinner } from './components/common/Spinner';
import { P } from './components/common/Typography';

function isProfileComplete(profile: ProfileResponse | null | undefined) {
  return (
      !!profile &&
      profile.age !== null &&
      profile.gender !== null &&
      profile.city !== null &&
      profile.scity !== null &&
      profile.education !== null &&
      profile.employment !== null &&
      profile.disability !== null &&
      profile.incomeInteger !== null &&
      profile.asset !== null &&
      profile.preferredCategories !== null &&
      profile.preferredCategories.length > 0
  );
}

/**
 * 인증된 사용자만 접근 가능한 라우트 가드.
 * 로딩 중에는 spinner, 비로그인 시 /login으로 리다이렉트.
 * 로그인은 됐지만 프로필이 미완성인 경우 /signup으로 보낸다.
 */
function ProtectedLayout() {
  const { data: user, isLoading: isAuthLoading } = useAuthUser();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const navigate = useNavigate();

  if (isAuthLoading) return <Spinner fullScreen label="로딩 중..." />;
  if (!user) return <Navigate to="/login" replace />;

  if (isProfileLoading) return <Spinner fullScreen label="프로필 확인 중..." />;
  if (!isProfileComplete(profile)) return <Navigate to="/signup" replace />;

  const handleNavigate = (page: string, id?: string) => {
    if (page === 'policy-detail' && id) navigate(`/policies?detail=${encodeURIComponent(id)}`);
    else if (page === 'policies') navigate('/policies');
    else if (page === 'home') navigate('/');
    else if (page === 'mypage') navigate('/mypage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
      <div style={{ fontFamily: 'Pretendard, sans-serif' }}>
        <Navbar
            currentPage={getCurrentPage()}
            onNavigate={(p) => handleNavigate(p)}
        />
        <Outlet context={{ onNavigate: handleNavigate }} />
      </div>
  );
}

function getCurrentPage(): 'home' | 'policies' | 'mypage'  {
  const path = window.location.pathname;
  if (path.startsWith('/policies')) return 'policies';
  if (path.startsWith('/mypage')) return 'mypage';
  return 'home';
}

/**
 * 이미 로그인된 사용자는 /login 접근 시 홈으로 보낸다.
 */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuthUser();
  if (isLoading) return <Spinner fullScreen label="로딩 중..." />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Outlet context를 페이지 컴포넌트에서 쓰기 쉽게 래퍼 생성
function HomeRoute() {
  const navigate = useNavigate();
  const handleNavigate = (page: string, id?: string) => {
    if (page === 'policy-detail' && id) navigate(`/policies?detail=${encodeURIComponent(id)}`);
    else navigate(page === 'home' ? '/' : `/${page}`);
  };
  return <HomePage onNavigate={handleNavigate} />;
}

function PoliciesRoute() {
  const navigate = useNavigate();
  const handleNavigate = (page: string, id?: string) => {
    if (page === 'policy-detail' && id) navigate(`/policies?detail=${encodeURIComponent(id)}`);
    else navigate(page === 'home' ? '/' : `/${page}`);
  };
  return <PolicyListPage onNavigate={handleNavigate} />;
}

function PolicyDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/policies?detail=${encodeURIComponent(id ?? '')}`} replace />;
}

function MyPageRoute() {
  const navigate = useNavigate();
  const handleNavigate = (page: string, id?: string) => {
    if (page === 'policy-detail' && id) navigate(`/policies?detail=${encodeURIComponent(id)}`);
    else navigate(page === 'home' ? '/' : `/${page}`);
  };
  return <MyPage onNavigate={handleNavigate} />;
}


function LoginRoute() {
  return (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
  );
}

function SignupRoute() {
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useAuthUser();
  const { data: profile, isLoading: isProfileLoading } = useProfile();

  if (isAuthLoading) return <Spinner fullScreen label="로딩 중..." />;
  if (!user) return <Navigate to="/login" replace />;

  if (isProfileLoading) return <Spinner fullScreen label="프로필 확인 중..." />;
  if (isProfileComplete(profile)) return <Navigate to="/" replace />;

  return (
      <SignupPage
          onComplete={() => navigate('/', { replace: true })}
          onCancel={() => navigate('/login')}
      />
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/signup', element: <SignupRoute /> },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'policies', element: <PoliciesRoute /> },
      { path: 'policies/:id', element: <PolicyDetailRoute /> },
      { path: 'mypage', element: <MyPageRoute /> },
    ],
  },
]);
