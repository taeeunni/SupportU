# config.py

from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

OUTPUT_DIR = BASE_DIR / "output"
RAW_DIR = OUTPUT_DIR / "raw"
PROCESSED_DIR = OUTPUT_DIR / "processed"
MASTER_DIR = OUTPUT_DIR / "master"

for directory in [RAW_DIR, PROCESSED_DIR, MASTER_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


TODAY = pd.Timestamp.today().normalize()
TODAY_STR = TODAY.strftime("%Y_%m_%d")


MODEL_NAME = "qwen2.5:7b" 


SOURCES = {
    "seoul": {
        "name": "서울 청년포털_서울정책",
        "active_raw": RAW_DIR / "seoul_active_raw.csv",
        "need_check_raw": RAW_DIR / "seoul_need_check_raw.csv",
        "closed_raw": RAW_DIR / "seoul_closed_raw.csv",
        "ollama_input": RAW_DIR / "seoul_raw_all.csv",
        "need_check_classified": PROCESSED_DIR / "seoul_need_check_classified.csv",
        "final_candidates": PROCESSED_DIR / "seoul_final_candidates.csv",
        "final_schema": PROCESSED_DIR / "seoul_final_schema.csv",
    },

    "seoul_gyeonggi": {
        "name": "서울 청년포털_경기도정책",
        "active_raw": RAW_DIR / "seoul_other_gyeonggi_active_raw.csv",
        "need_check_raw": RAW_DIR / "seoul_other_gyeonggi_need_check_raw.csv",
        "closed_raw": RAW_DIR / "seoul_other_gyeonggi_closed_raw.csv",
        "ollama_input": RAW_DIR / "seoul_other_gyeonggi_raw_all.csv",
        "need_check_classified": PROCESSED_DIR / "seoul_other_gyeonggi_need_check_classified.csv",
        "final_candidates": PROCESSED_DIR / "seoul_other_gyeonggi_final_candidates.csv",
        "final_schema": PROCESSED_DIR / "seoul_other_gyeonggi_final_schema.csv",
        "final_schema_postprocessed": PROCESSED_DIR / "seoul_other_gyeonggi_final_schema_postprocessed.csv",
    },

    "gyeonggi": {
        "name": "경기청년포털",
        "active_raw": RAW_DIR / "gyeonggi_active_raw.csv",
        "need_check_raw": RAW_DIR / "gyeonggi_need_check_raw.csv",
        "closed_raw": RAW_DIR / "gyeonggi_closed_raw.csv",
        "ollama_input": RAW_DIR / "gyeonggi_raw_all.csv",
        "need_check_classified": PROCESSED_DIR / "gyeonggi_need_check_classified.csv",
        "final_candidates": PROCESSED_DIR / "gyeonggi_final_candidates.csv",
        "final_schema": PROCESSED_DIR / "gyeonggi_final_schema.csv",
        "final_schema_postprocessed": PROCESSED_DIR / "gyeonggi_final_schema_postprocessed.csv",
    },
}


FINAL_MERGED_SCHEMA = PROCESSED_DIR / "final_policy_schema_seoul_gyeonggi.csv"

MASTER_POLICY_PATH = MASTER_DIR / "policy_master.csv"
NEW_POLICIES_PATH = PROCESSED_DIR / f"new_policies_{TODAY_STR}.csv"
UPDATED_POLICIES_PATH = PROCESSED_DIR / f"updated_policies_{TODAY_STR}.csv"
UNCHANGED_POLICIES_PATH = PROCESSED_DIR / f"unchanged_policies_{TODAY_STR}.csv"