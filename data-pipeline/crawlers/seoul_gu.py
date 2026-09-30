import os
import re
import calendar
import hashlib
import pandas as pd
from bs4 import BeautifulSoup

from crawlers.base import fetch_html, html_to_text


SOURCE_SITE = "youth.seoul.go.kr"
SOURCE_NAME = "서울 청년포털_자치구정책"

OUTPUT_ACTIVE_PATH = "output/raw/seoul_gu_active_raw.csv"
OUTPUT_NEED_CHECK_PATH = "output/raw/seoul_gu_need_check_raw.csv"
OUTPUT_CLOSED_PATH = "output/raw/seoul_gu_closed_raw.csv"
OUTPUT_OLLAMA_INPUT_PATH = "output/raw/seoul_gu_raw_all.csv"

MAX_PAGES = 50
STOP_AFTER_EMPTY_POLICY_PAGES = 3

CURRENT_YEAR = pd.Timestamp.today().year

DISTRICTS = [
    "종로구",
    "중구",
    "용산구",
    "성동구",
    "광진구",
    "동대문구",
    "중랑구",
    "성북구",
    "강북구",
    "도봉구",
    "노원구",
    "은평구",
    "서대문구",
    "마포구",
    "양천구",
    "강서구",
    "구로구",
    "금천구",
    "영등포구",
    "동작구",
    "관악구",
    "서초구",
    "강남구",
    "송파구",
    "강동구",
]

ACTIVE_KEYWORDS = [
    "모집중",
    "신청중",
    "접수중",
    "상시",
    "상시모집",
    "상시 모집",
    "수시",
    "수시모집",
    "수시 모집",
    "연중",
    "연중모집",
    "연중 모집",
    "예산 소진",
    "예산소진",
    "예산 소진 시",
    "예산 소진시",
    "예산 소진 시까지",
    "예산소진시까지",
    "마감 시까지",
    "마감시까지",
    "소진 시까지",
    "소진시까지",
    "운영 중",
    "운영중",
    "계속 운영",
]

OPEN_ENDED_ACTIVE_KEYWORDS = [
    "상시",
    "상시모집",
    "상시 모집",
    "수시",
    "수시모집",
    "수시 모집",
    "연중",
    "연중모집",
    "연중 모집",
    "예산 소진",
    "예산소진",
    "예산 소진 시",
    "예산 소진시",
    "예산 소진 시까지",
    "예산소진시까지",
    "마감 시까지",
    "마감시까지",
    "소진 시까지",
    "소진시까지",
    "운영 중",
    "운영중",
    "계속 운영",
]

CLOSED_KEYWORDS = [
    "접수마감",
    "신청마감",
    "모집마감",
    "마감되었습니다",
    "종료되었습니다",
    "접수 종료",
    "신청 종료",
    "모집 종료",
]


def today():
    return pd.Timestamp.today().normalize()


def make_list_url(page: int) -> str:
    return (
        "https://youth.seoul.go.kr/infoData/plcyInfo/guList.do"
        f"?sprtInfoId="
        f"&plcyBizId=V202600006"
        f"&key=2309150002"
        f"&sc_detailAt="
        f"&pageIndex={page}"
        f"&orderBy=regYmd+desc"
        f"&blueWorksYn=N"
        f"&tabKind=003"
        f"&sw="
    )


def make_detail_url(policy_id: str) -> str:
    return (
        "https://youth.seoul.go.kr/infoData/plcyInfo/view.do"
        f"?plcyBizId={policy_id}&tabKind=003&key=2309150002"
    )


def normalize_space(text):
    if not isinstance(text, str):
        return ""

    return re.sub(r"\s+", " ", text).strip()


def normalize_date(year, month, day):
    return pd.Timestamp(year=int(year), month=int(month), day=int(day))


def extract_year_from_title(title: str):
    if not isinstance(title, str):
        return None

    match = re.search(r"(20\d{2})", title)

    if not match:
        return None

    return int(match.group(1))


def extract_year_from_policy_id(policy_id: str):
    if not isinstance(policy_id, str):
        return None

    match = re.search(r"(20\d{2})", policy_id)

    if not match:
        return None

    return int(match.group(1))


