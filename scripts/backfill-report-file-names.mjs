// One-off backfill: rename archived monthly-report PDF display names to the
// sortable client-code format. Storage paths are never changed.
// Usage: node scripts/backfill-report-file-names.mjs [--apply]

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local
  }
}
loadEnv();

const sql = neon(process.env.DATABASE_URL);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const apply = process.argv.includes("--apply");

function safe(value) {
  return (
    String(value ?? "")
      .replace(/[\\/:*?"<>|\r\n]/g, "-")
      .trim()
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 120) || "file"
  );
}
function normalizeCode(raw) {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
}
function initials(name) {
  const skip = /^(co|ltd|inc|company|ห้าง|บริษัท|จำกัด)$/i;
  return (name ?? "")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !skip.test(w))
    .map((w) => w[0].toUpperCase())
    .join("")
    .slice(0, 3);
}
function fileName(row) {
  const [year, month] = String(row.period_label).split("-").map(Number);
  const period = year && month ? `${year + 543}-${String(month).padStart(2, "0")}` : safe(row.period_label);
  const code = normalizeCode(row.avatar_text) || initials(row.name) || safe(row.name).slice(0, 4) || "ไม่ระบุลูกค้า";
  const round = row.label?.trim() || (row.seq ? `ครั้งที่ ${row.seq}` : "");
  return `${[code, period, "รายงานภาษี", round].filter(Boolean).map(safe).join("_")}.pdf`;
}

const rows = await sql`
  select f.id, f.file_name, c.name, c.avatar_text, r.period_label, r.label, r.seq
  from files f
  join monthly_reports r on r.id=f.report_id
  join clients c on c.id=f.client_id
  where f.category='monthly-report'
`;
const plan = rows
  .map((row) => ({ id: row.id, from: row.file_name, to: fileName(row) }))
  .filter((row) => row.from !== row.to);

console.log(`Monthly-report files: ${rows.length}, to rename: ${plan.length}`);
if (plan.length) console.table(plan.slice(0, 50));
if (!apply) {
  console.log("Dry run. Re-run with --apply to write.");
} else {
  for (const row of plan) {
    await sql`update files set file_name=${row.to} where id=${row.id}`;
  }
  console.log("Applied.");
}
