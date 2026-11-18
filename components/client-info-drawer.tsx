"use client";

import type { Client, Credential } from "@/lib/actions/clients";
import Badge from "@/components/badge";
import ClientAvatar from "@/components/client-avatar";
import ClientCodeBadge from "@/components/client-code-badge";
import CopyButton from "@/components/copy-button";
import Drawer from "@/components/drawer";
import EmptyState from "@/components/empty-state";
import Link from "next/link";

function InfoRow({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: string | null | undefined;
  copy?: boolean;
}) {
  const text = value?.trim() || "—";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs font-medium text-neutral-500">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-1 text-right text-sm text-neutral-800">
        <span className="min-w-0 break-words">{text}</span>
        {copy && value?.trim() && <CopyButton text={value.trim()} />}
      </span>
    </div>
  );
}

export default function ClientInfoDrawer({
  client,
  credentials,
  loading,
  error,
  onClose,
}: {
  client: Client | null;
  credentials: Credential[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  if (!client) return null;

  return (
    <Drawer
      open
      onClose={onClose}
      title="ข้อมูลลูกค้า"
      footer={
        <>
          <Link className="btn" href={`/clients/${client.id}`}>
            เปิดหน้าลูกค้า
          </Link>
          <button className="btn-primary" onClick={onClose}>
            ปิด
          </button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
      <section>
        <div className="flex items-start gap-3">
          <ClientAvatar
            name={client.name}
            text={client.avatar_text}
            color={client.avatar_color}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-neutral-900">
                {client.name}
              </h3>
              <ClientCodeBadge code={client.avatar_text} />
            </div>
            <div className="mt-1">
              <Badge tone={client.status === "active" ? "success" : "neutral"}>
                {client.status === "active" ? "ใช้งาน" : "เก็บถาวร"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <InfoRow label="รหัสลูกค้า" value={client.avatar_text} copy />
          <InfoRow label="เลขผู้เสียภาษี" value={client.tax_id} copy />
          <InfoRow label="โทรศัพท์" value={client.phone} copy />
          <InfoRow label="อีเมล" value={client.email} copy />
          <InfoRow label="ที่อยู่" value={client.address} copy />
          <InfoRow label="หมายเหตุ" value={client.notes} copy />
        </div>
      </section>

      <section>
        <h3 className="mb-2 border-b border-neutral-200 pb-1.5 text-sm font-semibold text-neutral-800">
          ข้อมูลเข้าระบบ
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : credentials.length === 0 ? (
          <EmptyState title="ยังไม่มีข้อมูลเข้าระบบ" hint="เพิ่มข้อมูลเข้าระบบได้ที่หน้าลูกค้า" />
        ) : (
          <div className="space-y-2">
            {credentials.map((cred) => (
              <div key={cred.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-neutral-800">{cred.label}</h4>
                  {cred.portal_url && /^https?:\/\//i.test(cred.portal_url) && (
                    <a
                      href={cred.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      เปิดเว็บ ↗
                    </a>
                  )}
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-500">ผู้ใช้</span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 break-all text-neutral-800">{cred.username || "—"}</span>
                      {cred.username && <CopyButton text={cred.username} />}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-500">รหัสผ่าน</span>
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 break-all font-mono text-neutral-800">
                        {cred.password || "—"}
                      </span>
                      {cred.password && <CopyButton text={cred.password} />}
                    </span>
                  </div>
                  {cred.notes && (
                    <p className="pt-1 text-xs text-neutral-600">{cred.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </Drawer>
  );
}