def parse_date_ranges(text: str):
    ranges = []

    if not isinstance(text, str):
        return ranges

    full_date_pattern = (
        r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"
        r".{0,80}?[~\-]"
        r".{0,80}?(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"
    )

    for match in re.finditer(full_date_pattern, text):
        try:
            start = normalize_date(match.group(1), match.group(2), match.group(3))
            end = normalize_date(match.group(4), match.group(5), match.group(6))
            ranges.append((start, end))
        except Exception:
            pass

    same_year_date_pattern = (
        r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"
        r".{0,80}?[~\-]"
        r".{0,80}?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"
    )

    for match in re.finditer(same_year_date_pattern, text):
        try:
            year = int(match.group(1))
            start = normalize_date(year, match.group(2), match.group(3))
            end = normalize_date(year, match.group(4), match.group(5))
            ranges.append((start, end))
        except Exception:
            pass

    month_pattern = (
        r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]?"
        r"\s*[~\-]\s*"
        r"(\d{1,2})\s*[.\-/월]?"
    )

    for match in re.finditer(month_pattern, text):
        try:
            year = int(match.group(1))
            start_month = int(match.group(2))
            end_month = int(match.group(3))
            last_day = calendar.monthrange(year, end_month)[1]

            start = pd.Timestamp(year=year, month=start_month, day=1)
            end = pd.Timestamp(year=year, month=end_month, day=last_day)
            ranges.append((start, end))
        except Exception:
            pass

    unique_ranges = []
    seen = set()

    for start, end in ranges:
        key = (start.date().isoformat(), end.date().isoformat())
        if key in seen:
            continue
        seen.add(key)
        unique_ranges.append((start, end))

    return unique_ranges


def parse_single_dates(text: str):
    dates = []

    if not isinstance(text, str):
        return dates

    pattern = r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})"

    for match in re.finditer(pattern, text):
        try:
            dates.append(normalize_date(match.group(1), match.group(2), match.group(3)))
        except Exception:
            pass

    unique_dates = []
    seen = set()

    for date in dates:
        key = date.date().isoformat()
        if key in seen:
            continue
        seen.add(key)
        unique_dates.append(date)

    return unique_dates


def get_period_related_text(raw_text: str):
    if not isinstance(raw_text, str):
        return ""

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    keywords = [
        "사업신청기간",
        "신청기간",
        "신청 기간",
        "접수기간",
        "접수 기간",
        "모집기간",
        "모집 기간",
        "사업운영기간",
        "운영기간",
        "운영 기간",
        "지원기간",
        "지원 기간",
    ]

    stop_keywords = [
        "정책 유형",
        "주관 기관",
        "정책 소개",
        "지원 내용",
        "지원규모",
        "관련 사이트",
        "신청자격",
        "신청방법",
        "기타",
    ]

    chunks = []

    for i, line in enumerate(lines):
        if any(keyword in line for keyword in keywords):
            chunk_lines = []

            for next_line in lines[i:i + 12]:
                if chunk_lines and next_line in stop_keywords:
                    break
                chunk_lines.append(next_line)

            chunks.append("\n".join(chunk_lines))

    if chunks:
        return "\n".join(chunks)

    compact_text = " ".join(lines)

    for keyword in keywords:
        if keyword not in compact_text:
            continue

        start = compact_text.find(keyword)
        end = len(compact_text)

        for stop_keyword in stop_keywords:
            stop_pos = compact_text.find(stop_keyword, start + len(keyword))
            if stop_pos != -1:
                end = min(end, stop_pos)

        chunks.append(compact_text[start:end])

    if chunks:
        return "\n".join(chunks)

    return ""


def remove_birth_lines(text: str):
    filtered = []

    for line in text.splitlines():
        if any(keyword in line for keyword in ["출생", "생년월일", "출생자", "생일"]):
            continue
        filtered.append(line)

    return "\n".join(filtered)


def has_open_ended_active_keyword(text: str):
    return any(keyword in text for keyword in OPEN_ENDED_ACTIVE_KEYWORDS)


