import pandas as pd


FINAL_COLUMNS = [
    "data_scope",

    # source metadata
    "source_site",
    "source_name",
    "policy_id",
    "policy_title",
    "detail_url",
    "source_category",
    "schema_category",

    # policies / user_profiles schema fields
    "title",
    "amin",
    "amax",
    "region",
    "scity",
    "income",
    "asset",
    "education",
    "employment",
    "disability",
    "gender",
    "pstart",
    "pend",
    "ostart",
    "oend",
    "eligibility",
    "add_condition",

    # reference fields for manual validation
    "support_content",
    "required_documents",
    "application_method",

    # pipeline metadata
    "crawl_status",
    "crawl_reason",
    "ai_status",
    "ai_reason",
    "ai_evidence",
    "error",
]


def merge_schema_files(schema_files: list[dict], output_path):
    """
    schema_files 예:
    [
        {"scope": "서울", "path": "...csv"},
        {"scope": "경기", "path": "...csv"},
    ]
    """
    dfs = []

    for item in schema_files:
        scope = item["scope"]
        path = item["path"]

        df = pd.read_csv(path)
        df["data_scope"] = scope
        dfs.append(df)

        print(f"[병합 입력] {scope}: {path} / {len(df)}개")

    merged_df = pd.concat(dfs, ignore_index=True)

    print("\n[중복 제거 전]")
    print("전체 개수:", len(merged_df))

    if "policy_id" in merged_df.columns:
        merged_df["policy_id"] = merged_df["policy_id"].astype("string").str.strip()

        has_policy_id = merged_df["policy_id"].notna() & (merged_df["policy_id"] != "")

        with_policy_id = merged_df[has_policy_id].copy()
        without_policy_id = merged_df[~has_policy_id].copy()

        print("policy_id 있음:", len(with_policy_id))
        print("policy_id 없음:", len(without_policy_id))

        before_with_id = len(with_policy_id)
        with_policy_id = with_policy_id.drop_duplicates(
            subset=["policy_id"],
            keep="first",
        )
        print("policy_id 기준 중복 제거:", before_with_id - len(with_policy_id), "개")

        if not without_policy_id.empty:
            fallback_cols = []

            if "detail_url" in without_policy_id.columns:
                fallback_cols.append("detail_url")

            if "policy_title" in without_policy_id.columns:
                fallback_cols.append("policy_title")

            if fallback_cols:
                for col in fallback_cols:
                    without_policy_id[col] = without_policy_id[col].astype("string").str.strip()

                before_without_id = len(without_policy_id)
                without_policy_id = without_policy_id.drop_duplicates(
                    subset=fallback_cols,
                    keep="first",
                )
                print(
                    "policy_id 없는 행 보조 중복 제거:",
                    before_without_id - len(without_policy_id),
                    "개",
                    "/ 기준:",
                    fallback_cols,
                )
            else:
                print("policy_id 없는 행 보조 중복 제거 건너뜀: detail_url/policy_title 없음")

        merged_df = pd.concat([with_policy_id, without_policy_id], ignore_index=True)

    else:
        print("policy_id 컬럼 없음: 중복 제거 건너뜀")

    print("\n[중복 제거 후]")
    print("전체 개수:", len(merged_df))

    # 누락 컬럼 생성
    for col in FINAL_COLUMNS:
        if col not in merged_df.columns:
            merged_df[col] = None

    merged_df = merged_df[FINAL_COLUMNS]

    merged_df.to_csv(output_path, index=False, encoding="utf-8-sig")

    print("최종 병합 저장 완료:", output_path)
    print("최종 병합 개수:", len(merged_df))

    print("\n[데이터 범위 분포]")
    print(merged_df["data_scope"].value_counts(dropna=False))

    print("\n[지역 분포]")
    print(merged_df["region"].value_counts(dropna=False))

    print("\n[스키마 카테고리 분포]")
    print(merged_df["schema_category"].value_counts(dropna=False))

    print("\n[policy_id 결측 확인]")
    print("policy_id 없음:", merged_df["policy_id"].isna().sum())
    print("policy_id 빈 문자열:", (merged_df["policy_id"].astype(str).str.strip() == "").sum())

    print("\n[확인용]")
    check_cols = [
        "data_scope",
        "policy_id",
        "policy_title",
        "detail_url",
        "source_category",
        "schema_category",
        "amin",
        "amax",
        "region",
        "scity",
        "pstart",
        "pend",
        "ostart",
        "oend",
        "eligibility",
        "add_condition",
    ]
    existing_check_cols = [col for col in check_cols if col in merged_df.columns]
    print(merged_df[existing_check_cols].head(20))

    return merged_df