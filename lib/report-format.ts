/**
 * Shared, environment-agnostic formatting helpers for report presentation
 * (share page metadata, Open Graph images). Keep this module free of
 * server-only imports so it can run in any rendering context.
 */

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export type ReportFileNameParams = {
  periodLabel: string;
  clientName: string;
  avatarText?: string | null;
  reportLabel?: string | null;
  seq?: number | null;
  buddhistYear?: boolean;
};

function safeSegment(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\r\n]/g, "-")
      .trim()
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 120) || "file"
  );
}

function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
}

function latinInitials(name: string): string {
  const skip = /^(co|ltd|inc|company|ห้าง|บริษัท|จำกัด)$/i;
  return name
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word) && !skip.test(word))
    .map((word) => word[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
}

/**
 * Client-facing report filename, grouped by client code then period:
 * `DTN_2569-10_รายงานภาษี_ครั้งที่ 1.pdf`.
 */
export function reportExportFileName(params: ReportFileNameParams): string {
  const [year, month] = params.periodLabel.split("-").map(Number);
  const displayYear = year && params.buddhistYear !== false ? year + 543 : year;
  const periodKey =
    year && month
      ? `${displayYear}-${String(month).padStart(2, "0")}`
      : safeSegment(params.periodLabel);

  const code =
    normalizeCode(params.avatarText) ||
    latinInitials(params.clientName) ||
    safeSegment(params.clientName).slice(0, 4) ||
    "ไม่ระบุลูกค้า";
  const round =
    params.reportLabel?.trim() || (params.seq ? `ครั้งที่ ${params.seq}` : "");

  const parts = [code, periodKey, "รายงานภาษี", round]
    .filter(Boolean)
    .map(safeSegment);
  return `${parts.join("_")}.pdf`;
}

/** "2026-08" -> "สิงหาคม 2569" (falls back to the raw label). */
export function periodToThai(periodLabel: string): string {
  const [y, m] = periodLabel.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return periodLabel;
  return `${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** Amount with thousands separators and exactly two decimals. */
export function formatBaht(n: number): string {
  return Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mask the local part of an email address for display: "somchai@example.com"
 * -> "so*****@example.com". The domain is kept so staff can still recognise
 * the recipient, while the full address is only shown when explicitly revealed.
 */
export function maskEmail(email: string): string {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  const masked = "*".repeat(Math.max(3, local.length - visible.length));
  return `${visible}${masked}@${domain}`;
}
