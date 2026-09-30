import os
import re
import json
import time
import calendar
import subprocess
import tempfile
import pandas as pd
import requests
from urllib.parse import urlencode

from crawlers.base import html_to_text


SOURCE_SITE = "bokjiro.go.kr"
SOURCE_NAME = "복지로_서울청년복지"
DATA_SCOPE = "서울"

OUTPUT_ACTIVE_PATH = "output/raw/bokjiro_seoul_active_raw.csv"
OUTPUT_NEED_CHECK_PATH = "output/raw/bokjiro_seoul_need_check_raw.csv"
OUTPUT_CLOSED_PATH = "output/raw/bokjiro_seoul_closed_raw.csv"
OUTPUT_OLLAMA_INPUT_PATH = "output/raw/bokjiro_seoul_raw_all.csv"

DEBUG_DIR = "output/debug"
COOKIE_PATH = "output/debug/bokjiro_seoul_cookies.txt"

MAX_PAGES = 50
STOP_AFTER_EMPTY_POLICY_PAGES = 3
REQUEST_TIMEOUT = 30
SLEEP_SECONDS = 0.4

CURRENT_YEAR = pd.Timestamp.today().year

SIDO_CD = "1100000000"
AGE = "23"
PERIOD = "청년"
TARGET_REGION_KEYWORDS = ["서울", "서울특별시"]

OPEN_ENDED_
# ────────────────────────────────────────────────────────────
# [추가] 카테고리 분류 키워드
# ────────────────────────────────────────────────────────────
STRONG_JOB_KEYWORDS = [
    "취업", "면접", "자기소개서", "자소서", "이력서", "채용", "구직",
    "옷장", "정장대여", "정장 대여", "합격지원", "합격 지원",
    "면접사진", "면접 사진", "취업지원", "취업 지원", "청년합격",
]

CATEGORY_JOB_KEYWORDS = [
    "직무", "인턴", "일자리", "직업", "직업훈련", "창업", "창직", "자격증",
    "역량강화", "취창업", "멘토링", "커리어", "현직자", "취업성공", "일경험",
    "노동", "근로", "스타트업", "면접정장", "직업교육", "인력양성",
    "해외취업", "해외진출", "봉사단", "아르바이트", "알바", "청년기업", "사업단", "교육",
]

CATEGORY_HOUSING_KEYWORDS = [
    "주택", "임대주택", "전세", "월세", "보증금", "이사비", "이사 지원",
    "부동산", "기숙사", "청약", "안심주택", "전월세", "주거비", "주거급여",
    "매입임대", "공공임대", "임차보증금", "중개보수", "숙소", "주거 지원",
    "셰어하우스", "행복주택", "장학관", "주거교육", "주거안정",
]


def infer_category_from_title(title: str) -> str:
    text = title
    if any(k in text for k in STRONG_JOB_KEYWORDS):
        return "일자리"
    if any(k in text for k in CATEGORY_HOUSING_KEYWORDS):
        return "주거"
    if any(k in text for k in CATEGORY_JOB_KEYWORDS):
        return "일자리"
    return "복지"


ACTIVE_KEYWORDS = [
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
    "사업종료",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "close",
    "Origin": "https://www.bokjiro.go.kr",
    "Referer": "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do",
    "X-Requested-With": "XMLHttpRequest",
}


def today():
    return pd.Timestamp.today().normalize()


def normalize_space(text):
    if not isinstance(text, str):
        return ""

    return re.sub(r"\s+", " ", text).strip()


def make_list_url(page: int, tab_id: str) -> str:
    params = {
        "page": page,
        "orderBy": "date",
        "tabId": tab_id,
        "age": AGE,
        "sidoCd": SIDO_CD,
        "period": PERIOD,
    }

    return (
        "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do"
        f"?{urlencode(params)}"
    )


def make_api_url() -> str:
    return "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/selectWlfareInfo.do"


def make_detail_url(policy_id: str, rel_cd: str = "01") -> str:
    params = {
        "wlfareInfoId": policy_id,
        "wlfareInfoReldBztpCd": rel_cd or "01",
    }

    return (
        "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do"
        f"?{urlencode(params)}"
    )


def make_search_params(page: int, tab_id: str):
    return {
        "page": str(page),
        "onlineYn": "",
        "searchTerm": "",
        "tabId": tab_id,
        "orderBy": "date",
        "bkjrLftmCycCd": "",
        "daesang": "",
        "period": PERIOD,
        "age": AGE,
        "region": "",
        "jjim": "",
        "subject": "",
        "favoriteKeyword": "Y",
        "sidoCd": SIDO_CD,
        "sggCd": "",
        "endYn": "N",
    }


class BokjiroClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        os.makedirs(DEBUG_DIR, exist_ok=True)

    def init_session(self):
        url = make_list_url(1, "1")

        try:
            response = self.session.get(
                url,
                headers={
                    **HEADERS,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                },
                timeout=REQUEST_TIMEOUT,
                verify=True,
                allow_redirects=True,
            )
            response.raise_for_status()
            return response.text
        except Exception as error:
            print("[복지로-서울] 세션 초기화 requests 실패, curl 재시도:", error)

        try:
            return self.fetch_curl(
                "GET",
                url,
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                },
            )
        except Exception as error:
            print("[복지로-서울] 세션 초기화 curl 실패, API 직접 호출로 진행:", error)
            return ""

    def fetch_requests(self, method: str, url: str, headers=None, params=None, data=None, json_data=None):
        request_headers = dict(HEADERS)

        if headers:
            request_headers.update(headers)

        response = self.session.request(
            method,
            url,
            headers=request_headers,
            params=params,
            data=data,
            json=json_data,
            timeout=REQUEST_TIMEOUT,
            verify=True,
            allow_redirects=True,
        )
        response.raise_for_status()
        response.encoding = response.apparent_encoding or "utf-8"

        return response.text

    def fetch_curl(self, method: str, url: str, headers=None, params=None, data=None, json_data=None):
        request_headers = dict(HEADERS)

        if headers:
            request_headers.update(headers)

        final_url = url

        if params:
            query = urlencode(params)
            separator = "&" if "?" in final_url else "?"
            final_url = f"{final_url}{separator}{query}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
            temp_path = temp_file.name

        try:
            command = [
                "curl.exe",
                "-L",
                "--http1.1",
                "--compressed",
                "--connect-timeout",
                str(REQUEST_TIMEOUT),
                "--max-time",
                str(REQUEST_TIMEOUT),
                "-X",
                method.upper(),
                "-A",
                request_headers["User-Agent"],
                "--cookie",
                COOKIE_PATH,
                "--cookie-jar",
                COOKIE_PATH,
            ]

            for key, value in request_headers.items():
                command.extend(["-H", f"{key}: {value}"])

            if json_data is not None:
                command.extend(["-H", "Content-Type: application/json;charset=UTF-8"])
                command.extend(["--data-raw", json.dumps(json_data, ensure_ascii=False)])

            elif data is not None:
                command.extend(["-H", "Content-Type: application/x-www-form-urlencoded;charset=UTF-8"])
                if isinstance(data, dict):
                    command.extend(["--data-raw", urlencode(data)])
                else:
                    command.extend(["--data-raw", str(data)])

            command.extend(["-o", temp_path, final_url])

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
            )

            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or result.stdout.strip())

            with open(temp_path, "r", encoding="utf-8", errors="ignore") as file:
                return file.read()

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def fetch_text(self, method: str, url: str, headers=None, params=None, data=None, json_data=None):
        try:
            return self.fetch_requests(
                method,
                url,
                headers=headers,
                params=params,
                data=data,
                json_data=json_data,
            )
        except Exception as requests_error:
            print("[복지로-서울] requests 실패, curl 재시도:", requests_error)

        return self.fetch_curl(
            method,
            url,
            headers=headers,
            params=params,
            data=data,
            json_data=json_data,
        )


def save_debug_response(name: str, text: str):
    os.makedirs(DEBUG_DIR, exist_ok=True)

    path = os.path.join(DEBUG_DIR, name)

    with open(path, "w", encoding="utf-8", errors="ignore") as file:
        file.write(text)

    print("[복지로-서울] 디버그 저장:", path)


def try_parse_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    match = re.search(r"\[.*\]", text, re.DOTALL)

    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return None


def normalize_date(year, month, day):
    return pd.Timestamp(year=int(year), month=int(month), day=int(day))


def parse_yyyymmdd(value):
    value = normalize_space(str(value))

    if not re.fullmatch(r"\d{8}", value):
        return None

    if value == "19700101":
        return None

    try:
        return pd.Timestamp(
            year=int(value[:4]),
            month=int(value[4:6]),
            day=int(value[6:8]),
        )
    except Exception:
        return None


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


