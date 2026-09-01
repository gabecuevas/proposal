import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { duplicateSearchReady, findDuplicates, type DuplicateField } from "@/lib/crm/duplicate-search";

const FIELDS: DuplicateField[] = ["email", "phone", "name"];

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  const field = url.searchParams.get("field") as DuplicateField | null;
  const value = url.searchParams.get("value") ?? "";

  if (!field || !FIELDS.includes(field)) {
    return jsonWithRequestId(request, { matches: [] });
  }

  if (!duplicateSearchReady(field, value)) {
    return jsonWithRequestId(request, { matches: [] });
  }

  const matches = await findDuplicates(auth.workspaceId, field, value, {
    excludeContactId: url.searchParams.get("excludeContactId") ?? undefined,
    excludeCompanyId: url.searchParams.get("excludeCompanyId") ?? undefined,
    excludeLeadId: url.searchParams.get("excludeLeadId") ?? undefined,
  });

  return jsonWithRequestId(request, { matches });
}
