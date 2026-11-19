"""Cấu hình đọc từ biến môi trường (có giá trị mặc định an toàn cho chạy cục bộ)."""

import os
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent

MODEL_FILE = Path(
    os.environ.get("PVL_MODEL_FILE", API_ROOT / "models" / "newsgroups_model.joblib")
)
MAX_TEXT_LENGTH = 10_000  # ký tự mỗi văn bản
MAX_BATCH_SIZE = 64  # số văn bản mỗi request batch
CACHE_SIZE = int(os.environ.get("PVL_CACHE_SIZE", "1024"))
MAX_LAB_SLEEP = 5.0  # giây, giới hạn endpoint mô phỏng để tránh treo server

# Rate limit (mặc định 60 request/phút mỗi IP)
RATE_LIMIT = os.environ.get("PVL_RATE_LIMIT", "60/minute")

# API key — nếu set thì yêu cầu xác thực, nếu để trống thì bỏ qua auth
API_KEY = os.environ.get("PVL_API_KEY", "")
