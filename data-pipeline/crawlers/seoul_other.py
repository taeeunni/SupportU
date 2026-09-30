import os
import re
import calendar
import pandas as pd
from bs4 import BeautifulSoup

from crawlers.base import fetch_html, html_to_text


SOURCE_SITE = "youth.seoul.go.kr"
SOURCE_NAME = "서울 청년포털_경기도정책"

OUTPUT_ACTIVE_PATH = "output/raw/seoul_other_gyeonggi_active_raw.csv"
OUTPUT_NEED_CHECK_PATH = "output/raw/seoul_other_gyeonggi_need_check_raw.csv"
OUTPUT_CLOSED_PATH = "output/raw/seoul_other_gyeonggi_closed_raw.csv"
OUTPUT_OLLAMA_INPUT_PATH = "output/raw/seoul_other_gyeonggi_raw_all.csv"

MAX_PAGES = 50
STOP_AFTER_EMPTY_POLICY_PAGES = 3

CURRENT_YEAR = pd.Timestamp.today().year

GYEONGGI_INST_CODE = "003002008"


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

DEADLINE_KEYWORDS = [
    "까지",
    "마감",
    "종료",
    "접수마감",
    "신청마감",
    "모집마감",
    "접수 종료",
    "신청 종료",
    "모집 종료",
]


def today():
    return pd.Timestamp.today().normalize()


def make_list_url(page: int) -> str:
    """
    서울 청년포털 > 중앙정부/타지역 정책 > 경기도 정책 목록.
    sc_plcyBizInstCd=003002008 이 경기도 필터.
    """
    return (
        "https://youth.seoul.go.kr/infoData/youthPlcyInfo/list2.do"
        f"?plcyBizId="
        f"&key=2309160001"
        f"&sc_detailAt="
        f"&pageIndex={page}"
        f"&orderBy=regYmd+desc"
        f"&blueWorksYn=N"
        f"&tabKind=003"
        f"&sw="
        f"&sc_plcyBizInstCd={GYEONGGI_INST_CODE}"
    )


def make_detail_url(policy_id: str) -> str:
    return (
        "https://youth.seoul.go.kr/infoData/youthPlcyInfo/view.do"
        f"?plcyBizId={policy_id}&tabKind=003&key=2309160001"
    )


def normalize_date(year, month, day):
    return pd.Timestamp(year=int(year), month=int(month), day=int(day))


def normalize_month_end(year, month):
    year = int(year)
    month = int(month)
    last_day = calendar.monthrange(year, month)[1]
    return pd.Timestamp(year=year, month=month, day=last_day)


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


def parse_month_end_dates(text: str):
    dates = []

    if not isinstance(text, str):
        return dates

    full_date_spans = []

    for match in re.finditer(r"\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}", text):
        full_date_spans.append((match.start(), match.end()))

    pattern = r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*(?:월|[.\-/])"

    for match in re.finditer(pattern, text):
        start_pos = match.start()
        end_pos = match.end()

        if any(
            span_start <= start_pos < span_end or span_start < end_pos <= span_end
            for span_start, span_end in full_date_spans
        ):
            continue

        try:
            dates.append(normalize_month_end(match.group(1), match.group(2)))
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


def parse_explicit_deadline_dates(text: str):
    if not isinstance(text, str):
        return []

    dates = []

    sentences = re.split(r"[\n\r。.!?]|(?<=다)\s+", text)

    for sentence in sentences:
        sentence = sentence.strip()

        if not sentence:
            continue

        if not any(keyword in sentence for keyword in DEADLINE_KEYWORDS):
            continue

        dates.extend(parse_single_dates(sentence))
        dates.extend(parse_month_end_dates(sentence))

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


