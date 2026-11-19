# ⚡ FastAPI Prediction Lab

> **Seminar Chapter 12: Creating an efficient prediction API endpoint with FastAPI**  
> *(Dựa trên sách "Building Data Science Applications with FastAPI" — François Voron)*

Hệ thống mẫu và phòng thí nghiệm tương tác (Interactive Lab) hoàn chỉnh cho bài toán phục vụ mô hình Machine Learning (Model Serving) hiệu năng cao với **FastAPI** và **React (Vite + TypeScript)**. 

Mọi con số trên giao diện (thời gian server, roundtrip trình duyệt, tỉ lệ cache hit/miss, latency percentiles P50/P95/P99, timeline luồng song song) đều được **đo lường thực tế** theo thời gian thực từ máy chủ cục bộ.

---

## 🌟 Điểm nổi bật & Tính năng cốt lõi

### 1. ⚙️ Backend (FastAPI & Machine Learning)
- **Quản lý vòng đời (`lifespan`)**: Tải mô hình TF-IDF + Multinomial Naive Bayes vào bộ nhớ đúng một lần duy nhất lúc khởi động, sẵn sàng phục vụ tức thì mà không lặp lại I/O disk.
- **Xử lý tác vụ CPU-Bound chuẩn mực**: Khai báo endpoint dự đoán bằng `def` (chạy trên ThreadPool của AnyIO/Starlette) thay vì `async def`, ngăn chặn tuyệt đối việc nghẽn Event Loop khi tính toán ma trận.
- **SHA-256 Keyed LRU Cache**: Cache in-memory lưu trữ kết quả phân loại bằng hash SHA-256 của chuỗi văn bản, tiết kiệm RAM cho văn bản dài và thread-safe.
- **Smart Batch Processing**: Endpoint `/api/prediction/batch` tự động đối soát cache trước — chỉ chuyển các mẫu chưa có trong cache vào mô hình suy luận, gộp kết quả trả về trong một lượt.
- **Đo lường & Quan sát (Observability)**:
  - Header chuẩn `X-Process-Time-Ms` (micro-benchmark thời gian xử lý thực tại backend) & `X-Request-ID`.
  - Structured JSON Logging qua `python-json-logger`.
  - Bộ đếm chỉ số độ trễ tự động thu thập phân vị P50, P95, P99 và Mean cho từng endpoint (`/api/metrics`).
- **Bảo vệ hệ thống**: Tích hợp Rate Limiting qua `slowapi` và tuỳ chọn xác thực `X-API-Key`.

### 2. 💻 Frontend (React + Vite + TypeScript)
- **Giao diện Modern Dark-Theme**: Thiết kế chuyên nghiệp, phông chữ Inter, thẻ gradient có chiều sâu, hiệu ứng trạng thái API online/offline động.
- **Điều hướng Sidebar dọc thông minh**: Tối ưu không gian làm việc, hỗ trợ Responsive chuyển thành Navigation Bar trên thiết bị di động.
- **Hệ thống phím tắt (Keyboard Shortcuts)**: Nhấn `Ctrl + 1` đến `Ctrl + 4` để chuyển nhanh tức thì giữa 4 Lab.
- **Hệ thống Toast Notification**: Báo trạng thái trực quan ở góc màn hình (Success, Error, Info) tự biến mất sau 3 giây.
- **4 Phòng thí nghiệm tương tác**:
  1. 🎯 **Dự đoán (Predict Lab)**:
     - Thử nghiệm phân loại đơn lẻ với các bộ từ khóa có sẵn (công nghệ, tôn giáo, mật mã học, y tế, thể thao, tài chính...).
     - **Chế độ So sánh (Compare Mode)**: 2 khung nhập song song, dự đoán đồng thời để đối chiếu kết quả.
     - **Lịch sử dự đoán (History)**: Tự động lưu 10 lượt dự đoán gần nhất vào LocalStorage, hỗ trợ 1-click nạp lại hoặc xóa lịch sử.
     - **Xuất dữ liệu (Export JSON)**: Tải toàn bộ kết quả suy luận & metadata thành file `.json`.
     - **Thanh đo độ tin cậy**: Đổi màu cảnh báo trực quan (Xanh ≥80%, Vàng ≥50%, Đỏ <50%).
     - Bộ đếm ký tự thời gian thực (giới hạn an toàn 10.000 ký tự).
  2. 💾 **Cache Lab**:
     - Đo lường và so sánh trực tiếp giữa Cold Inference và Warm Cache Hit qua 6 lần gọi lặp.
     - Tính toán hệ số tăng tốc (Speedup Multiplier: ví dụ nhanh hơn 5x – 25x), thống kê Hit/Miss và Cache Size.
  3. ⚡ **Concurrency Lab**:
     - Thí nghiệm trực quan chứng minh vì sao blocking code trong `async def` làm tắc nghẽn server và vì sao `def` chạy trong ThreadPool giải quyết triệt để vấn đề.
     - Biểu đồ thời gian (Timeline) so sánh luồng xử lý nối tiếp (Sequential) vs đồng thời (Parallel).
  4. 📊 **Metrics Lab**:
     - Bảng theo dõi hiệu năng hệ thống: số lượng request, độ trễ trung bình, P50, P95, P99.
     - Tự động làm mới (Auto-refresh) mỗi 5 giây.

