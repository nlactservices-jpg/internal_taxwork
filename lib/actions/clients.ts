"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  isValidClientCode,
  normalizeClientCode,
  suggestClientCode as suggestCode,
} from "@/lib/client-avatar";
import { reportExportFileName } from "@/lib/report-format";
import { buildUpdate, num } from "./db-helpers";

export type Client = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  avatar_text: string | null;
  avatar_color: string | null;
  created_at: string;
};

export type Credential = {
  id: string;
  label: string;
  username: string | null;
  password: string | null;
  portal_url: string | null;
  notes: string | null;
};

export type TaskInstance = {
  id: string;
  title: string;
  period_label: string;
  due_date: string;
  status: string;
};

export type Shareholder = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  shares: number | null;
  is_director: boolean;
  notes: string | null;
};

export type ClientForm = {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
  avatar_text?: string;
};
export type CredentialForm = { label: string; username: string; password: string; portal_url: string; notes: string };
export type ShareholderForm = {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
  shares: string;
  is_director: boolean;
  notes: string;
};

/** Postgres date/timestamptz may arrive as Date over HTTP — UI renders them as strings. */
function str(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

const CLIENT_EDITABLE = [
  "name",
  "tax_id",
  "email",
  "phone",
  "address",
  "notes",
  "avatar_text",
  "avatar_color",
];

export async function listClients(): Promise<Client[]> {
  await requireUser();
  const rows = (await sql`select * from clients order by name`) as Client[];
  return rows.map((r) => ({ ...r, created_at: str(r.created_at) }));
}

export async function listCredentials(clientId: string): Promise<Credential[]> {
  await requireUser();
  return (await sql`select id, label, username, password, portal_url, notes from credentials where client_id=${clientId} order by label`) as Credential[];
}

export async function checkClientCodeAvailable(
  code: string,
  excludeId?: string
): Promise<boolean> {
  await requireUser();
  const normalized = normalizeClientCode(code);
  if (!isValidClientCode(normalized)) return false;
  const rows = excludeId
    ? await sql`select 1 from clients where upper(avatar_text)=${normalized} and id<>${excludeId} limit 1`
    : await sql`select 1 from clients where upper(avatar_text)=${normalized} limit 1`;
  return rows.length === 0;
}

export async function suggestClientCode(name: string): Promise<string> {
  await requireUser();
  const rows = (await sql`select avatar_text from clients where avatar_text is not null`) as {
    avatar_text: string | null;
  }[];
  return suggestCode(name, rows.map((r) => r.avatar_text));
}

export async function createClient(form: ClientForm): Promise<void> {
  await requireUser();
  let code = normalizeClientCode(form.avatar_text);
  if (!code) {
    const rows = (await sql`select avatar_text from clients where avatar_text is not null`) as {
      avatar_text: string | null;
    }[];
    code = suggestCode(form.name, rows.map((r) => r.avatar_text));
  }
  if (!isValidClientCode(code)) throw new Error("ตัวย่อลูกค้าไม่ถูกต้อง (A-Z 0-9 ไม่เกิน 4 ตัว)");
  const taken = await sql`select 1 from clients where upper(avatar_text)=${code} limit 1`;
  if (taken.length) throw new Error("ตัวย่อลูกค้านี้ถูกใช้แล้ว");

  await sql`insert into clients (name, tax_id, email, phone, address, avatar_text)
    values (${form.name}, ${form.tax_id}, ${form.email}, ${form.phone}, ${form.address}, ${code})`;
}

export async function getClientDetail(id: string): Promise<{
  client: Client | null;
  credentials: Credential[];
  tasks: TaskInstance[];
  shareholders: Shareholder[];
}> {
  await requireUser();
  const [c, creds, t, shs] = await Promise.all([
    sql`select * from clients where id=${id}`,
    sql`select * from credentials where client_id=${id} order by label`,
    sql`select * from task_instances where client_id=${id} order by due_date desc`,
    sql`select * from shareholders where client_id=${id} order by name`,
  ]);
  const client = (c[0] as Client | undefined) ?? null;
  return {
    client: client ? { ...client, created_at: str(client.created_at) } : null,
    credentials: creds as Credential[],
    tasks: (t as TaskInstance[]).map((x) => ({ ...x, due_date: str(x.due_date).slice(0, 10) })),
    shareholders: (shs as Shareholder[]).map((x) => ({ ...x, shares: x.shares == null ? null : num(x.shares) })),
  };
}

export async function updateClient(id: string, edit: Record<string, string | null | undefined>): Promise<void> {
  await requireUser();
  const before = (await sql`select avatar_text from clients where id=${id}`) as {
    avatar_text: string | null;
  }[];
  const patch = { ...edit };
  if (typeof patch.avatar_text === "string") {
    const code = normalizeClientCode(patch.avatar_text);
    if (!isValidClientCode(code)) throw new Error("ตัวย่อลูกค้าไม่ถูกต้อง (A-Z 0-9 ไม่เกิน 4 ตัว)");
    const taken = await sql`select 1 from clients where upper(avatar_text)=${code} and id<>${id} limit 1`;
    if (taken.length) throw new Error("ตัวย่อลูกค้านี้ถูกใช้แล้ว");
    patch.avatar_text = code;
  }
  const { text, params } = buildUpdate("clients", id, patch as Record<string, unknown>, CLIENT_EDITABLE);
  await sql.query(text, params);

  if (patch.avatar_text && before[0]?.avatar_text !== patch.avatar_text) {
    const rows = (await sql`
      select f.id, c.name, c.avatar_text, r.period_label, r.label, r.seq
      from files f
      join monthly_reports r on r.id=f.report_id
      join clients c on c.id=f.client_id
      where f.client_id=${id}
    `) as {
      id: string;
      name: string;
      avatar_text: string | null;
      period_label: string;
      label: string | null;
      seq: number | null;
    }[];
    for (const row of rows) {
      const fileName = reportExportFileName({
        periodLabel: row.period_label,
        clientName: row.name,
        avatarText: row.avatar_text,
        reportLabel: row.label,
        seq: row.seq,
      });
      await sql`update files set file_name=${fileName} where id=${row.id}`;
    }
  }
}

export async function deleteClient(id: string): Promise<void> {
  await requireUser();
  await sql`delete from clients where id=${id}`;
}

export async function addCredential(clientId: string, cred: CredentialForm): Promise<void> {
  await requireUser();
  await sql`insert into credentials (client_id, label, username, password, portal_url, notes)
    values (${clientId}, ${cred.label}, ${cred.username}, ${cred.password}, ${cred.portal_url}, ${cred.notes})`;
}

export async function deleteCredential(cid: string): Promise<void> {
  await requireUser();
  await sql`delete from credentials where id=${cid}`;
}

const CRED_EDITABLE = ["label", "username", "password", "portal_url", "notes"];

export async function updateCredential(cid: string, cred: CredentialForm): Promise<void> {
  await requireUser();
  const { text, params } = buildUpdate("credentials", cid, cred as Record<string, unknown>, CRED_EDITABLE);
  await sql.query(text, params);
}

export async function addShareholder(clientId: string, sh: ShareholderForm): Promise<void> {
  await requireUser();
  const shares = sh.shares === "" ? null : Number(sh.shares);
  const inserted = (await sql`insert into shareholders (client_id, name, tax_id, email, phone, address, shares, is_director, notes)
    values (${clientId}, ${sh.name}, ${sh.tax_id}, ${sh.email}, ${sh.phone}, ${sh.address}, ${shares}, ${sh.is_director}, ${sh.notes})
    returning id, is_director`) as { id: string; is_director: boolean }[];
  if (inserted[0]?.is_director) {
    await sql`update shareholders set is_director=false where client_id=${clientId} and id<>${inserted[0].id}`;
  }
}

export async function deleteShareholder(sid: string): Promise<void> {
  await requireUser();
  await sql`delete from shareholders where id=${sid}`;
}

export async function setDirector(clientId: string, shId: string): Promise<void> {
  await requireUser();
  await sql`update shareholders set is_director=true where id=${shId}`;
  await sql`update shareholders set is_director=false where client_id=${clientId} and id<>${shId}`;
}

export async function toggleTaskStatus(taskId: string, status: string): Promise<void> {
  await requireUser();
  const completedAt = status === "done" ? new Date().toISOString() : null;
  await sql`update task_instances set status=${status}, completed_at=${completedAt} where id=${taskId}`;
}
