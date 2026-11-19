# FastAPI Prediction Lab

Bộ công cụ trực quan chạy cục bộ cho seminar **Chapter 12: Creating an efficient prediction API endpoint with FastAPI** (*Building Data Science Applications with FastAPI*, François Voron). Giao diện React hiển thị kết quả **đo thật** từ một API FastAPI phân loại văn bản Newsgroups (TF-IDF + Naive Bayes).

Không có số liệu dựng sẵn: mọi con số trong giao diện (thời gian server, thời gian trình duyệt, hit rate, thời gian chờ từng request) được đo ngay lúc bạn bấm chạy, nên thay đổi theo máy và theo từng lần.

## Có gì bên trong

| Phần | Nội dung |
|:---|:---|
| **Dự đoán** | Gửi văn bản, nhận nhãn, độ tin cậy, top-3 và cờ CACHE HIT |
| **Cache Lab** | Xoá cache, gửi cùng một văn bản 6 lần, so sánh cold inference với cache hit |
| **Concurrency Lab** | Bắn đồng thời nhiều request vào `async def` và `def`, vẽ dòng thời gian từng request |
| **API** | `lifespan`, `def` chạy trong ThreadPool, cache LRU trong RAM, batch, `/health`, validation |

## Cấu trúc

```text
fastapi-prediction-lab/
├── apps/
│   ├── api/                      # Backend FastAPI
│   │   ├── app/                  #   main.py, model_service.py, schemas.py, config.py
│   │   ├── models/               #   newsgroups_model.joblib (~3 MB)
│   │   ├── scripts/train_model.py#   huấn luyện lại model (tuỳ chọn)
│   │   ├── tests/test_api.py     #   11 test pytest
│   │   └── requirements.txt
│   └── web/                      # Giao diện React + Vite + TypeScript
│       └── src/                  #   App, labs/, api.ts, stats.ts (+ stats.test.ts)
├── docs/architecture.md          # Thiết kế và lý do chọn
├── package.json                  # npm workspaces
└── README.md
```

## Cài đặt

Yêu cầu: **Python 3.10+**, **Node.js 20+**.

**Windows (PowerShell)**

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\..
npm install
```

**macOS / Linux**

```bash
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..
npm install
```

## Chạy

Cần hai terminal, cả hai mở ở thư mục gốc dự án.

**Terminal 1: API (cổng 8000)**

```powershell
cd apps\api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

(macOS/Linux: `cd apps/api && .venv/bin/uvicorn app.main:app --port 8000`)

**Terminal 2: giao diện (cổng 5173)**

```bash
npm run dev:web
```

Mở **http://127.0.0.1:5173**. Nhãn góc phải hiện `API: ONLINE` khi backend sẵn sàng. Tài liệu API tự sinh: http://127.0.0.1:8000/docs.

Vite chuyển tiếp `/api` sang cổng 8000. Nếu backend ở nơi khác, đặt `PVL_API_PROXY_TARGET` trước khi chạy `npm run dev:web`.

## Kiểm thử

```bash
npm test            # unit test frontend (vitest)
npm run typecheck   # kiểm tra kiểu TypeScript
npm run build       # build production vào apps/web/dist
```

```powershell
cd apps\api
.\.venv\Scripts\python.exe -m pytest      # 11 test API với model thật
```

Test API dùng model thật trong `apps/api/models`, không gọi mạng. Test song song kiểm tra 3 request `def` × 0,3 s phải xong dưới 0,8 s.

## API

| Endpoint | Chức năng |
|:---|:---|
| `POST /api/prediction` | Dự đoán 1 văn bản (1–10.000 ký tự) |
| `POST /api/prediction/batch` | Tối đa 64 văn bản trong một lần gọi |
| `GET /api/health` | Trạng thái sẵn sàng và danh sách nhãn |
| `GET /api/cache/stats` | Hit, miss, hit rate, kích thước cache |
| `DELETE /api/cache` | Xoá cache và đặt lại bộ đếm |
| `GET /api/lab/slow-async`, `/slow-sync` | Thí nghiệm chặn Event Loop, tham số `sleep` (0–5 s) |

Mọi response có header `X-Process-Time-Ms` (thời gian xử lý ở server).

Ví dụ (PowerShell dùng `curl.exe`):

```bash
curl -X POST http://127.0.0.1:8000/api/prediction -H "Content-Type: application/json" -d "{\"text\": \"computer cpu memory ram\"}"
```

## Lưu ý quan trọng

- **Phiên bản scikit-learn.** `newsgroups_model.joblib` được lưu bằng scikit-learn **1.2.2**. Khi nạp bằng bản mới hơn (ví dụ 1.9.1) sẽ có `InconsistentVersionWarning`; kết quả thử nghiệm vẫn đúng nhưng không được đảm bảo giữa các phiên bản. Cách sạch nhất là huấn luyện lại trên máy bạn (cần mạng để tải dataset lần đầu): `python apps/api/scripts/train_model.py`.
- **Chỉ nạp file model do chính bạn tạo.** `joblib` dùng pickle và có thể chạy mã tuỳ ý khi nạp file lạ.
- **Cache nằm trong RAM của từng process.** Chạy `--workers N` thì mỗi worker có cache riêng. Cache mất khi server khởi động lại.
- **Concurrency Lab giới hạn 6 request**, vì trình duyệt chỉ mở khoảng 6 kết nối đồng thời tới một host qua HTTP/1.1.
- API chỉ dành cho chạy cục bộ, không có xác thực người dùng.
