import re
import time
import calendar
import pandas as pd

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


BASE_URL = "https://www.youthcenter.go.kr"
LIST_URL = "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch"

CURRENT_YEAR = pd.Timestamp.today().year

ACTIVE_KEYWORDS = [
    "진행",
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
    "마감",
    "종료",
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


def make_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1400,1200")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")

    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(5)

    return driver


def wait_and_scroll(driver):
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )

    time.sleep(3)

    last_height = 0

    for _ in range(8):
        driver.execute_script("window.scrollBy(0, 900);")
        time.sleep(1)

        current_height = driver.execute_script("return document.body.scrollHeight")

        if current_height == last_height:
            break

        last_height = current_height


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


def remove_birth_lines(text: str):
    filtered = []

    for line in str(text).splitlines():
        if any(keyword in line for keyword in ["출생", "생년월일", "출생자", "생일"]):
            continue
        filtered.append(line)

    return "\n".join(filtered)


def get_period_related_text(raw_text: str):
    if not isinstance(raw_text, str):
        return ""

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    keywords = [
        "사업 신청기간",
        "사업신청기간",
        "신청기간",
        "신청 기간",
        "접수기간",
        "접수 기간",
        "모집기간",
        "모집 기간",
        "사업 운영 기간",
        "사업운영기간",
        "사업기간",
        "사업 기간",
        "운영기간",
        "운영 기간",
        "지원기간",
        "지원 기간",
    ]

    stop_keywords = [
        "정책번호",
        "정책분야",
        "지원내용",
        "신청자격",
        "연령",
        "거주지역",
        "소득",
        "학력",
        "전공",
        "취업상태",
        "신청방법",
        "제출서류",
        "기타",
        "참고사이트",
        "주관기관",
        "운영기관",
    ]

    chunks = []

    for i, line in enumerate(lines):
        if any(keyword in line for keyword in keywords):
            chunk_lines = []

            for next_line in lines[i:i + 14]:
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


def has_open_ended_active_keyword(text: str):
    return any(keyword in str(text) for keyword in OPEN_ENDED_ACTIVE_KEYWORDS)


def has_closed_keyword(text: str):
    return any(keyword in str(text) for keyword in CLOSED_KEYWORDS)


def classify_policy(title: str, raw_text: str):
    base_date = today()

    period_text = get_period_related_text(raw_text)
    period_text = remove_birth_lines(period_text)
    raw_text_without_birth = remove_birth_lines(raw_text)

    combined_text = f"{title}\n{raw_text}\n{period_text}"

    title_year = extract_year_from_title(title)

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

    if title_year is not None and title_year < CURRENT_YEAR:
        if has_open_ended_active_keyword(period_text):
            return "need_check", f"past_title_year_but_period_active_keyword:{title_year}"

        return "closed", f"past_title_year:{title_year}"

    if has_open_ended_active_keyword(period_text):
        return "active", "period_active_keyword"

    if has_closed_keyword(combined_text):
        return "closed", "closed_keyword"

    if title_year == CURRENT_YEAR:
        return "need_check", f"current_title_year_no_clear_period:{title_year}"

    if title_year is None:
        return "need_check", "no_year_no_clear_period"

    if title_year > CURRENT_YEAR:
        return "need_check", f"future_title_year:{title_year}"

    return "need_check", "no_clear_period"


def print_policy_list_text(driver):
    soup = BeautifulSoup(driver.page_source, "lxml")
    body_text = soup.get_text("\n", strip=True)

    lines = body_text.splitlines()

    print("\n[정책 목록 주변 텍스트]")

    printed = False

    for i, line in enumerate(lines):
        if "정책비교" in line and i + 10 < len(lines):
            start = max(0, i)
            end = min(len(lines), i + 100)

            for j in range(start, end):
                print(f"{j}: {lines[j]}")

            printed = True
            break

    if not printed:
        for j, line in enumerate(lines[:160]):
            print(f"{j}: {line}")


def inspect_detail_buttons(driver):
    print("\n[자세히보기 요소 검사]")

    candidates = []

    xpaths = [
        "//*[contains(text(), '자세히보기')]",
        "//*[contains(text(), '상세보기')]",
        "//*[contains(text(), '자세히 보기')]",
        "//a[contains(@href, 'youthPolicy')]",
        "//button[contains(@onclick, 'policy')]",
    ]

    seen = set()

    for xpath in xpaths:
        elements = driver.find_elements(By.XPATH, xpath)

        for element in elements:
            element_id = element.id

            if element_id in seen:
                continue

            seen.add(element_id)
            candidates.append(element)

    print("후보 요소 수:", len(candidates))

    for idx, element in enumerate(candidates[:20], start=1):
        try:
            text = element.text.strip()
            tag = element.tag_name
            href = element.get_attribute("href")
            onclick = element.get_attribute("onclick")
            outer_html = element.get_attribute("outerHTML")

            print(f"\n[{idx}]")
            print("TAG:", tag)
            print("TEXT:", text)
            print("HREF:", href)
            print("ONCLICK:", onclick)
            print("OUTER_HTML:", outer_html[:700])

        except Exception as e:
            print("검사 실패:", e)

    return candidates


