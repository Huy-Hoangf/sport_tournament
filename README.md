# Sport Tournament

Ứng dụng quản lý giải đấu, lịch trận và dự đoán thắng/hòa/thua.

## Cấu trúc

- `backend/`: API NestJS và schema PostgreSQL tại `backend/schema/postgres.sql`.
- `frontend/`: giao diện Next.js.
- `docs/examples/`: file Excel mẫu để import lịch trận.
- `docs/archive/`: schema SQL Server cũ, chỉ để tham khảo.
- `render.yaml`: cấu hình triển khai backend trên Render.

## Chạy trên máy

1. Tạo PostgreSQL và chạy `backend/schema/postgres.sql` trên database trống.
2. Sao chép `backend/.env.example` thành `backend/.env` và điền cấu hình.
3. Trong `backend/`, chạy `npm ci` rồi `npm run start:dev`.
4. Sao chép `frontend/.env.example` thành `frontend/.env.local`.
5. Trong `frontend/`, chạy `npm ci` rồi `npm run dev`.

## Kiểm tra

- Backend: `npm test -- --runInBand` và `npm run build`.
- Frontend: `npm run lint` và `npm run build`.
- Excel mẫu 7 cột: `docs/examples/matches-import-sample.xlsx`.
