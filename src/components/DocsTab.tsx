import {
  WEEKDAY_LABELS_VI,
  WEEKDAY_SHORT_VI,
  type WeekdayKey,
} from "../lib/demand";
import { PREP_MINUTES, ruleAppliesOn, ruleRange, type DemandBand, type StoreProfile } from "../lib/staffing";
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

function WeekdayTable({ profile }: { profile: StoreProfile }) {
  const weights = profile.dayWeights;
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            {WEEKDAY_ORDER.map((key) => (
              <th key={key} className={`border border-slate-200 px-3 py-1 font-medium ${weights[key] > 1 ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
                {WEEKDAY_SHORT_VI[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {WEEKDAY_ORDER.map((key) => (
              <td key={key} className="border border-slate-200 px-3 py-1 text-center font-semibold">{fmtWeight(weights[key])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Cột của bảng khung giờ: các nhóm ngày mà quy tắc của AnAn và Anji phân biệt. */
const DAY_COLUMNS: { label: string; day: WeekdayKey }[] = [
  { label: "T2–T4", day: "monday" },
  { label: "T5–T6", day: "thursday" },
  { label: "T7", day: "saturday" },
  { label: "CN / lễ", day: "sunday" },
];

/** Đường nhu cầu trong ngày – lấy thẳng từ hồ sơ quán, cùng nguồn với thuật toán. */
function DemandCurve({ profile }: { profile: StoreProfile }) {
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
      {column("T2–T7 (chiều 14:30–17:00 chỉ T7)", profile.demand.default)}
      {column("CN / ngày lễ (mở 12:00, bếp 11:30)", profile.demand.sunday)}
    </div>
  );
}

/**
 * Một dòng cho mỗi khung: loại (cứng/mềm), nhóm và số người theo từng nhóm ngày.
 * Lấy thẳng từ hồ sơ quán – cùng nguồn với thuật toán và báo cáo Độ phủ.
 */
function StaffingRulesTable({ profile }: { profile: StoreProfile }) {
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
          {profile.staffingRules.map((rule) => (
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
              <td className={`${cell} text-xs`}>{rule.groups.map((group) => profile.groupLabels[group]).join(" + ")}</td>
              {DAY_COLUMNS.map((column) => {
                if (!ruleAppliesOn(rule, column.day)) return <td key={column.label} className={`${cell} text-center text-slate-400`}>—</td>;
                const { minStaff, maxStaff } = ruleRange(rule, column.day, profile);
                return <td key={column.label} className={`${cell} text-center font-semibold`}>{fmtRange(minStaff, maxStaff)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ein Block je Laden mit Überschrift – der Inhalt kommt aus dem Profil. */
function PerStore({ profiles, children }: { profiles: readonly StoreProfile[]; children: (profile: StoreProfile) => React.ReactNode }) {
  return (
    <div className="space-y-4">
      {profiles.map((profile) => (
        <div key={profile.id}>
          <div className="mb-1 text-sm font-semibold text-slate-900">{profile.name}</div>
          {children(profile)}
        </div>
      ))}
    </div>
  );
}

const weightText = (profile: StoreProfile) => {
  const w = profile.dayWeights;
  return `T2 ${fmtWeight(w.monday)} · T3 ${fmtWeight(w.tuesday)} · T4 ${fmtWeight(w.wednesday)} · T5 ${fmtWeight(w.thursday)} · T6 ${fmtWeight(w.friday)} · T7 ${fmtWeight(w.saturday)} · CN ${fmtWeight(w.sunday)}`;
};

export function DocsTab({ profiles }: { profiles: readonly StoreProfile[] }) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg bg-slate-900 p-4 text-white sm:p-5">
        <h1 className="text-lg font-semibold">Tài liệu — nguyên tắc xếp lịch {profiles.map((p) => p.name).join(" và ")}</h1>
        <p className="mt-1 text-sm text-slate-300">
          Trang này mô tả thuật toán đang chạy. Giờ làm, bảng khung giờ, hệ số và đường nhu cầu lấy thẳng từ code.
          Khi có xung đột, thứ tự ưu tiên là: <b>luật và hợp đồng</b> → <b>quy tắc cứng (luôn 1 bếp, 1 phục vụ/bồi)</b> →{" "}
          <b>số người theo quy tắc mềm</b> → <b>đường nhu cầu</b> → <b>ưu tiên theo loại nhân viên</b>.
        </p>
      </div>

      <Section title="1. Một app, hai quán">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            App quản lý <b>{profiles.map((p) => p.shortName).join(" và ")}</b>. Mỗi quán có nhân viên, lịch, mật khẩu và dữ liệu
            riêng. Tháng/năm ở đầu trang dùng chung cho cả hai quán. Hàng chọn quán dưới các tab đổi quán đang xem.
          </li>
          <li>
            <b>Tạo lịch</b> tạo lịch cho cả hai quán cùng lúc, lần lượt {profiles.map((p) => p.shortName).join(" rồi ")}.
          </li>
          <li>
            <b>Người làm cả hai quán</b> (cùng một người, nối ở mục „Cũng làm ở quán khác" trong tab Nhân viên):
            <b> mỗi ngày chỉ làm ở một quán</b>. Quán xếp sau không xếp người đó vào ngày đã làm ở quán trước. Nếu sửa tay
            làm một người trùng ngày ở hai quán, app báo đỏ ở đầu trang.
          </li>
          <li>
            Giờ hợp đồng của người làm hai quán tính riêng từng quán (theo bảng lương từng quán). Tổng giờ hai quán phải còn
            nằm trong luật giờ làm: nếu không đủ ngày trống, quán xếp sau báo thiếu giờ.
          </li>
        </ul>
      </Section>

      <Section title="2. Giờ làm và điều kiện bắt buộc">
        <p>
          Hai quán mở cùng giờ: T2–T6 11:00–14:30 và 17:00–22:30, T7 11:00–22:30, CN và ngày lễ 12:00–22:30. Giờ làm trong
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

      <Section title="3. Nhóm nhân viên">
        <ul className="list-disc space-y-1 pl-5">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <b>{profile.shortName}:</b> {profile.workRoles.map((role) => profile.groupLabels[role]).join(", ")}.
            </li>
          ))}
          <li>Bếp được làm từ giờ chuẩn bị. {profiles.map((p) => p.groupLabels.SERVICE).filter((v, i, a) => a.indexOf(v) === i).join("/")} và lái xe làm từ giờ mở cửa.</li>
          <li><b>Lái xe</b> (chỉ AnAn) không tính vào số người trong quán. Lái xe chủ yếu làm tối (giờ chính 18:00–21:00, CN và lễ 18:00–22:00). Khi giờ hợp đồng không xếp hết vào buổi tối, lái xe làm thêm buổi trưa.</li>
          <li>Người <b>chưa gán nhóm</b> được tính là phục vụ/bồi cho đến khi admin gán trong tab Nhân viên.</li>
        </ul>
      </Section>

      <Section title="4. Quy tắc cứng và quy tắc mềm">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Cứng:</b> lúc nào cũng có <b>ít nhất 1 bếp</b> (từ giờ chuẩn bị) và <b>ít nhất 1 phục vụ/bồi</b> (từ giờ mở cửa). Thuật toán phạt thiếu người ở quy tắc cứng nặng gấp 10 lần quy tắc mềm. Nếu tháng đó không có ai trong một nhóm, Độ phủ báo đỏ mọi ngày.</li>
          <li><b>Mềm:</b> số người theo từng buổi, khác nhau giữa hai quán (bảng dưới). <b>Sáng</b> = mở cửa đến 14:30. <b>Chiều/tối</b> = 17:00 đến đóng cửa. T7, CN: 14:30–17:00 chỉ áp dụng quy tắc cứng.</li>
          <li>Khi đội không đủ giờ, thuật toán vẫn giữ quy tắc cứng, rồi lấp quy tắc mềm nhiều nhất có thể. Ô thiếu hiện đỏ trong Độ phủ.</li>
        </ul>
        <PerStore profiles={profiles}>{(profile) => <StaffingRulesTable profile={profile} />}</PerStore>
      </Section>

      <Section title="5. Hệ số ngày và giờ công mỗi ngày">
        <p>Giờ công mỗi ngày nhân cả hệ số lẫn số giờ làm, chuẩn hoá trong từng ISO-week (ngày lễ tính như CN):</p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-800">{`Giờ công ngày = giờ công cả tuần × (hệ số ngày × giờ làm)
              ÷ Σ (hệ số × giờ làm) các ngày mở trong tuần`}</pre>
        <PerStore profiles={profiles}>
          {(profile) => (
            <>
              <p className="mb-1 text-xs text-slate-500">{weightText(profile)}</p>
              <WeekdayTable profile={profile} />
            </>
          )}
        </PerStore>
      </Section>

      <Section title="6. Đường nhu cầu trong ngày">
        <p>
          Thuật toán chia giờ công của ngày theo đường dưới đây thành <b>số người mục tiêu cho từng 30 phút</b>. Trưa và tối
          đông. Chiều T7/CN vắng. {PREP_MINUTES}′ chuẩn bị chỉ cần 1 người.
        </p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-800">{`Người mục tiêu (30′) = giờ công ngày × mức ÷ Σ (mức × 30′) cả ngày`}</pre>
        <PerStore profiles={profiles}>{(profile) => <DemandCurve profile={profile} />}</PerStore>
      </Section>

      <Section title="7. Ưu tiên theo loại nhân viên">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Toàn thời gian</b> (≥ 150h/tháng): ca <b>cố định</b>. Tuần đủ ngày đầu tiên tạo mẫu (thứ nào làm, giờ vào/ra). Các tuần sau lệch mẫu bị phạt.</li>
          <li><b>Bán thời gian, Minijob:</b> ưu tiên giờ đông và ngày đông (hệ số cao nhất của quán). Mỗi 30′ ngoài giờ đông bị cộng điểm phạt nhỏ.</li>
        </ul>
      </Section>

      <Section title="8. Thuật toán xếp lịch – các bước">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Hai quán lần lượt:</b> {profiles.map((p) => p.shortName).join(" trước, ")} sau. Ngày đã xếp cho người làm hai quán bị chặn ở quán sau.</li>
          <li><b>Giờ tuần của từng người:</b> hợp đồng tháng (bậc 30′) chia về các tuần theo hệ số × giờ làm của quán. Bỏ ngày trước khi vào làm và sau khi thôi làm.</li>
          <li><b>Giờ công mỗi ngày</b> theo mục 5, rồi <b>số người mục tiêu mỗi 30′</b> theo mục 6.</li>
          <li><b>Xếp từng người, từng tuần:</b> chọn ngày làm và độ dài ca (3–9h). Tuần rất ngắn ở đầu/cuối tháng (≤ 2 ngày) xếp trước. Một tuần được dùng ít giờ hơn phần của nó nếu nhờ vậy giữ được quy tắc cứng. Phần giờ còn lại được bù sang ngày khác ở bước 6.</li>
          <li><b>Chấm điểm mỗi phương án</b> từ nặng đến nhẹ: thiếu người ở quy tắc cứng → thiếu người ở quy tắc mềm → lệch số người mục tiêu → lệch giờ công ngày → ưu tiên theo loại → ca gãy.</li>
          <li><b>Sửa lại:</b> xếp lại từng tuần khi điểm tốt hơn. <b>Bù giờ còn thiếu</b>: kéo dài ca thêm 30′ ở chỗ ít làm lệch độ phủ nhất. <b>Chuyển ngày làm</b> sang ngày đang thiếu người cùng nhóm. <b>Dời giờ</b> giữa các ngày của cùng một người (tổng giờ tháng không đổi).</li>
          <li><b>Tinh chỉnh từng ngày:</b> dời giờ ca, dời giờ nghỉ theo số người thực tế, đổi người đóng cửa ở ngày mở liền.</li>
          <li><b>Kiểm tra:</b> luật, hợp đồng, ca, giờ nghỉ, độ phủ và trùng ngày giữa hai quán. Lỗi đỏ chặn in, cảnh báo vàng không chặn.</li>
        </ol>
        <p className="text-slate-600">Đây là thuật toán heuristic, không phải solver tối ưu toàn cục. Khi các mục tiêu không đạt cùng lúc, thuật toán giữ thứ tự ưu tiên ở đầu trang và báo rõ trong Độ phủ.</p>
      </Section>

      <Section title="9. Giờ nghỉ">
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

      <Section title="10. Cách dùng">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Chọn tháng ở đầu trang. Kiểm tra giờ làm, ngày lễ và ngày đặc biệt của từng quán trong <b>Menu → Cài đặt</b>.</li>
          <li>Kiểm tra nhóm, giờ hợp đồng, ngày vào làm, ngày thôi làm và người làm hai quán trong <b>Nhân viên</b> (từng quán).</li>
          <li>Bấm <b>Tạo lịch</b> (tạo cả hai quán). Xem <b>Độ phủ</b> (B = bếp, P = phục vụ/bồi, LX = lái xe) và các cảnh báo (i) của từng quán trước khi xuất PDF.</li>
          <li>Sau khi sửa tay một ca, xem lại Độ phủ và cảnh báo trùng ngày giữa hai quán rồi mới xuất bản in.</li>
        </ol>
      </Section>
    </div>
  );
}