def has_closed_keyword(text: str):
    return any(keyword in text for keyword in CLOSED_KEYWORDS)


def is_old_year_without_clear_current_signal(title_year, policy_id_year):
    years = [year for year in [title_year, policy_id_year] if year is not None]

    if not years:
        return False

    return max(years) < CURRENT_YEAR


def classify_policy(title: str, raw_text: str, policy_id: str = ""):
    base_date = today()

    period_text = get_period_related_text(raw_text)
    period_text = remove_birth_lines(period_text)

    combined_text = f"{title}\n{raw_text}\n{period_text}"

    title_year = extract_year_from_title(title)
    policy_id_year = extract_year_from_policy_id(policy_id)

    date_ranges = parse_date_ranges(period_text)

    if not date_ranges:
        date_ranges = parse_date_ranges(remove_birth_lines(raw_text))

    if date_ranges:
        active_ranges = []
        future_ranges = []

        for start, end in date_ranges:
            if start <= base_date <= end:
                active_ranges.append((start, end))
            elif start > base_date:
                future_ranges.append((start, end))

        if active_ranges:
            start, end = active_ranges[0]
            return "active", f"date_range_active:{start.date()}~{end.date()}"

        latest_end = max(end for _, end in date_ranges)

        if latest_end < base_date:
            return "closed", f"date_range_expired:{latest_end.date()}"

        if future_ranges:
            start, end = future_ranges[0]
            return "need_check", f"future_date_range:{start.date()}~{end.date()}"

    if has_closed_keyword(period_text):
        return "closed", "period_closed_keyword"

    single_dates = parse_single_dates(period_text)

    if not single_dates:
        single_dates = parse_single_dates(remove_birth_lines(raw_text))

    if single_dates and has_open_ended_active_keyword(period_text):
        latest_date = max(single_dates)

        if latest_date.year >= CURRENT_YEAR - 1:
            return "active", f"open_ended_active:{latest_date.date()}"

        return "need_check", f"old_open_ended_date_need_check:{latest_date.date()}"

    if is_old_year_without_clear_current_signal(title_year, policy_id_year):
        if has_open_ended_active_keyword(period_text):
            return "need_check", f"past_year_but_period_active_keyword:{max(y for y in [title_year, policy_id_year] if y is not None)}"

        return "closed", f"past_year:{max(y for y in [title_year, policy_id_year] if y is not None)}"

    if has_open_ended_active_keyword(period_text):
        return "active", "period_active_keyword"

    if has_closed_keyword(combined_text):
        return "closed", "closed_keyword"

    if title_year == CURRENT_YEAR or policy_id_year == CURRENT_YEAR:
        return "need_check", f"current_year_no_clear_period:{title_year or policy_id_year}"

    if title_year is None and policy_id_year is None:
        return "need_check", "no_year_no_clear_period"

    if (title_year and title_year > CURRENT_YEAR) or (policy_id_year and policy_id_year > CURRENT_YEAR):
        return "need_check", f"future_year:{title_year or policy_id_year}"

    return "need_check", "no_clear_period"


def make_fallback_policy_id(title: str, district: str):
    seed = f"{SOURCE_SITE}|{SOURCE_NAME}|{title}|{district}"
    return "seoul_gu_" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]


def split_title_summary(text: str):
    text = normalize_space(text)

    for district in DISTRICTS:
        marker = f"({district})"
        if marker in text:
            end = text.find(marker) + len(marker)
            return normalize_space(text[:end]), normalize_space(text[end:])

    pattern = (
        r"(.+?(?:사업|모집|교육|지원|운영|아카데미|커뮤니티|프로그램|네트워크|서비스|동아리|상담|공모전|캠프|일자리|재테크|창업)(?:\([^)]+\))?)\s+(.+)"
    )

    match = re.match(pattern, text)

    if match:
        return normalize_space(match.group(1)), normalize_space(match.group(2))

    return text, ""


def find_district(title: str, summary: str):
    combined = f"{title} {summary}"

    for district in DISTRICTS:
        if district in combined:
            return district

    return ""