def has_active_keyword(text: str):
    return any(keyword in text for keyword in ACTIVE_KEYWORDS)


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
    """
    반환값:
    - active: 현재 진행 중으로 판단
    - need_check: 날짜가 없거나 애매하지만 버리기 어려운 정책
    - closed: 명확히 종료/마감된 정책
    """
    base_date = today()

    period_text = get_period_related_text(raw_text)
    period_text = remove_birth_lines(period_text)
    raw_text_without_birth = remove_birth_lines(raw_text)

    combined_text = f"{title}\n{raw_text}\n{period_text}"

    title_year = extract_year_from_title(title)
    policy_id_year = extract_year_from_policy_id(policy_id)

    date_ranges = parse_date_ranges(period_text)

    if not date_ranges:
        date_ranges = parse_date_ranges(raw_text_without_birth)

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

    deadline_dates = parse_explicit_deadline_dates(period_text)

    if not deadline_dates:
        deadline_dates = parse_explicit_deadline_dates(raw_text_without_birth)

    if deadline_dates:
        latest_deadline = max(deadline_dates)

        if latest_deadline < base_date:
            return "closed", f"explicit_deadline_expired:{latest_deadline.date()}"

        if has_open_ended_active_keyword(period_text) or has_open_ended_active_keyword(combined_text):
            return "active", f"explicit_deadline_active:{latest_deadline.date()}"

        return "need_check", f"explicit_deadline_future:{latest_deadline.date()}"

    if has_closed_keyword(period_text):
        return "closed", "period_closed_keyword"

    single_dates = parse_single_dates(period_text)

    if not single_dates:
        single_dates = parse_single_dates(raw_text_without_birth)

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


def collect_policy_items(max_pages: int = MAX_PAGES):
    results = []
    seen_ids = set()
    empty_policy_pages = 0

    for page in range(1, max_pages + 1):
        print(f"[서울기반-경기도] 목록 페이지 확인 중: {page}")

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
            })

        print(f"[서울기반-경기도] {page}페이지 목록 정책 수:", len(page_items))

        if len(page_items) == 0:
            empty_policy_pages += 1
            print("[서울기반-경기도] 연속 빈 목록 페이지:", empty_policy_pages)
        else:
            empty_policy_pages = 0

        if empty_policy_pages >= STOP_AFTER_EMPTY_POLICY_PAGES:
            print("[서울기반-경기도] 빈 목록 페이지가 반복되어 목록 수집 종료")
            break

        results.extend(page_items)

    print("[서울기반-경기도] 목록 전체 정책 수:", len(results))
    return results


def fetch_policy_detail(item: dict):
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


def crawl_seoul_other_gyeonggi():
    items = collect_policy_items()

    active_rows = []
    need_check_rows = []
    closed_rows = []

    for idx, item in enumerate(items, start=1):
        try:
            row = fetch_policy_detail(item)

            if row["crawl_status"] == "active":
                active_rows.append(row)
                print(
                    f"[서울기반-경기도] ACTIVE 저장 {len(active_rows)}개째:",
                    row["title"],
                    "/",
                    row["crawl_reason"]
                )

            elif row["crawl_status"] == "need_check":
                need_check_rows.append(row)
                print(
                    f"[서울기반-경기도] NEED_CHECK 저장 {len(need_check_rows)}개째:",
                    row["title"],
                    "/",
                    row["crawl_reason"]
                )

            else:
                closed_rows.append(row)
                print(
                    f"[서울기반-경기도] CLOSED 제외:",
                    row["title"],
                    "/",
                    row["crawl_reason"]
                )

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
            print("[서울기반-경기도] 상세 확인 실패, NEED_CHECK 처리:", item["title"], e)

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

    print("[서울기반-경기도] active raw 저장:", OUTPUT_ACTIVE_PATH)
    print("[서울기반-경기도] need_check raw 저장:", OUTPUT_NEED_CHECK_PATH)
    print("[서울기반-경기도] closed raw 저장:", OUTPUT_CLOSED_PATH)
    print("[서울기반-경기도] Ollama 입력용 raw 저장:", OUTPUT_OLLAMA_INPUT_PATH)

    print("[서울기반-경기도] active 수:", len(active_rows))
    print("[서울기반-경기도] need_check 수:", len(need_check_rows))
    print("[서울기반-경기도] closed 수:", len(closed_rows))
    print("[서울기반-경기도] Ollama 추출 대상 수:", len(final_rows))


if __name__ == "__main__":
    crawl_seoul_other_gyeonggi()