// One-off backfill: normalize/assign unique client codes.
// Usage: node scripts/backfill-client-codes.mjs [--apply]
// Reads DATABASE_URL from env or .env.local. Dry-run by default.

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

function normalize(raw) {
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
function suggest(name, used) {
  const base = initials(name);
  if (base && !used.has(base)) return base;
  if (base) {
    for (let i = 1; i <= 9; i++) {
      const candidate = `${base}${i}`.slice(0, 4);
      if (!used.has(candidate)) return candidate;
    }
  }
  for (let i = 1; i <= 9999; i++) {
    const candidate = `C${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("no free client code");
}

const clients = await sql`select id, name, avatar_text from clients order by name`;
const used = new Set();
const plan = [];
for (const client of clients) {
  let code = normalize(client.avatar_text);
  if (!code || used.has(code)) code = suggest(client.name, used);
  used.add(code);
  if (code !== normalize(client.avatar_text)) {
    plan.push({ id: client.id, name: client.name, from: client.avatar_text || "", to: code });
  }
}

console.log(`Clients: ${clients.length}, to update: ${plan.length}`);
if (plan.length) console.table(plan);
if (!apply) {
  console.log("Dry run. Re-run with --apply to write.");
} else {
  for (const row of plan) {
    await sql`update clients set avatar_text=${row.to} where id=${row.id}`;
  }
  console.log("Applied.");
}