def parse_enfc_date_ranges(text: str):
    if not isinstance(text, str):
        return []

    start_match = re.search(r"ENFC_BGNG_YMD:\s*(\d{8})", text)
    end_match = re.search(r"ENFC_END_YMD:\s*(\d{8})", text)

    if not start_match or not end_match:
        return []

    start = parse_yyyymmdd(start_match.group(1))
    end = parse_yyyymmdd(end_match.group(1))

    if not start:
        return []

    if not end:
        return [(start, pd.Timestamp(year=2099, month=12, day=31))]

    return [(start, end)]


def parse_date_ranges(text: str):
    ranges = []

    if not isinstance(text, str):
        return ranges

    ranges.extend(parse_enfc_date_ranges(text))

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
        "서비스 신청기간",
        "신청기간",
        "신청 기간",
        "접수기간",
        "접수 기간",
        "모집기간",
        "모집 기간",
        "지원기간",
        "지원 기간",
        "제공기간",
        "제공 기간",
        "사업기간",
        "ENFC_BGNG_YMD",
        "ENFC_END_YMD",
    ]

    stop_keywords = [
        "지원대상",
        "선정기준",
        "서비스 내용",
        "신청방법",
        "추가정보",
        "문의",
        "근거법령",
        "서식",
    ]

    chunks = []

    for i, line in enumerate(lines):
        if any(keyword in line for keyword in keywords):
            chunk_lines = []

            for next_line in lines[i:i + 12]:
                if chunk_lines and any(stop_keyword in next_line for stop_keyword in stop_keywords):
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


def flatten_dict_text(data):
    parts = []

    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                continue

            value_text = normalize_space(str(value))

            if value_text:
                parts.append(f"{key}: {value_text}")

    return "\n".join(parts)


def find_value(data: dict, keys):
    for key in keys:
        value = data.get(key)

        if value is not None and normalize_space(str(value)):
            return normalize_space(str(value))

    return ""


def get_policy_rel_cd(data):
    return find_value(
        data,
        [
            "WLFARE_GDNC_TRGT_KCD",
            "wlfareInfoReldBztpCd",
            "welfareInfoReldBztpCd",
            "relCd",
            "bztpCd",
        ],
    )


def is_target_region_policy(data):
    rel_cd = get_policy_rel_cd(data)

    if rel_cd == "01":
        return True

    if rel_cd != "02":
        return False

    raw_text = flatten_dict_text(data)
    addr = find_value(data, ["ADDR", "addr", "region", "REGION", "SIDO_NM", "sidoNm"])
    combined = f"{addr}\n{raw_text}"

    return any(keyword in combined for keyword in TARGET_REGION_KEYWORDS)


def is_policy_like_dict(data):
    if not isinstance(data, dict):
        return False

    id_keys = [
        "WLFARE_INFO_ID",
        "wlfareInfoId",
        "welfareInfoId",
        "wlfrInfoId",
        "servId",
        "serviceId",
        "svcId",
    ]

    title_keys = [
        "WLFARE_INFO_NM",
        "wlfareInfoNm",
        "welfareInfoNm",
        "servNm",
        "serviceName",
        "svcNm",
        "title",
        "name",
    ]

    has_id = any(data.get(key) for key in id_keys)
    has_title = any(data.get(key) for key in title_keys)

    return has_id and has_title


def collect_policy_dicts_from_dataset(data):
    results = []

    if isinstance(data, dict):
        if is_policy_like_dict(data) and is_target_region_policy(data):
            results.append(data)

        for value in data.values():
            results.extend(collect_policy_dicts_from_dataset(value))

    elif isinstance(data, list):
        for item in data:
            results.extend(collect_policy_dicts_from_dataset(item))

    return results


def get_dataset_by_tab_id(data, tab_id):
    if not isinstance(data, dict):
        return None

    dataset_key = f"dsServiceList{tab_id}"

    if dataset_key in data:
        return data[dataset_key]

    for value in data.values():
        found = get_dataset_by_tab_id(value, tab_id)
        if found is not None:
            return found

    return None


def collect_policy_dicts(data, tab_id):
    dataset = get_dataset_by_tab_id(data, tab_id)

    if dataset is None:
        return []

    return collect_policy_dicts_from_dataset(dataset)


