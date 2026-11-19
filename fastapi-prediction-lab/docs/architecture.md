# Kiến trúc và lý do thiết kế

## Luồng tổng thể

```text
Trình duyệt (React, :5173)
   │  fetch /api/...
   ▼
Vite dev proxy ──────────► FastAPI (uvicorn, :8000)
                              │
                              ├─ lifespan: nạp model 1 lần
                              ├─ endpoint `def`  → ThreadPool (prediction, batch, health, cache, lab/slow-sync)
                              ├─ endpoint `async def` → Event Loop (lab/fast, lab/slow-async)
                              └─ NewsgroupsModel
                                    ├─ LruCache (RAM, khoá + đếm hit/miss)
                                    └─ Pipeline TF-IDF + MultinomialNB
```

## Các quyết định chính

**1. Nạp model bằng `lifespan`, không nạp theo request.** Nạp pickle tốn hàng chục đến hàng trăm ms; làm một lần lúc khởi động. `/api/health` trả 503 nếu model chưa sẵn sàng, để load balancer không gửi traffic sớm.

**2. Endpoint dự đoán dùng `def`, không dùng `async def`.** `model.predict_proba` là CPU-bound và đồng bộ. Trong `async def` nó chạy thẳng trên Event Loop và chặn mọi request khác. Với `def`, FastAPI tự đẩy hàm vào ThreadPool. Concurrency Lab chứng minh điều này bằng cách đo: 3 request × 1 s mất khoảng 3 s với `async def` và khoảng 1 s với `def` (đo ở máy phát triển, kết quả của bạn sẽ khác nhẹ).

Giới hạn: ThreadPool vẫn bị GIL chi phối với code Python thuần. Với model nặng hơn nhiều, nên tách ra process riêng (`--workers N`) hoặc dịch vụ suy luận chuyên dụng.

**3. Cache LRU trong RAM thay cho `joblib.Memory` (đĩa).** Model này suy luận chỉ vài ms, nên đọc và giải tuần tự hoá kết quả từ đĩa không còn lợi nhiều. Cache RAM không tốn I/O. Dùng lớp `LruCache` tự viết thay vì `functools.lru_cache` vì cần biết chính xác từng lần gọi là hit hay miss khi nhiều thread chạy song song (kiểm tra `cache_info()` trước và sau lệnh gọi sẽ sai khi có race).

Đánh đổi: cache mất khi khởi động lại và không chia sẻ giữa các worker. Nếu cần, dùng Redis.

Khoá cache là văn bản đã `strip()`. Chỉ chuẩn hoá nhẹ để không làm thay đổi ngữ nghĩa.

**4. Batch đi thẳng vào model, không qua cache.** `predict_proba` trên cả lô vector hoá nhanh hơn gọi lặp. Cho đơn giản, batch không đọc/ghi cache.

**5. Giới hạn đầu vào.** Văn bản 1–10.000 ký tự, tối đa 64 văn bản mỗi batch, `sleep` của endpoint thí nghiệm tối đa 5 s. Điều này tránh một request làm treo server hoặc làm đầy bộ nhớ.

**6. Số đo thật, hai nguồn.** Giao diện hiển thị cả thời gian trình duyệt (`performance.now`, gồm proxy và mạng cục bộ) lẫn thời gian server (header `X-Process-Time-Ms`). Không có số liệu dựng sẵn.

## Giới hạn đã biết

- Thí nghiệm cache dùng một văn bản duy nhất, nên chỉ minh hoạ cơ chế, không đại diện cho phân bố truy vấn thật.
- Model là TF-IDF + Naive Bayes trên 4 nhóm tin; không phản ánh độ trễ của model lớn.
- Concurrency Lab chạy qua proxy Vite và HTTP/1.1, nên tối đa 6 request đồng thời.
- Chưa có đo tải (load test) hay xác thực người dùng.
