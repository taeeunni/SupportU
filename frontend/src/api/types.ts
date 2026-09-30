// Auth
export interface AuthUser {
  message: string;
  name: string;
  email: string;
  attributes: Record<string, unknown>;
}

// Profile
export interface ProfileRequest {
  age: number;
  gender: string;
  city: string;
  scity: string;
  education: string;
  employment: string;
  disability: boolean;
  incomeInteger: number;
  asset: string;
  preferredCategories: string[];
}

export interface ProfileResponse {
  uid: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  scity: string | null;
  education: string | null;
  employment: string | null;
  disability: boolean | null;
  incomeInteger: number | null;
  asset: string | null;
  preferredCategories: string[] | null;
  createdAt?: string;
}

// Policy eligibility check item (정책 적합도 항목)
export interface EligibilityItem {
  label: string;
  value: string;
}

// Policy (전체 목록 / 북마크 목록 공통)
export interface Policy {
  id: string;
  title: string;
  category: string;        // 영문 카테고리 (Housing/Jobs/Welfare)
  categoryKr: string;      // 한글 카테고리 (주거/일자리/복지)
  org: string;
  desc: string;
  support: string;
  deadline: string;
  bookmarked: boolean;
  region?: string;
  detailUrl?: string | null;
}

export interface PolicyDetail {
  policyId: string;
  title: string;
  category: string;
  deadlineText: string;
  organization: string;
  supportScale: string;
  description: string;
  benefits: string[];
  detailUrl?: string | null;
  applicationStartDate?: string | null;
  applicationEndDate?: string | null;
  eligibility: EligibilityItem[];
}

// 북마크 추가/삭제 응답
export interface BookmarkResponse {
  policyId: string;
  bookmarked: boolean;
}

export interface PolicyDocument {
  id: number | null;
  name: string | null;
  required: boolean | null;
  description: string | null;
  url: string | null;
}

export interface ExtractPolicyDocumentsResponse {
  policyId: string;
  documentCount: number;
  documents: PolicyDocument[];
}

// Checklist
export interface ChecklistItem {
  id: number;
  policyId?: string;
  policyName?: string;
  documentName?: string;
  label: string;
  deadline: string;
  deadlineText?: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
  deadlineColor: string;
  deadlineBg: string;
  checked?: boolean;
  done: boolean;
}