---

## 🏗️ Cấu trúc thư mục

```text
fastapi-prediction-lab/
├── apps/
│   ├── api/                          # Backend FastAPI
│   │   ├── app/                      
│   │   │   ├── config.py             # Cấu hình môi trường, hằng số, ngưỡng giới hạn
│   │   │   ├── main.py               # FastAPI app, endpoints, middleware, metrics
│   │   │   ├── model_service.py      # LRU Cache SHA256 & Pipeline suy luận scikit-learn
│   │   │   └── schemas.py            # Pydantic models (Input / Output validation)
│   │   ├── models/                   # File mô hình lưu trữ (.joblib) & metadata
│   │   ├── scripts/train_model.py    # Script huấn luyện lại mô hình từ 20 Newsgroups
│   │   ├── tests/test_api.py         # 11 ca kiểm thử tự động với pytest
│   │   └── requirements.txt          # Thư viện Python cố định phiên bản
│   └── web/                          # Frontend React (SPA)
│       ├── src/
│       │   ├── labs/                 # 4 module phòng thí nghiệm (Predict, Cache, Concurrency, Metrics)
│       │   ├── api.ts                # Client gọi API + bộ quản lý LocalStorage history
│       │   ├── App.tsx               # Khung ứng dụng chính, Sidebar, Keyboard shortcuts
│       │   ├── Toast.tsx             # Hệ thống thông báo nổi Toast
│       │   ├── stats.ts              # Xử lý thống kê (P50/P95, speedup calculation)
│       │   └── styles.css            # Toàn bộ CSS Design System v2
│       ├── package.json              # Cấu hình web dependencies
│       └── vite.config.ts            # Cấu hình Vite & Proxy chuyển tiếp /api -> port 8000
├── docs/                             # Tài liệu kiến trúc chuyên sâu
├── package.json                      # npm workspaces cấu hình monorepo
├── .gitignore                        # Loại trừ triệt để .venv, node_modules, cache
└── README.md
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu tiên quyết
- **Python**: 3.10 trở lên
- **Node.js**: 20 trở lên

---

### Bước 1: Cài đặt Dependencies

#### 1.1. Backend Python
Từ thư mục gốc dự án:

```powershell
# Tạo và kích hoạt môi trường ảo (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Cài đặt thư viện Python
pip install -r fastapi-prediction-lab\apps\api\requirements.txt
```

*(Trên macOS / Linux: `source .venv/bin/activate && pip install -r fastapi-prediction-lab/apps/api/requirements.txt`)*

#### 1.2. Frontend Web
```bash
# Cài đặt toàn bộ node_modules
cd fastapi-prediction-lab
npm install
```

---

### Bước 2: Khởi động Ứng dụng

Bạn cần mở **2 cửa sổ terminal**:

#### Terminal 1: Khởi động Backend API (Port 8000)
```powershell
cd fastapi-prediction-lab\apps\api
..\..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload
```
- API Endpoint: `http://127.0.0.1:8000`
- Tài liệu tương tác Swagger UI: `http://127.0.0.1:8000/docs`
- Redoc Documentation: `http://127.0.0.1:8000/redoc`