def make_item_from_policy_dict(data, page, tab_id):
    source_policy_id = find_value(
        data,
        [
            "WLFARE_INFO_ID",
            "wlfareInfoId",
            "welfareInfoId",
            "wlfrInfoId",
            "servId",
            "serviceId",
            "svcId",
        ],
    )

    title = find_value(
        data,
        [
            "WLFARE_INFO_NM",
            "wlfareInfoNm",
            "welfareInfoNm",
            "servNm",
            "serviceName",
            "svcNm",
            "title",
            "name",
        ],
    )

    rel_cd = get_policy_rel_cd(data) or "01"

    summary = find_value(
        data,
        [
            "WLFARE_INFO_OUTL_CN",
            "wlfareInfoOutlCn",
            "welfareInfoOutlCn",
            "servDgst",
            "summary",
            "description",
            "outlCn",
        ],
    )

    raw_text = flatten_dict_text(data)

    return {
        "source_site": SOURCE_SITE,
        "source_name": SOURCE_NAME,
        "data_scope": DATA_SCOPE,
        "policy_id": f"bokjiro_seoul_{source_policy_id}",
        "source_policy_id": source_policy_id,
        "title": title,
        "detail_url": make_detail_url(source_policy_id, rel_cd),
        "list_page": page,
        "source_tab_id": tab_id,
        "raw_text": f"{title}\n{summary}\n{raw_text}",
    }


