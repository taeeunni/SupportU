import subprocess
import sys

from config import SOURCES, FINAL_MERGED_SCHEMA
from pipeline.sync_db import sync_to_supabase
from pipeline.classify import classify_need_check_file
from pipeline.merge import merge_candidates
from pipeline.extract_schema import extract_schema_from_file
from pipeline.postprocess import postprocess_seoul_schema, postprocess_gyeonggi_schema
from pipeline.final_merge import merge_schema_files
from pipeline.master_update import update_master_policy


def run_command(command: list[str]):
    print("\n실행:", " ".join(command))

    result = subprocess.run(command)

    if result.returncode != 0:
        print("실패:", " ".join(command))
        sys.exit(result.returncode)

    print("완료:", " ".join(command))


def process_source(source_key: str, crawler_module: str, postprocess_type: str | None = None):
    """
    source_key:
      - seoul
      - seoul_gyeonggi
      - gyeonggi

    crawler_module:
      - crawlers.seoul
      - crawlers.seoul_other
      - crawlers.gyeonggi

    postprocess_type:
      - seoul
      - gyeonggi
      - None
    """
    python_path = sys.executable
    cfg = SOURCES[source_key]

    print("\n" + "=" * 60)
    print(f"[{source_key}] 처리 시작:", cfg["name"])
    print("=" * 60)

    run_command([python_path, "-m", crawler_module])

    classify_need_check_file(
        input_path=cfg["need_check_raw"],
        output_path=cfg["need_check_classified"],
    )

    merge_candidates(
        active_raw_path=cfg["active_raw"],
        need_check_classified_path=cfg["need_check_classified"],
        output_path=cfg["final_candidates"],
    )

    extract_schema_from_file(
        input_path=cfg["final_candidates"],
        output_path=cfg["final_schema"],
    )

    if postprocess_type == "seoul":
        postprocess_seoul_schema(
            input_path=cfg["final_schema"],
            output_path=cfg["final_schema"],
        )

    elif postprocess_type == "gyeonggi":
        postprocess_gyeonggi_schema(
            input_path=cfg["final_schema"],
            output_path=cfg["final_schema_postprocessed"],
        )

    print(f"[{source_key}] 처리 완료")


def main():
    print("=== 청년정책 자동 수집 파이프라인 시작 ===")

    process_source(
        source_key="seoul",
        crawler_module="crawlers.seoul",
        postprocess_type="seoul",
    )

    process_source(
        source_key="seoul_gyeonggi",
        crawler_module="crawlers.seoul_other",
        postprocess_type="gyeonggi",
    )

    process_source(
        source_key="gyeonggi",
        crawler_module="crawlers.gyeonggi",
        postprocess_type="gyeonggi",
    )

    merged_df = merge_schema_files(
        schema_files=[
            {
                "scope": "서울",
                "path": SOURCES["seoul"]["final_schema"],
            },
            {
                "scope": "경기",
                "path": SOURCES["seoul_gyeonggi"]["final_schema_postprocessed"],
            },
            {
                "scope": "경기",
                "path": SOURCES["gyeonggi"]["final_schema_postprocessed"],
            },
        ],
        output_path=FINAL_MERGED_SCHEMA,
    )

    print("\n" + "=" * 60)
    print("master 업데이트 시작")
    print("=" * 60)

    update_master_policy(
        latest_schema_path=FINAL_MERGED_SCHEMA,
    )

    print("\n=== 전체 작업 완료 ===")
    print("최종 DB 전달용 파일:")
    print(FINAL_MERGED_SCHEMA)

    print("\n최종 병합 개수:", len(merged_df))

    print("\n" + "=" * 60)
    print("Supabase 동기화 시작")
    print("=" * 60)

    try:
        sync_to_supabase()
    except ValueError as e:
        print(f"[건너뜀] Supabase 환경변수 미설정: {e}")


if __name__ == "__main__":
    main()