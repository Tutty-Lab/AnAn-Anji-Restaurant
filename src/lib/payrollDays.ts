// Anw.-Tage (ngày hiện diện) je Person und Monat – aus „AnAn_Anji_BangLuong_ChamCong_2023_2024.pdf",
// dazu Anji 12/2023 Ha Phuong Nguyen 7,95 (Rückrechnung in der Abrechnung 02/2024). Generiert, nicht von Hand ändern.
// 21,67 = 5 Tage × 52 Wochen ÷ 12 Monate; bei Ein-/Austritt anteilig. Der Planer hält diese Tageszahl je Monat ein.
export const PAYROLL_DAYS: Record<string, Record<string, Record<string, number>>> = {
  anan: {
    "2023-06": { "Asghar Naveed": 21.67, "Bao Long Nguyen": 21.67, "Hiep Doan": 21.67, "Hoa Bang Dao": 21.67, "Ngoc Dat Doan": 21.67, "Thi Kieu Hoa Tran": 21.67, "Thi Kim Ngan Nguyen": 21.67, "Truong Son Cao": 21.67, "Van Hau Hoang": 21.67 },
    "2023-07": { "Asghar Naveed": 21.67, "Bao Long Nguyen": 21.67, "Hiep Doan": 21.67, "Hoa Bang Dao": 21.67, "Ngoc Dat Doan": 21.67, "Thi Kieu Hoa Tran": 21.67, "Thi Kim Ngan Vu": 21.67, "Truong Son Cao": 0.72, "Van Hau Hoang": 21.67 },
    "2023-08": { "Asghar Naveed": 21.67, "Bao Long Nguyen": 21.67, "Hiep Doan": 21.67, "Hoa Bang Dao": 21.67, "Ngoc Dat Doan": 21.67, "Thi Kieu Hoa Tran": 21.67, "Thi Kim Ngan Vu": 21.67, "Van Hau Hoang": 21.67 },
    "2023-09": { "Asghar Naveed": 21.67, "Bao Long Nguyen": 21.67, "Hiep Doan": 21.67, "Hoa Bang Dao": 21.67, "Ngoc Dat Doan": 6.5, "Thi Kim Ngan Vu": 21.67, "Van Hau Hoang": 21.67 },
    "2023-10": { "Bao Long Nguyen": 21.67, "Hiep Doan": 21.67, "Hoa Bang Dao": 21.67, "Thi Kim Ngan Vu": 21.67, "Trung Dung Duong": 21.67, "Van Hau Hoang": 21.67, "Van Nham Pham": 11.56 },
    "2023-11": { "Bao Long Nguyen": 21.67, "Duy Tan Nguyen": 19.5, "Hiep Doan": 21.67, "Hoa Bang Dao": 3.61, "Thi Kim Ngan Vu": 21.67, "Trung Dung Duong": 21.67, "Van Hau Hoang": 21.67, "Van Nham Pham": 21.67 },
    "2024-01": { "Bao Long Nguyen": 21.67, "Cong Tri Duong": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Trung Dung Duong": 21.67, "Van Hau Hoang": 21.67, "Van Nham Pham": 21.67 },
    "2024-02": { "Bao Long Nguyen": 8.67, "Cong Tri Duong": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Ky Duyen Nguyen": 5.78, "Trung Dung Duong": 21.67, "Van Hau Hoang": 21.67, "Van Nham Pham": 21.67 },
    "2024-03": { "Cong Tri Duong": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Ky Duyen Nguyen": 21.67, "Trung Dung Duong": 21.67 },
    "2024-04": { "Thi Ky Duyen Nguyen": 21.67 },
    "2024-05": { "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67 },
    "2024-06": { "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 11.56 },
    "2024-07": { "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
    "2024-08": { "Anh Tuan Pham": 2.17, "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
    "2024-09": { "Anh Tuan Pham": 21.67, "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
    "2024-10": { "Anh Tuan Pham": 21.67, "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Hong Son Le": 21.67, "Huy Nam Nguyen": 21.67, "Quoc Dung Nguyen": 20.95, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
    "2024-11": { "Anh Tuan Pham": 21.67, "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Huy Nam Nguyen": 21.67, "Quoc Dung Nguyen": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
    "2024-12": { "Anh Tuan Pham": 21.67, "Cong Tri Duong": 21.67, "Duc Tuan Tran": 21.67, "Hiep Doan": 21.67, "Huy Nam Nguyen": 21.67, "Ngoc Dat Doan": 11.56, "Quoc Dung Nguyen": 21.67, "Thanh Tam Le": 21.67, "Thi Kim Ngan Vu": 21.67, "Thi Thuy Nhu": 21.67, "Trung Dung Duong": 21.67, "Van Hao Nguyen": 21.67, "Van Trang Tran": 21.67 },
  },
  anji: {
    "2023-05": { "Dinh Van Pham": 21.67, "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "Rdwan Salim Hadeedah": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 6.5, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-06": { "Dinh Van Pham": 21.67, "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "Rdwan Salim Hadeedah": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-07": { "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-08": { "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-09": { "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-10": { "Duc Tuan Nguyen": 21.67, "Huu Tho Pham": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2023-11": { "Quoc Dat Nguyen": 21.67, "Thi Thuy Nhu": 21.75 },
    "2023-12": { "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 7.95, "Huu Tho Pham": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Truong Thai Nguyen": 21.67, "Van Quyet Hoang": 21.67, "Xuan Chi Dong": 21.67 },
    "2024-01": { "Ha Phuong Nguyen": 21.67, "Quang Tien La": 11.56, "Tien Viet Pham": 10.84 },
    "2024-02": { "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Quang Tien La": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Thu Huong Nguyen": 21.67, "Tien Viet Pham": 21.67, "Truong Thai Nguyen": 21.67 },
    "2024-03": { "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Hong Son Le": 20.95, "Quang Tien La": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thi Thuy Nhu": 21.75, "Thu Huong Nguyen": 21.67, "Tien Viet Pham": 21.67, "Truong Thai Nguyen": 21.67 },
    "2024-04": { "Duc Thinh Nguyen": 10.11, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Hong Son Le": 21.67, "Huy Nam Nguyen": 18.06, "Quang Tien La": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thuy Linh Nguyen": 21.67, "Thu Huong Nguyen": 21.67, "Tien Viet Pham": 21.67, "Truong Thai Nguyen": 12.28 },
    "2024-05": { "Thi Thuy Linh Nguyen": 10.83 },
    "2024-06": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Hong Son Le": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 20.95, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thu Huong Nguyen": 21.67, "Tien Viet Pham": 21.67 },
    "2024-08": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thu Huong Nguyen": 21.67 },
    "2024-09": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thu Huong Nguyen": 21.67 },
    "2024-10": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thah Huong Vi": 21.67, "Thu Huong Nguyen": 21.67 },
    "2024-11": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thah Huong Vi": 21.67, "Thu Huong Nguyen": 21.67 },
    "2024-12": { "Duc Thinh Nguyen": 21.67, "Duc Tuan Nguyen": 21.67, "Ha Phuong Nguyen": 21.67, "Huy Nam Nguyen": 21.67, "Quang Tien La": 21.67, "Quoc Dat Nguyen": 21.67, "The Buong Nguyen": 21.76, "Thi Mo Nguyen": 21.67, "Thi Thah Huong Vi": 21.67, "Thu Huong Nguyen": 21.67 },
  },
};

/** Anw.-Tage dieser Person in diesem Monat, sonst undefined. */
export function payrollDays(storeId: string, monthKey: string, name: string): number | undefined {
  return PAYROLL_DAYS[storeId]?.[monthKey]?.[name];
}
