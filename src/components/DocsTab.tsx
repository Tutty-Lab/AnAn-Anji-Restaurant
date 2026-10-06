import {
  DAY_WEIGHTS,
  WEEKDAY_LABELS_VI,
  WEEKDAY_SHORT_VI,
  type WeekdayKey,
} from "../lib/demand";
import { DEMAND_PROFILE, GROUP_LABEL_VI, PREP_MINUTES, STAFFING_RULES, ruleAppliesOn, ruleRange, type DemandBand } from "../lib/staffing";
import { DEFAULT_WORK_HOURS, type DayBlocks } from "../lib/workHours";
import { SHIFT_LENGTHS } from "../lib/shifts";
import { calculatePause, minutesToTime, presenceFromPaid } from "../lib/time";

const WEEKDAY_ORDER: WeekdayKey[] = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const fmtWeight = (weight: number) => weight.toFixed(1).replace(".", ",");
const fmtRange = (min: number, max: number) => (Number.isFinite(max) ? (min === max ? `${min}` : `${min}–${max}`) : `${min}+`);
const fmtBlocks = (blocks: DayBlocks) =>
  blocks.map((block) => `${minutesToTime(block.startMinutes)}–${minutesToTime(block.endMinutes)}`).join(" và ");

/** Giờ làm lấy thẳng từ DEFAULT_WORK_HOURS – cùng nguồn với thuật toán. */
function OpeningHoursTable() {
  const cell = "border border-slate-200 px-3 py-1";
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <tbody>
          {WEEKDAY_ORDER.map((key) => (
            <tr key={key}>
              <td className={`${cell} font-medium`}>{WEEKDAY_LABELS_VI[key]}</td>
              <td className={cell}>
                {DEFAULT_WORK_HOURS.closedWeekdays[key] ? "Đóng cửa" : fmtBlocks(DEFAULT_WORK_HOURS.perWeekday[key])}
                <span className="ml-2 text-xs text-slate-500">
                  {DEFAULT_WORK_HOURS.perWeekday[key].length > 1 ? "ca gãy trưa/tối" : "ca liền"}
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <td className={`${cell} font-medium`}>Ngày lễ</td>
            <td className={cell}>{fmtBlocks(DEFAULT_WORK_HOURS.holiday)} <span className="ml-2 text-xs text-slate-500">xếp như Chủ Nhật</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WeekdayTable() {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            {WEEKDAY_ORDER.map((key) => (
              <th key={key} className={`border border-slate-200 px-3 py-1 font-medium ${DAY_WEIGHTS[key] > 1 ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
                {WEEKDAY_SHORT_VI[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {WEEKDAY_ORDER.map((key) => (
              <td key={key} className="border border-slate-200 px-3 py-1 text-center font-semibold">{fmtWeight(DAY_WEIGHTS[key])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Cột của bảng khung giờ: các nhóm ngày mà quy tắc của AnAn phân biệt. */
const DAY_COLUMNS: { label: string; day: WeekdayKey }[] = [
  { label: "T2–T4", day: "monday" },
  { label: "T5–T6", day: "thursday" },
  { label: "T7", day: "saturday" },
  { label: "CN / lễ", day: "sunday" },
];

/** Đường nhu cầu trong ngày – lấy thẳng từ DEMAND_PROFILE, cùng nguồn với thuật toán. */
function DemandCurve() {
  const column = (title: string, bands: readonly DemandBand[]) => (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs font-semibold text-slate-600">{title}</div>
      <ul className="space-y-1">
        {bands.map((b) => (
          <li key={b.startMinutes} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="tabular-nums text-slate-600">{minutesToTime(b.startMinutes)}–{minutesToTime(b.endMinutes)}</span>
            <span className="relative h-4 rounded bg-slate-100" title={b.label}>
              <span
                className={`absolute inset-y-0 left-0 rounded ${b.level >= 1.5 ? "bg-amber-400" : b.level > 1 ? "bg-amber-200" : "bg-teal-300"}`}
                style={{ width: `${(b.level / 1.5) * 100}%` }}
              />
              <span className="absolute inset-0 truncate px-1.5 leading-4 text-slate-800">{b.label}</span>
            </span>
            <span className="text-right font-semibold tabular-nums">{fmtWeight(b.level)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {column("T2–T7 (chiều 14:30–17:00 chỉ T7)", DEMAND_PROFILE.default)}
      {column("CN / ngày lễ (mở 12:00, bếp 11:30)", DEMAND_PROFILE.sunday)}
    </div>
  );
}

/**
 * Một dòng cho mỗi khung: loại (cứng/mềm), nhóm và số người theo từng nhóm ngày.
 * Lấy thẳng từ STAFFING_RULES – cùng nguồn với thuật toán và báo cáo Độ phủ.
 */
function StaffingRulesTable() {
  const cell = "border border-slate-200 px-3 py-1.5";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <th className={cell}>Khung</th>
            <th className={cell}>Loại</th>
            <th className={cell}>Nhóm</th>
            {DAY_COLUMNS.map((column) => (
              <th key={column.label} className={`${cell} text-center`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAFFING_RULES.map((rule) => (
            <tr key={rule.label}>
              <td className={cell}>
                <div className="font-medium text-slate-900">{rule.label}</div>
                <div className="text-xs text-slate-500">{rule.when}</div>
              </td>
              <td className={`${cell} text-center`}>
                {rule.hard
                  ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800">cứng</span>
                  : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">mềm</span>}
              </td>
              <td className={`${cell} text-xs`}>{rule.groups.map((group) => GROUP_LABEL_VI[group]).join(" + ")}</td>
              {DAY_COLUMNS.map((column) => {
                if (!ruleAppliesOn(rule, column.day)) return <td key={column.label} className={`${cell} text-center text-slate-400`}>—</td>;
                const { minStaff, maxStaff } = ruleRange(rule, column.day);
                return <td key={column.label} className={`${cell} text-center font-semibold`}>{fmtRange(minStaff, maxStaff)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocsTab() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg bg-slate-900 p-4 text-white sm:p-5">
        <h1 className="text-lg font-semibold">Tài liệu — nguyên tắc xếp lịch Restaurant AnAn</h1>
        <p className="mt-1 text-sm text-slate-300">
          Trang này mô tả thuật toán đang chạy. Giờ làm, bảng khung giờ, hệ số và đường nhu cầu lấy thẳng từ code.
          Khi có xung đột, thứ tự ưu tiên là: <b>luật và hợp đồng</b> → <b>quy tắc cứng (luôn 1 bếp, 1 phục vụ)</b> →{" "}
          <b>số người theo quy tắc mềm</b> → <b>đường nhu cầu</b> → <b>ưu tiên theo loại nhân viên</b>.
        </p>
      </div>

      <Section title="1. Giờ làm và điều kiện bắt buộc">
        <p>
          Quán mở: T2–T6 11:00–14:30 và 17:00–22:30, T7 11:00–22:30, CN và ngày lễ 12:00–22:30. Giờ làm trong
          bảng bắt đầu sớm hơn <b>{PREP_MINUTES}′</b>: đó là giờ <b>bếp chuẩn bị</b>. Trong {PREP_MINUTES}′ này chỉ bếp làm.
        </p>
        <OpeningHoursTable />
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Luật giờ làm:</b> tối đa <b>9 giờ công/ngày</b>. Tối đa <b>6 ngày liên tiếp</b> và 6 ngày/tuần. Trên 6h công nghỉ <b>30′</b>, trên 8h nghỉ <b>60′</b>. Không làm quá 6h liền trước hoặc sau giờ nghỉ.</li>
          <li><b>Hợp đồng theo tháng</b> (giờ trong bảng lương, ví dụ 173,81h): xếp theo bậc 30′ và <b>không vượt</b> (173,81h → 173,5h).</li>
          <li><b>Ngày vào làm / ngày thôi làm:</b> ngày trước khi vào và sau khi thôi không xếp ca. Giờ hợp đồng nhập là giờ của phần tháng còn làm (như bảng lương).</li>
          <li><b>Ca:</b> mỗi ca nằm gọn trong một khung giờ làm. T2–T6 được <b>ca gãy</b> (một phần trưa + một phần tối, mỗi phần ≥ 3h). T7, CN và ngày lễ chỉ có <b>một ca liền</b>, dài 3–9h.</li>
        </ul>
      </Section>

      <Section title="2. Nhóm nhân viên">
        <ul className="list-disc space-y-1 pl-5">
          <li>Có ba nhóm: <b>Bếp</b>, <b>Phục vụ</b> (bồi) và <b>Lái xe</b>. Bếp được làm từ giờ chuẩn bị. Phục vụ và lái xe làm từ giờ mở cửa.</li>
          <li><b>Lái xe</b> không tính vào số người trong quán. Lái xe chủ yếu làm tối (giờ chính 18:00–21:00, CN và lễ 18:00–22:00). Khi giờ hợp đồng không xếp hết vào buổi tối, lái xe làm thêm buổi trưa.</li>
          <li>Người <b>chưa gán nhóm</b> được tính là Phục vụ cho đến khi admin gán trong tab Nhân viên.</li>
          <li>Mỗi người chỉ có một nhóm. Duc Tuan Tran (phục vụ + lái xe) đang ở nhóm Phục vụ vì nhóm này thiếu giờ nhất.</li>
        </ul>
      </Section>

      <Section title="3. Quy tắc cứng và quy tắc mềm">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Cứng:</b> lúc nào cũng có <b>ít nhất 1 bếp</b> (từ giờ chuẩn bị) và <b>ít nhất 1 phục vụ</b> (từ giờ mở cửa). Thuật toán phạt thiếu người ở quy tắc cứng nặng gấp 10 lần quy tắc mềm. Nếu tháng đó không có ai trong một nhóm, Độ phủ báo đỏ mọi ngày.</li>
          <li><b>Mềm:</b> Phục vụ T2–T4 sáng 2, chiều 2; T5–CN sáng 2, chiều 3. Bếp 10:30 1 người; sáng 2 (T2–CN); tối 3 (T5–T7, đông thì 4). Lái xe tối T2–T7 1 người, CN và lễ 2 người. <b>Sáng</b> = mở cửa đến 14:30. <b>Chiều/tối</b> = 17:00 đến đóng cửa. T7, CN: 14:30–17:00 chỉ áp dụng quy tắc cứng.</li>
          <li>Khi đội không đủ giờ, thuật toán vẫn giữ quy tắc cứng, rồi lấp quy tắc mềm nhiều nhất có thể. Ô thiếu hiện đỏ trong Độ phủ.</li>
        </ul>
        <StaffingRulesTable />
      </Section>

      <Section title="4. Hệ số ngày và giờ công mỗi ngày">
        <p>
          Quán đông nhất T5–CN, nhất là buổi tối: T2–T4 = 1,0; T5 = 1,3; <b>T6–T7 = 1,5</b>; CN = 1,3
          (ngày lễ tính như CN). Giờ công mỗi ngày nhân cả hệ số lẫn số giờ làm, chuẩn hoá trong từng ISO-week:
        </p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-800">{`Giờ công ngày = giờ công cả tuần × (hệ số ngày × giờ làm)
              ÷ Σ (hệ số × giờ làm) các ngày mở trong tuần`}</pre>
        <WeekdayTable />
      </Section>

      <Section title="5. Đường nhu cầu trong ngày">
        <p>
          Thuật toán chia giờ công của ngày theo đường dưới đây thành <b>số người mục tiêu cho từng 30 phút</b>. Trưa và tối
          đông. Chiều T7/CN vắng. {PREP_MINUTES}′ chuẩn bị chỉ cần 1 người.
        </p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-800">{`Người mục tiêu (30′) = giờ công ngày × mức ÷ Σ (mức × 30′) cả ngày`}</pre>
        <DemandCurve />
      </Section>

      <Section title="6. Ưu tiên theo loại nhân viên">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Toàn thời gian</b> (≥ 150h/tháng): ca <b>cố định</b>. Tuần đủ ngày đầu tiên tạo mẫu (thứ nào làm, giờ vào/ra). Các tuần sau lệch mẫu bị phạt.</li>
          <li><b>Bán thời gian:</b> ưu tiên giờ đông và ngày đông (T6–T7). Mỗi 30′ ngoài giờ đông bị cộng điểm phạt nhỏ.</li>
        </ul>
      </Section>

      <Section title="7. Thuật toán xếp lịch – các bước">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Giờ tuần của từng người:</b> hợp đồng tháng (bậc 30′) chia về các tuần theo hệ số × giờ làm. Bỏ ngày trước khi vào làm và sau khi thôi làm.</li>
          <li><b>Giờ công mỗi ngày</b> theo mục 4, rồi <b>số người mục tiêu mỗi 30′</b> theo mục 5.</li>
          <li><b>Xếp từng người, từng tuần:</b> chọn ngày làm và độ dài ca (3–9h). Tuần rất ngắn ở đầu/cuối tháng (≤ 2 ngày) xếp trước. Một tuần được dùng ít giờ hơn phần của nó nếu nhờ vậy giữ được quy tắc cứng. Phần giờ còn lại được bù sang ngày khác ở bước 5.</li>
          <li><b>Chấm điểm mỗi phương án</b> từ nặng đến nhẹ: thiếu người ở quy tắc cứng → thiếu người ở quy tắc mềm → lệch số người mục tiêu → lệch giờ công ngày → ưu tiên theo loại → ca gãy.</li>
          <li><b>Sửa lại:</b> xếp lại từng tuần khi điểm tốt hơn. <b>Bù giờ còn thiếu</b>: kéo dài ca thêm 30′ ở chỗ ít làm lệch độ phủ nhất. <b>Chuyển ngày làm</b> sang ngày đang thiếu người cùng nhóm. <b>Dời giờ</b> giữa các ngày của cùng một người (tổng giờ tháng không đổi).</li>
          <li><b>Tinh chỉnh từng ngày:</b> dời giờ ca, dời giờ nghỉ theo số người thực tế, đổi người đóng cửa ở ngày mở liền.</li>
          <li><b>Kiểm tra:</b> luật, hợp đồng, ca, giờ nghỉ và độ phủ. Lỗi đỏ chặn in, cảnh báo vàng không chặn.</li>
        </ol>
        <p className="text-slate-600">Đây là thuật toán heuristic, không phải solver tối ưu toàn cục. Khi các mục tiêu không đạt cùng lúc, thuật toán giữ thứ tự ưu tiên ở đầu trang và báo rõ trong Độ phủ.</p>
      </Section>

      <Section title="8. Giờ nghỉ">
        <p>Giờ nghỉ là khoảng thời gian cụ thể trong ca. Giờ nghỉ kéo dài thời gian có mặt nhưng không tính giờ công. Ca gãy trưa/tối không cần nghỉ vì mỗi phần ≤ 6h.</p>
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead><tr className="bg-slate-50"><th className="border border-slate-200 px-3 py-1">Giờ công</th><th className="border border-slate-200 px-3 py-1">Pause</th><th className="border border-slate-200 px-3 py-1">Có mặt</th></tr></thead>
            <tbody>{SHIFT_LENGTHS.map((hours) => (
              <tr key={hours}>
                <td className="border border-slate-200 px-3 py-1">{hours}h</td>
                <td className="border border-slate-200 px-3 py-1">{calculatePause(hours * 60)}′</td>
                <td className="border border-slate-200 px-3 py-1">{(presenceFromPaid(hours * 60) / 60).toFixed(2).replace(".", ",")}h</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      <Section title="9. Cách dùng">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Kiểm tra giờ làm, ngày lễ và ngày đặc biệt (đóng cả ngày hoặc giờ riêng) trong <b>Cài đặt</b>.</li>
          <li>Kiểm tra nhóm, giờ hợp đồng, ngày vào làm và ngày thôi làm trong <b>Nhân viên</b>.</li>
          <li>Bấm <b>Tạo lịch làm việc</b>. Xem <b>Độ phủ</b> (B = bếp, P = phục vụ, LX = lái xe) và các cảnh báo (i) trước khi xuất PDF.</li>
          <li>Sau khi sửa tay một ca, xem lại Độ phủ rồi mới xuất bản in.</li>
        </ol>
      </Section>
    </div>
  );
}
