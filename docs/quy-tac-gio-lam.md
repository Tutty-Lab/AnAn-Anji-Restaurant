# Quy tắc giờ làm & nghỉ

Hai nhóm quy tắc: **(1) LUẬT** (không được vi phạm) và **(2) quy tắc app/quán**
(đổi được tuỳ quán). Thuật toán xếp lịch và phần nghiệm thu đều đối chiếu theo đây.

---

## 1. Giờ làm & nghỉ — quán ăn Đức (LUẬT, bản gọn)

- **Tối đa 10h/ngày** (bình thường **8h**) — không hơn, kể cả làm thêm.
- **Tối đa 6 ngày/tuần**, phải có **1 ngày nghỉ**.
- Làm **> 6h → nghỉ 30 phút**; làm **> 8h → nghỉ 60 phút** (nghỉ **không tính lương**).
- **Nghỉ ≥ 11h** giữa hai ca.
- **Làm đêm / Chủ Nhật / lễ → có phụ cấp** (đêm **~25%**).
- **Dưới 18 tuổi**: tối đa **8h/ngày**, **không làm sau 22h**.
- **Ghi giờ làm và giữ ≥ 2 năm** — dùng **Stundenzettel xuất PDF hàng tháng** là đủ.

> Đây là bản rút gọn để kiểm nhanh. Không thay thế tư vấn pháp lý; khi quán có
> tình huống đặc biệt (ca đêm dài, người < 18, hợp đồng riêng) thì kiểm với kế
> toán/luật.

### Suy ra cho thuật toán (phải luôn đúng)
- Không xếp ai **> 10h/ngày** (giới hạn luật; từng quán có thể chặn thấp hơn – AnAn và Anji chặn **9 giờ công/ngày**, xem mục 2).
- Không xếp ai **> 6 ngày liên tiếp** (phải chèn ngày nghỉ).
- **Pause** tự tính theo ngưỡng 6h/8h và **trừ khỏi giờ trả lương**.
- Khoảng cách hai ca của cùng người **≥ 11h**.

---

## 2. Quy tắc app / quán — KHÔNG phải luật (đổi được tuỳ quán)

Restaurant AnAn:

- **Giờ mở**: T2–T6 11:00–14:30 và 17:00–22:30 · T7 11:00–22:30 · CN và ngày lễ 12:00–22:30.
- **Giờ làm** bắt đầu sớm hơn 30′ (T2–T7 10:30, CN/lễ 11:30): **bếp chuẩn bị, đúng 1 người**. Phục vụ và lái xe làm từ giờ mở.
- **Tối đa 9 giờ công/ngày**; app chặn cả khi xếp tự động lẫn khi sửa tay.
- **Quy tắc cứng:** từ lúc mở đến lúc đóng cửa luôn có **ít nhất 1 phục vụ và 1 bếp**.
- **Quy tắc mềm – Phục vụ (bồi):** T2–T4 sáng 2, chiều 2 · T5–CN sáng 2, chiều 3.
- **Quy tắc mềm – Bếp:** 10:30 1 người · T2–CN sáng 2 · T5–T7 tối 3 (đông thì 4).
- **Quy tắc mềm – Lái xe:** chủ yếu tối (18:00–21:00, CN/lễ 18:00–22:00): trong tuần 1 người, CN luôn 2. Giờ hợp đồng dư thì làm thêm buổi trưa.
- Sáng = mở cửa – 14:30, chiều/tối = 17:00 – đóng cửa. T7/CN 14:30–17:00 chỉ áp dụng quy tắc cứng.
- **Nhóm:** Bếp, Phục vụ, Lái xe – theo danh sách chủ quán, admin sửa trong tab Nhân viên. Azubi là nhóm Phục vụ.
- **Toàn thời gian** (≥ 150h/tháng): ca và giờ làm cố định. **Bán thời gian:** ưu tiên giờ đông.
- **Hợp đồng theo tháng** (giờ bảng lương) xếp theo bậc 30′, không vượt. Ngày vào làm / ngày thôi làm chặn các ngày ngoài hợp đồng.

Restaurant Anji (cùng app, cùng giờ mở và giờ làm như AnAn):

- **Quy tắc cứng:** luôn có **ít nhất 1 bồi và 1 bếp**.
- **Quy tắc mềm – Bồi:** T2–T4 sáng 3, chiều 3 · T5–CN sáng 3, chiều 4.
- **Quy tắc mềm – Bếp:** 10:30 1 người · T2–CN sáng 3 · T5–T7 tối 4.
- **Nhóm:** Bếp, Bồi (không có lái xe). Ha Phuong Nguyen, Quang Tien La, Tien Viet Pham là Azubi làm bồi.

Người làm cả hai quán (Thi Thuy Nhu, Huy Nam Nguyen, Hong Son Le – nối ở mục „Cũng làm ở quán khác"):

- **Mỗi ngày chỉ làm ở một quán.** Tạo lịch xếp AnAn trước, Anji vào những ngày còn trống.
- **Luật ngày nghỉ tính cả hai quán:** ≤ 6 ngày liên tiếp, ≤ 6 ngày/tuần. Quán xếp trước chỉ dùng số ngày/tuần theo tỉ lệ giờ hợp đồng ở hai quán.
- Sửa tay làm trùng ngày hoặc vượt 6 ngày → app báo đỏ ở đầu trang.

> Các quy tắc này là vận hành của quán, không phải luật — có thể chỉnh theo từng
> cửa hàng (số người tối thiểu, khung giờ cao điểm, số ngày mở…). Khi đổi, nhớ
> cập nhật lại phần **"trước khi giao khách"** trong [`nghiem-thu.md`](nghiem-thu.md).
