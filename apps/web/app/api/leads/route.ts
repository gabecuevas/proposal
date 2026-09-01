import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole } from "@/lib/auth/request-context";
import { requireRequestAuth } from "@/lib/auth/require-request-auth";
import { leadContactDetailsError } from "@/lib/crm/contact-field-validation";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";
import { LeadValidationError, createLead, listLeads } from "@/lib/crm/leads";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
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
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  contact_title?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  color_label?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  assertRole(auth, "MEMBER");
  const body = (await request.json()) as CreateLeadBody;
  const validationMessage = leadContactDetailsError({
    first_name: body.first_name ?? "",
    last_name: body.last_name ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    contact_title: body.contact_title,
    website: body.website,
  });
  if (validationMessage) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: validationMessage,
    });
  }

  try {
    const lead = await createLead(auth.workspaceId, auth.userId, {
      title: body.title?.trim() ?? "",
      status: body.status,
      source: body.source,
      value_minor: body.value_minor,
      currency: body.currency,
      person_id: body.person_id,
      company_id: body.company_id,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      company_name: body.company_name,
      contact_title: body.contact_title,
      address_line_1: body.address_line_1,
      address_line_2: body.address_line_2,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country,
      website: body.website,
      notes: body.notes,
      tags: body.tags,
      color_label: body.color_label,
    });
    return jsonWithRequestId(request, { lead }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: error.message,
      });
    }
    console.error("createLead failed", error);
    return errorResponse(request, {
      status: 500,
      code: "internal_error",
      message: "Failed to save lead. Restart the dev server after database schema changes.",
    });
  }
}