#### Terminal 2: Khởi động Frontend Web (Port 5173)
```powershell
cd fastapi-prediction-lab\apps\web
npm run dev
```
- Truy cập Dashboard giao diện tại: **http://localhost:5173**
- Khi backend hoạt động, nhãn trạng thái ở góc trên bên phải sẽ hiển thị: `🟢 API: ONLINE`.

---

## 📡 Danh mục API Endpoints

| Phương thức | Đường dẫn | Mô tả chức năng |
|:---|:---|:---|
| `POST` | `/api/prediction` | Dự đoán nhãn cho 1 văn bản (kèm top xác suất và cờ cache) |
| `POST` | `/api/prediction/batch` | Dự đoán tối đa 64 văn bản/lượt (tối ưu hóa qua cache) |
| `GET` | `/api/health` | Kiểm tra độ sẵn sàng của mô hình, phiên bản và danh sách nhãn |
| `GET` | `/api/cache/stats` | Thống kê bộ nhớ đệm: Hits, Misses, Hit Rate, Current/Max Size |
| `DELETE` | `/api/cache` | Xóa trắng cache và khởi tạo lại bộ đếm |
| `GET` | `/api/metrics` | Tổng hợp chỉ số độ trễ (Count, Mean, P50, P95, P99) |
| `GET` | `/api/lab/slow-sync` | Mô phỏng tác vụ chạy trong ThreadPool (`def`) không chặn server |
| `GET` | `/api/lab/slow-async` | Mô phỏng lỗi phổ biến: chặn Event Loop khi dùng `async def` sai cách |

### Ví dụ gọi API nhanh với `curl`:

```bash
# Dự đoán 1 văn bản
curl -X POST "http://127.0.0.1:8000/api/prediction" \
  -H "Content-Type: application/json" \
  -d '{"text": "microprocessor nvidia gpu hardware memory bios"}'

# Xem số liệu hiệu năng P50/P95/P99
curl -s "http://127.0.0.1:8000/api/metrics"
```

---

## 🧪 Kiểm thử (Testing & Quality Assurance)

### 1. Kiểm thử Backend (11 test ca tự động)
Kiểm tra tính toàn vẹn của mô hình, luồng tính toán song song, cơ chế cache SHA-256 và endpoint metrics:
```powershell
cd fastapi-prediction-lab\apps\api
..\..\..\.venv\Scripts\python.exe -m pytest -v
```

### 2. Kiểm thử Frontend & Kiểm tra Kiểu
```powershell
cd fastapi-prediction-lab
npm run typecheck    # Kiểm tra kiểu nghiêm ngặt TypeScript (tsc --noEmit)
npm test             # Chạy unit tests frontend (Vitest)
npm run build        # Biên dịch production build cho ứng dụng web
```

---

## 💡 Bài học Kỹ thuật Thực tế (Production Engineering)

1. **Async vs Sync trong FastAPI**:
   - Tác vụ I/O mạng / Database async (HTTP calls, asyncpg) ➡️ Dùng `async def`.
   - Tác vụ nặng CPU (Inference scikit-learn, PyTorch, xử lý ảnh) ➡️ Dùng **`def` thông thường**. FastAPI sẽ tự động điều phối sang threadpool riêng của AnyIO, giữ cho Event Loop luôn rảnh rỗi để tiếp nhận request mới.
2. **Quản lý Cache thông minh**:
   - Không lưu key là chuỗi văn bản dài hàng ngàn ký tự để tránh phình bộ nhớ RAM ➡️ Dùng mã băm **SHA-256 (32 bytes)** làm khóa cho LRU Cache.
   - Luôn bọc khóa đồng bộ `threading.Lock` xung quanh thao tác đọc/ghi cache để đảm bảo an toàn đa luồng.
3. **Đo đạc độ trễ chuẩn**:
   - Sử dụng `time.perf_counter()` trong middleware HTTP để đo độ trễ chính xác đến micro-giây, trả về qua header `X-Process-Time-Ms` để phía client có thể đối chiếu chênh lệch mạng.

---

## 📄 Bản quyền & Tác giả
- Phát triển cho mục đích học tập, nghiên cứu và trình bày chuyên đề kỹ thuật (Seminar).
- Mã nguồn mở phân phối theo giấy phép MIT.