def request_api_attempts(client: BokjiroClient, page: int, tab_id: str):
    params = make_search_params(page, tab_id)
    api_url = make_api_url()

    attempts = [
        {
            "name": "post_json_dmSearchParam",
            "method": "POST",
            "headers": {"Content-Type": "application/json;charset=UTF-8"},
            "json_data": {"dmSearchParam": params},
        },
        {
            "name": "post_json_submission_dmSearchParam",
            "method": "POST",
            "headers": {"Content-Type": "application/json;charset=UTF-8"},
            "json_data": {
                "submissionId": "selectTwatWlfareInfo",
                "dmSearchParam": params,
            },
        },
        {
            "name": "post_json_root",
            "method": "POST",
            "headers": {"Content-Type": "application/json;charset=UTF-8"},
            "json_data": params,
        },
        {
            "name": "post_form_dmSearchParam",
            "method": "POST",
            "headers": {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
            "data": {"dmSearchParam": json.dumps(params, ensure_ascii=False)},
        },
        {
            "name": "post_form_flat",
            "method": "POST",
            "headers": {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
            "data": params,
        },
    ]

    responses = []

    for attempt in attempts:
        try:
            text = client.fetch_text(
                attempt["method"],
                api_url,
                headers=attempt.get("headers"),
                params=attempt.get("params"),
                data=attempt.get("data"),
                json_data=attempt.get("json_data"),
            )

            if page == 1:
                save_debug_response(
                    f"bokjiro_seoul_tab{tab_id}_api_{attempt['name']}.txt",
                    text,
                )

            responses.append((attempt["name"], text))

        except Exception as e:
            if page == 1:
                save_debug_response(
                    f"bokjiro_seoul_tab{tab_id}_api_{attempt['name']}_error.txt",
                    str(e),
                )

    return responses


def collect_policy_items_for_tab(client, tab_id, max_pages):
    results = []
    seen_ids = set()
    empty_policy_pages = 0

    for page in range(1, max_pages + 1):
        print(f"[복지로-서울] tabId={tab_id} API 목록 페이지 확인 중: {page}")

        page_items = []

        for attempt_name, response_text in request_api_attempts(client, page, tab_id):
            data = try_parse_json(response_text)

            if data is None:
                continue

            if isinstance(data, dict):
                message = data.get("dmMessage", {})
                if message.get("status") == "ERROR":
                    continue

            policy_dicts = collect_policy_dicts(data, tab_id)

            if not policy_dicts:
                continue

            for policy_dict in policy_dicts:
                item = make_item_from_policy_dict(policy_dict, page, tab_id)

                if not item["source_policy_id"] or not item["title"]:
                    continue

                if item["source_policy_id"] in seen_ids:
                    continue

                seen_ids.add(item["source_policy_id"])
                page_items.append(item)

            if page_items:
                print(f"[복지로-서울] tabId={tab_id} 사용 API 방식: {attempt_name}")
                break

        print(f"[복지로-서울] tabId={tab_id} {page}페이지 정책 수:", len(page_items))

        if len(page_items) == 0:
            empty_policy_pages += 1
            print(f"[복지로-서울] tabId={tab_id} 연속 빈 목록 페이지:", empty_policy_pages)
        else:
            empty_policy_pages = 0

        if empty_policy_pages >= STOP_AFTER_EMPTY_POLICY_PAGES:
            print(f"[복지로-서울] tabId={tab_id} 빈 목록 페이지가 반복되어 목록 수집 종료")
            break

        results.extend(page_items)
        time.sleep(SLEEP_SECONDS)

    print(f"[복지로-서울] tabId={tab_id} 목록 전체 정책 수:", len(results))
    return results


def collect_policy_items(max_pages: int = MAX_PAGES):
    client = BokjiroClient()
    client.init_session()

    all_items = []
    seen_policy_ids = set()

    for tab_id in ["1", "2"]:
        items = collect_policy_items_for_tab(client, tab_id, max_pages)

        for item in items:
            if item["policy_id"] in seen_policy_ids:
                continue

            seen_policy_ids.add(item["policy_id"])
            all_items.append(item)

    print("[복지로-서울] 목록 전체 정책 수:", len(all_items))
    return all_items, client


def fetch_policy_detail(client: BokjiroClient, item: dict):
    raw_text = item.get("raw_text", "")

    try:
        html = client.fetch_text(
            "GET",
            item["detail_url"],
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            },
        )
        detail_text = html_to_text(html)

        if len(detail_text.strip()) > len(raw_text.strip()):
            raw_text = detail_text

    except Exception as e:
        print("[복지로-서울] 상세 요청 실패, 목록 raw_text 사용:", item["title"], e)

    status, reason = classify_policy(item["title"], raw_text, item["policy_id"])

    return {
        "source_site": SOURCE_SITE,
        "source_name": SOURCE_NAME,
        "data_scope": item.get("data_scope", DATA_SCOPE),
        "policy_id": item["policy_id"],
        "source_policy_id": item.get("source_policy_id", ""),
        "title": item["title"],
        "detail_url": item["detail_url"],
        "list_page": item["list_page"],
        "source_tab_id": item.get("source_tab_id", ""),
        "schema_category": infer_category_from_title(item["title"]),
        "crawl_status": status,
        "crawl_reason": reason,
        "raw_text": raw_text,
    }


def crawl_bokjiro_seoul():
    items, client = collect_policy_items()

    active_rows = []
    need_check_rows = []
    closed_rows = []

    for idx, item in enumerate(items, start=1):
        try:
            row = fetch_policy_detail(client, item)

            if row["crawl_status"] == "active":
                active_rows.append(row)
                print(f"[복지로-서울] ACTIVE 저장 {len(active_rows)}개째:", row["title"], "/", row["crawl_reason"])

            elif row["crawl_status"] == "need_check":
                need_check_rows.append(row)
                print(f"[복지로-서울] NEED_CHECK 저장 {len(need_check_rows)}개째:", row["title"], "/", row["crawl_reason"])

            else:
                closed_rows.append(row)
                print(f"[복지로-서울] CLOSED 제외:", row["title"], "/", row["crawl_reason"])

        except Exception as e:
            need_check_rows.append({
                "source_site": SOURCE_SITE,
                "source_name": SOURCE_NAME,
                "data_scope": DATA_SCOPE,
                "policy_id": item["policy_id"],
                "source_policy_id": item.get("source_policy_id", ""),
                "title": item["title"],
                "detail_url": item["detail_url"],
                "list_page": item["list_page"],
                "source_tab_id": item.get("source_tab_id", ""),
                "crawl_status": "need_check",
                "crawl_reason": f"detail_fetch_error:{e}",
                "raw_text": "",
            })
            print("[복지로-서울] 상세 확인 실패, NEED_CHECK 처리:", item["title"], e)

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

    print("[복지로-서울] active raw 저장:", OUTPUT_ACTIVE_PATH)
    print("[복지로-서울] need_check raw 저장:", OUTPUT_NEED_CHECK_PATH)
    print("[복지로-서울] closed raw 저장:", OUTPUT_CLOSED_PATH)
    print("[복지로-서울] Ollama 입력용 raw 저장:", OUTPUT_OLLAMA_INPUT_PATH)

    print("[복지로-서울] active 수:", len(active_rows))
    print("[복지로-서울] need_check 수:", len(need_check_rows))
    print("[복지로-서울] closed 수:", len(closed_rows))
    print("[복지로-서울] Ollama 추출 대상 수:", len(final_rows))


if __name__ == "__main__":
    crawl_bokjiro_seoul()