def is_noise_line(line: str):
    if not line:
        return True

    if line in {
        "검색하기",
        "초기화",
        "전체",
        "서울시",
        "자치구",
        "처음",
        "이전",
        "다음",
        "마지막",
        "공유하기",
        "프린트하기",
        "페이스북 트위터 카카오톡 url 닫기",
    }:
        return True

    if line in ["일자리", "주거", "교육", "복지.문화", "참여.권리"]:
        return True

    if line in ["재직자", "자영업자", "미취업자", "프리랜서", "일용근로자", "(예비)창업자", "단기근로자", "영농종사자", "제한없음"]:
        return True

    if line in ["상시", "모집중", "모집예정", "마감", "19~24", "25~29", "30~34", "35~39"]:
        return True

    if re.fullmatch(r"\d+", line):
        return True

    if re.search(r"정책유형|취업상태|모집현황|연령대|담당기관|서울시 정책|자치구 정책 탭 내용 시작", line):
        return True

    if re.search(r"처음이전|개인정보처리방침|저작권 정책|관련사이트|대표전화|all rights reserved", line, re.IGNORECASE):
        return True

    return False


def extract_fallback_items(html: str, page: int):
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text("\n", strip=True)
    lines = [normalize_space(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    marker_indexes = []

    for idx, line in enumerate(lines):
        if "자치구 정책" in line and ("건" in line or "탭 내용 시작" in line):
            marker_indexes.append(idx)

    if not marker_indexes:
        return []

    start_index = marker_indexes[-1] + 1

    section_lines = []

    for line in lines[start_index:]:
        if re.search(r"처음이전|개인정보처리방침|저작권 정책|관련사이트|대표전화|all rights reserved", line, re.IGNORECASE):
            break
        section_lines.append(line)

    items = []
    pending_item = None

    for line in section_lines:
        if is_noise_line(line):
            continue

        if line in DISTRICTS:
            if pending_item and not pending_item["district"]:
                pending_item["district"] = line
                pending_item["policy_id"] = make_fallback_policy_id(pending_item["title"], line)
                pending_item["detail_url"] = make_list_url(page)
                pending_item["raw_text"] = f"{pending_item['title']}\n{pending_item['summary']}\n{line}"
            continue

        if len(line) < 6:
            continue

        title, summary = split_title_summary(line)
        district = find_district(title, summary)
        policy_id = make_fallback_policy_id(title, district)

        item = {
            "title": title,
            "summary": summary,
            "district": district,
            "policy_id": policy_id,
            "detail_url": make_list_url(page),
            "list_page": page,
            "raw_text": f"{title}\n{summary}\n{district}",
            "fallback_only": True,
        }

        items.append(item)
        pending_item = item

    return items


def collect_policy_items(max_pages: int = MAX_PAGES):
    results = []
    seen_ids = set()
    empty_policy_pages = 0

    for page in range(1, max_pages + 1):
        print(f"[서울자치구] 목록 페이지 확인 중: {page}")

        html = fetch_html(make_list_url(page))
        soup = BeautifulSoup(html, "lxml")

        page_items = []

        for a in soup.select("a"):
            title = a.get_text(" ", strip=True)
            onclick = a.get("onclick")

            if not title or not onclick:
                continue

            match = re.search(r"goView\('([^']+)'\)", onclick)

            if not match:
                continue

            policy_id = match.group(1)

            if policy_id in seen_ids:
                continue

            seen_ids.add(policy_id)

            page_items.append({
                "title": title,
                "policy_id": policy_id,
                "detail_url": make_detail_url(policy_id),
                "list_page": page,
                "fallback_only": False,
            })

        if not page_items:
            fallback_items = extract_fallback_items(html, page)

            for item in fallback_items:
                if item["policy_id"] in seen_ids:
                    continue

                seen_ids.add(item["policy_id"])
                page_items.append(item)

        print(f"[서울자치구] {page}페이지 목록 정책 수:", len(page_items))

        if len(page_items) == 0:
            empty_policy_pages += 1
            print("[서울자치구] 연속 빈 목록 페이지:", empty_policy_pages)
        else:
            empty_policy_pages = 0

        if empty_policy_pages >= STOP_AFTER_EMPTY_POLICY_PAGES:
            print("[서울자치구] 빈 목록 페이지가 반복되어 목록 수집 종료")
            break

        results.extend(page_items)

    print("[서울자치구] 목록 전체 정책 수:", len(results))
    return results


def fetch_policy_detail(item: dict):
    if item.get("fallback_only"):
        raw_text = item.get("raw_text", "")
        status, reason = classify_policy(item["title"], raw_text, item["policy_id"])

        return {
            "source_site": SOURCE_SITE,
            "source_name": SOURCE_NAME,
            "policy_id": item["policy_id"],
            "title": item["title"],
            "detail_url": item["detail_url"],
            "list_page": item["list_page"],
            "crawl_status": status,
            "crawl_reason": f"fallback_list_text:{reason}",
            "raw_text": raw_text,
        }

    html = fetch_html(item["detail_url"])
    raw_text = html_to_text(html)

    status, reason = classify_policy(item["title"], raw_text, item["policy_id"])

    return {
        "source_site": SOURCE_SITE,
        "source_name": SOURCE_NAME,
        "policy_id": item["policy_id"],
        "title": item["title"],
        "detail_url": item["detail_url"],
        "list_page": item["list_page"],
        "crawl_status": status,
        "crawl_reason": reason,
        "raw_text": raw_text,
    }


def crawl_seoul_gu():
    items = collect_policy_items()

    active_rows = []
    need_check_rows = []
    closed_rows = []

    for idx, item in enumerate(items, start=1):
        try:
            row = fetch_policy_detail(item)

            if row["crawl_status"] == "active":
                active_rows.append(row)
                print(f"[서울자치구] ACTIVE 저장 {len(active_rows)}개째:", row["title"], "/", row["crawl_reason"])

            elif row["crawl_status"] == "need_check":
                need_check_rows.append(row)
                print(f"[서울자치구] NEED_CHECK 저장 {len(need_check_rows)}개째:", row["title"], "/", row["crawl_reason"])

            else:
                closed_rows.append(row)
                print(f"[서울자치구] CLOSED 제외:", row["title"], "/", row["crawl_reason"])

        except Exception as e:
            need_check_rows.append({
                "source_site": SOURCE_SITE,
                "source_name": SOURCE_NAME,
                "policy_id": item["policy_id"],
                "title": item["title"],
                "detail_url": item["detail_url"],
                "list_page": item["list_page"],
                "crawl_status": "need_check",
                "crawl_reason": f"detail_fetch_error:{e}",
                "raw_text": "",
            })
            print("[서울자치구] 상세 확인 실패, NEED_CHECK 처리:", item["title"], e)

    os.makedirs("output/raw", exist_ok=True)

    pd.DataFrame(active_rows).to_csv(
        OUTPUT_ACTIVE_PATH,
        index=False,
        encoding="utf-8-sig"
    )

    pd.DataFrame(need_check_rows).to_csv(
        OUTPUT_NEED_CHECK_PATH,
        index=False,
        encoding="utf-8-sig"
    )

    pd.DataFrame(closed_rows).to_csv(
        OUTPUT_CLOSED_PATH,
        index=False,
        encoding="utf-8-sig"
    )

    final_rows = active_rows + need_check_rows

    pd.DataFrame(final_rows).to_csv(
        OUTPUT_OLLAMA_INPUT_PATH,
        index=False,
        encoding="utf-8-sig"
    )

    print("[서울자치구] active raw 저장:", OUTPUT_ACTIVE_PATH)
    print("[서울자치구] need_check raw 저장:", OUTPUT_NEED_CHECK_PATH)
    print("[서울자치구] closed raw 저장:", OUTPUT_CLOSED_PATH)
    print("[서울자치구] Ollama 입력용 raw 저장:", OUTPUT_OLLAMA_INPUT_PATH)

    print("[서울자치구] active 수:", len(active_rows))
    print("[서울자치구] need_check 수:", len(need_check_rows))
    print("[서울자치구] closed 수:", len(closed_rows))
    print("[서울자치구] Ollama 추출 대상 수:", len(final_rows))


if __name__ == "__main__":
    crawl_seoul_gu()