def find_clickable_detail_elements(driver):
    xpaths = [
        "//*[contains(text(), '자세히보기')]",
        "//*[contains(text(), '상세보기')]",
        "//*[contains(text(), '자세히 보기')]",
    ]

    candidates = []
    seen = set()

    for xpath in xpaths:
        for element in driver.find_elements(By.XPATH, xpath):
            element_id = element.id

            if element_id in seen:
                continue

            seen.add(element_id)
            candidates.append(element)

    return candidates


def extract_title_from_detail_text(detail_text: str):
    lines = [line.strip() for line in str(detail_text).splitlines() if line.strip()]

    skip_keywords = [
        "청년정책",
        "통합검색",
        "정책비교",
        "공유하기",
        "인쇄하기",
        "목록",
        "한 눈에 보는 정책 요약",
    ]

    for idx, line in enumerate(lines):
        if "한 눈에 보는 정책 요약" in line:
            for prev_line in reversed(lines[max(0, idx - 12):idx]):
                if prev_line in skip_keywords:
                    continue
                if len(prev_line) < 3:
                    continue
                return prev_line

    for line in lines[:80]:
        if line in skip_keywords:
            continue
        if any(keyword in line for keyword in ["정책번호", "정책분야", "지원내용"]):
            continue
        if len(line) >= 4:
            return line

    return ""


def click_first_detail_button(driver):
    elements = find_clickable_detail_elements(driver)

    if not elements:
        print("자세히보기 버튼을 찾지 못함")
        return

    first = elements[0]

    print("\n[첫 번째 자세히보기 클릭]")
    print("클릭 전 URL:", driver.current_url)

    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", first)
    time.sleep(1)

    try:
        first.click()
    except Exception:
        driver.execute_script("arguments[0].click();", first)

    time.sleep(4)

    print("클릭 후 URL:", driver.current_url)

    soup = BeautifulSoup(driver.page_source, "lxml")
    detail_text = soup.get_text("\n", strip=True)

    title = extract_title_from_detail_text(detail_text)
    period_text = get_period_related_text(detail_text)
    status, reason = classify_policy(title, detail_text)

    print("상세 본문 글자 수:", len(detail_text))
    print("추출 제목:", title)
    print("판별 상태:", status)
    print("판별 이유:", reason)

    print("\n[기간 관련 텍스트]")
    print(period_text[:2000] if period_text else "기간 관련 텍스트 없음")

    print("\n[기간 관련 날짜 범위]")
    period_ranges = parse_date_ranges(period_text)
    if period_ranges:
        for start, end in period_ranges:
            print(f"{start.date()} ~ {end.date()}")
    else:
        print("기간 관련 날짜 범위 없음")

    print("\n[기간 관련 명시 마감일]")
    deadline_dates = parse_explicit_deadline_dates(period_text)
    if deadline_dates:
        for deadline in deadline_dates:
            print(deadline.date())
    else:
        print("기간 관련 명시 마감일 없음")

    print("\n[전체 본문 날짜 범위]")
    all_ranges = parse_date_ranges(remove_birth_lines(detail_text))
    if all_ranges:
        for start, end in all_ranges[:20]:
            print(f"{start.date()} ~ {end.date()}")
    else:
        print("전체 본문 날짜 범위 없음")

    print("\n[전체 본문 명시 마감일]")
    all_deadline_dates = parse_explicit_deadline_dates(remove_birth_lines(detail_text))
    if all_deadline_dates:
        for deadline in all_deadline_dates[:20]:
            print(deadline.date())
    else:
        print("전체 본문 명시 마감일 없음")

    keywords = [
        "한 눈에 보는 정책 요약",
        "정책번호",
        "정책분야",
        "지원내용",
        "사업 운영 기간",
        "사업 신청기간",
        "사업 신청 기간",
        "신청자격",
        "연령",
        "거주지역",
        "소득",
        "신청방법",
    ]

    print("\n[원문 내 키워드 포함 여부]")
    for keyword in keywords:
        print(keyword, "=>", keyword in detail_text)

    print("\n[상세 본문 앞부분]")
    print(detail_text[:4000])


def main():
    driver = make_driver()

    try:
        print("접속:", LIST_URL)
        driver.get(LIST_URL)

        wait_and_scroll(driver)

        print("현재 URL:", driver.current_url)
        print("렌더링 HTML 글자 수:", len(driver.page_source))

        print_policy_list_text(driver)
        inspect_detail_buttons(driver)
        click_first_detail_button(driver)

    finally:
        driver.quit()


if __name__ == "__main__":
    main()