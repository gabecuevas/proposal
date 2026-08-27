import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";
import { createLead, listLeads } from "@/lib/crm/leads";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const statusRaw = url.searchParams.get("status");
  const status = LEAD_STATUSES.includes(statusRaw as LeadStatus) ? (statusRaw as LeadStatus) : undefined;
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const leads = await listLeads(auth.workspaceId, {
    limit: Number.isFinite(limit) ? Math.min(200, Math.max(1, limit)) : 50,
    query: q,
    status,
  });
  return jsonWithRequestId(request, { leads });
}

type CreateLeadBody = {
  title?: string;
  status?: LeadStatus;
  source?: string;
  value_minor?: number | null;
  currency?: string;
  person_id?: string | null;
  company_id?: string | null;
  email?: string;
  phone?: string;
  notes?: string;
};

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const body = (await request.json()) as CreateLeadBody;
  if (!body.title?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "title is required",
    });
  }
  const lead = await createLead(auth.workspaceId, auth.userId, {
    title: body.title,
    status: body.status,
    source: body.source,
    value_minor: body.value_minor,
    currency: body.currency,
    person_id: body.person_id,
    company_id: body.company_id,
    email: body.email,
    phone: body.phone,
    notes: body.notes,
  });
  return jsonWithRequestId(request, { lead }, { status: 201 });
}
