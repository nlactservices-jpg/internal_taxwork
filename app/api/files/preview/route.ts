import { NextResponse, type NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireUserApi } from "@/lib/session";
import { sql } from "@/lib/db";
import { r2, R2_BUCKET } from "@/lib/r2";
import { asciiFileName } from "@/lib/download";

export const runtime = "nodejs";

/**
 * Same-origin inline preview proxy for a stored file. Keeps private R2 objects
 * behind the app session and lets PDFs/images render in a browser tab instead
 * of being force-downloaded. Previews are intentionally not recorded as
 * downloads (the Files page's "ยังไม่โหลด" filter only clears on a real save).
 */
export async function GET(request: NextRequest) {
  const user = await requireUserApi();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const rows = (await sql`
    select storage_path, file_name, mime_type from files where id=${id} limit 1
  `) as { storage_path: string; file_name: string; mime_type: string | null }[];
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "file not found" }, { status: 404 });

  const range = request.headers.get("range") ?? undefined;
  let obj;
  try {
    obj = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: file.storage_path,
        Range: range,
      })
    );
  } catch {
    return NextResponse.json({ error: "object not found" }, { status: 404 });
  }

  const bytes = await obj.Body?.transformToByteArray();
  if (!bytes) return NextResponse.json({ error: "empty object" }, { status: 404 });

  const name = file.file_name || file.storage_path.split("/").pop() || "file";
  const headers: Record<string, string> = {
    "Content-Type": obj.ContentType ?? file.mime_type ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${asciiFileName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  if (obj.ContentLength != null) headers["Content-Length"] = String(obj.ContentLength);
  if (obj.ContentRange) headers["Content-Range"] = obj.ContentRange;

  return new NextResponse(new Uint8Array(bytes), {
    status: range && obj.ContentRange ? 206 : 200,
    headers,
  });
}
