"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createClient,
  updateClient,
  type Client,
} from "@/lib/actions/clients";
import {
  isValidClientCode,
  normalizeClientCode,
  suggestClientCode,
} from "@/lib/client-avatar";
import { useClientFavorites } from "@/lib/use-client-favorites";
import ClientAvatar from "@/components/client-avatar";
import ClientCodeBadge from "@/components/client-code-badge";
import Badge from "@/components/badge";
import SearchInput from "@/components/search-input";
import EmptyState from "@/components/empty-state";
import Modal from "@/components/modal";
import PageHeader from "@/components/page-header";
import { ToastStack, useToasts } from "@/components/toast";

type SortKey = "name" | "tax_id" | "created_at" | "avatar_text";

const SORT_LABELS: Record<SortKey, string> = {
  name: "ชื่อ",
  avatar_text: "รหัสลูกค้า",
  tax_id: "เลขผู้เสียภาษี",
  created_at: "วันที่เพิ่ม",
};

const STATUS_TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "ใช้งาน" },
  { key: "archived", label: "เก็บถาวร" },
] as const;

const emptyForm = {
  name: "",
  avatar_text: "",
  tax_id: "",
  email: "",
  phone: "",
  address: "",
};

export default function ClientsView({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const { favorites, toggleFav } = useClientFavorites();
  const { toasts, push, dismiss } = useToasts();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const sort = (searchParams.get("sort") ?? "name") as SortKey;
  const dir = searchParams.get("dir") ?? "asc";
  const favOnly = searchParams.get("fav") === "1";

  const [searchText, setSearchText] = useState(q);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => setClients(initialClients), [initialClients]);
  useEffect(() => setSearchText(q), [q]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === "all" || value === "name" || value === "asc") next.delete(key);
      else next.set(key, value);
      router.replace(`/clients?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (searchText === q) return;
    const timer = window.setTimeout(() => setParam("q", searchText), 250);
    return () => window.clearTimeout(timer);
  }, [searchText, q, setParam]);

  const takenCodes = useMemo(
    () =>
      clients
        .filter((c) => c.id !== editingId)
        .map((c) => c.avatar_text),
    [clients, editingId]
  );
  const suggestion = useMemo(
    () => (form.name.trim() ? suggestClientCode(form.name, takenCodes) : ""),
    [form.name, takenCodes]
  );

  const filtered = useMemo(() => {
    let rows = [...clients];
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((c) =>
        [c.name, c.tax_id, c.email, c.phone, c.address, c.avatar_text]
          .some((v) => (v ?? "").toLowerCase().includes(needle))
      );
    }
    if (status !== "all") rows = rows.filter((c) => c.status === status);
    if (favOnly) rows = rows.filter((c) => favorites.includes(c.id));

    rows.sort((a, b) => {
      let cmp = 0;
      if (sort === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = (a[sort] ?? "").localeCompare(b[sort] ?? "", "th");
      }
      return dir === "desc" ? -cmp : cmp;
    });
    return rows;
  }, [clients, q, status, favOnly, favorites, sort, dir]);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setForm({
      name: client.name,
      avatar_text: client.avatar_text ?? "",
      tax_id: client.tax_id ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
    });
    setEditingId(client.id);
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !isValidClientCode(form.avatar_text)) {
      setFormError("กรอกชื่อและรหัสลูกค้า (A-Z 0-9 ไม่เกิน 4 ตัว)");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        avatar_text: normalizeClientCode(form.avatar_text),
      };
      if (editingId) await updateClient(editingId, payload);
      else await createClient(payload);
      closeForm();
      router.refresh();
      push({
        type: "success",
        message: editingId ? "บันทึกข้อมูลลูกค้าแล้ว" : `เพิ่มลูกค้า "${payload.name}" แล้ว (รหัส ${payload.avatar_text})`,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const statusTone = (s: string) => (s === "active" ? "success" : "neutral");
  const statusLabel = (s: string) => (s === "active" ? "ใช้งาน" : "เก็บถาวร");

  return (
    <>
      <PageHeader
        title="ลูกค้า"
        subtitle="จัดการข้อมูลลูกค้า รหัสลูกค้า และข้อมูลติดต่อ"
        meta={
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {clients.length} ราย
          </span>
        }
        actions={
          <button className="btn-primary" onClick={openAdd}>
            + เพิ่มลูกค้า
          </button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="ค้นหาชื่อ รหัส เลขภาษี อีเมล โทรศัพท์..."
          />
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setParam("status", t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={favOnly ? "btn-primary px-2 py-1 text-xs" : "btn px-2 py-1 text-xs"}
            onClick={() => setParam("fav", favOnly ? "" : "1")}
            aria-pressed={favOnly}
          >
            ★ โปรด
          </button>
          <select
            className="input w-auto"
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            aria-label="เรียงตาม"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>เรียงตาม: {SORT_LABELS[k]}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => setParam("dir", dir === "asc" ? "desc" : "asc")}
            title={dir === "asc" ? "น้อยไปมาก" : "มากไปน้อย"}
          >
            {dir === "asc" ? "↑" : "↓"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          {q || status !== "all" || favOnly ? `พบ ${filtered.length} ราย` : `แสดง ${filtered.length} ราย`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <EmptyState
            title={clients.length ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีลูกค้า"}
            hint={clients.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เริ่มจากเพิ่มลูกค้า"}
            action={!clients.length ? <button className="btn-primary" onClick={openAdd}>เพิ่มลูกค้า</button> : undefined}
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white md:block">
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>ลูกค้า</th>
                  <th className="w-56">ติดต่อ</th>
                  <th className="w-28">สถานะ</th>
                  <th className="w-36 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td>
                      <button
                        type="button"
                        className={favorites.includes(c.id) ? "text-lg leading-none text-yellow-500" : "text-lg leading-none text-neutral-300 hover:text-yellow-500"}
                        onClick={() => toggleFav(c.id)}
                        aria-label={favorites.includes(c.id) ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
                        aria-pressed={favorites.includes(c.id)}
                      >
                        ★
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <ClientAvatar name={c.name} text={c.avatar_text} color={c.avatar_color} size="sm" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/clients/${c.id}`} className="font-medium text-blue-700 hover:underline">
                              {c.name}
                            </Link>
                            <ClientCodeBadge code={c.avatar_text} />
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {c.tax_id ? `เลขภาษี ${c.tax_id}` : "ยังไม่มีเลขผู้เสียภาษี"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5 text-sm">
                        {c.phone && <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="truncate text-blue-600 hover:underline">{c.email}</a>}
                        {!c.phone && !c.email && <span className="text-neutral-400">—</span>}
                      </div>
                    </td>
                    <td><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge></td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <Link className="btn px-2 py-1 text-xs" href={`/clients/${c.id}`}>เปิด</Link>
                        <button className="btn px-2 py-1 text-xs" onClick={() => openEdit(c)}>แก้ไข</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ClientAvatar name={c.name} text={c.avatar_text} color={c.avatar_color} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/clients/${c.id}`} className="font-medium text-blue-700">{c.name}</Link>
                      <ClientCodeBadge code={c.avatar_text} />
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {c.tax_id ? `เลขภาษี ${c.tax_id}` : "ยังไม่มีเลขผู้เสียภาษี"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={favorites.includes(c.id) ? "text-lg leading-none text-yellow-500" : "text-lg leading-none text-neutral-300"}
                    onClick={() => toggleFav(c.id)}
                    aria-label="รายการโปรด"
                    aria-pressed={favorites.includes(c.id)}
                  >
                    ★
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>
                  {c.phone && <a href={`tel:${c.phone}`} className="text-blue-600">{c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="truncate text-blue-600">{c.email}</a>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link className="btn flex-1 text-center" href={`/clients/${c.id}`}>เปิด</Link>
                  <button className="btn flex-1" onClick={() => openEdit(c)}>แก้ไข</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"}
        footer={
          <>
            <button type="button" className="btn" onClick={closeForm} disabled={submitting}>
              ยกเลิก
            </button>
            <button type="submit" form="client-form" className="btn-primary" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </>
        }
      >
        <form id="client-form" onSubmit={save} className="space-y-3">
          {formError && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{formError}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">ชื่อบริษัท *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">รหัสลูกค้า * (A-Z 0-9 ไม่เกิน 4 ตัว)</label>
              <input
                className="input max-w-[9rem] uppercase"
                required
                maxLength={4}
                value={form.avatar_text}
                onChange={(e) => setForm({ ...form, avatar_text: normalizeClientCode(e.target.value) })}
                placeholder={suggestion || "DTN"}
              />
              {suggestion && suggestion !== form.avatar_text && (
                <button
                  type="button"
                  className="mt-1 text-xs text-blue-600 hover:underline"
                  onClick={() => setForm({ ...form, avatar_text: suggestion })}
                >
                  ใช้รหัสที่แนะนำ: {suggestion}
                </button>
              )}
            </div>
            <div>
              <label className="label">เลขผู้เสียภาษี</label>
              <input className="input" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            </div>
            <div>
              <label className="label">อีเมล</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">โทรศัพท์</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ที่อยู่</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            รหัสลูกค้าใช้แสดงบนไอคอนและใช้ในชื่อไฟล์รายงาน เช่น {form.avatar_text || "DTN"}_2569-10_รายงานภาษี_ครั้งที่ 1.pdf
          </p>
        </form>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
