export default function ClientCodeBadge({ code }: { code: string | null }) {
  if (!code) {
    return (
      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
        ไม่มีรหัส
      </span>
    );
  }
  return (
    <span
      className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700"
      title="รหัสลูกค้า (ตัวย่อ)"
    >
      {code}
    </span>
  );
}
