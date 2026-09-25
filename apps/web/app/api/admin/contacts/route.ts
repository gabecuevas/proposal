import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import {
  exportContactsCsv,
  parseContactFilters,
  searchPlatformContacts,
  type ContactSortField,
} from "@/lib/support/contacts";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";
import { prisma } from "@repo/db";

export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const search = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
  const sort = (url.searchParams.get("sort") ?? "last_active_at") as ContactSortField;
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const filters = parseContactFilters(url.searchParams);

  if (format === "csv") {
    const csv = await exportContactsCsv({ search, filters });
    await prisma.supportAuditEvent.create({
      data: {
        actor_user_id: admin.userId,
        action: "contacts.export_csv",
        target_type: "User",
        metadata_json: { search: search ?? null, ...filters },
      },
    });
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="platform-contacts-${Date.now()}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const result = await searchPlatformContacts({
    search,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    sort,
    sortDir,
    filters,
  });

  return jsonWithRequestId(request, result);
}
