import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { LeadValidationError, updateLead } from "@/lib/crm/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";

type Params = { params: Promise<{ leadId: string }> };

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { leadId } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const status =
    typeof payload.status === "string" && LEAD_STATUSES.includes(payload.status as LeadStatus)
      ? (payload.status as LeadStatus)
      : undefined;
  try {
    const lead = await updateLead(
      leadId,
      auth.workspaceId,
      {
        title: optionalString(payload.title),
        status,
        source: optionalString(payload.source),
        value_minor:
          typeof payload.value_minor === "number"
            ? payload.value_minor
            : payload.value_minor === null
              ? null
              : undefined,
        currency: optionalString(payload.currency),
        person_id:
          typeof payload.person_id === "string" || payload.person_id === null ? payload.person_id : undefined,
        company_id:
          typeof payload.company_id === "string" || payload.company_id === null ? payload.company_id : undefined,
        first_name: optionalString(payload.first_name),
        last_name: optionalString(payload.last_name),
        email: optionalString(payload.email),
        phone: optionalString(payload.phone),
        company_name: optionalString(payload.company_name),
        contact_title: optionalString(payload.contact_title),
        address_line_1: optionalString(payload.address_line_1),
        address_line_2: optionalString(payload.address_line_2),
        city: optionalString(payload.city),
        state: optionalString(payload.state),
        postal_code: optionalString(payload.postal_code),
        country: optionalString(payload.country),
        website: optionalString(payload.website),
        notes: optionalString(payload.notes),
        color_label: optionalString(payload.color_label),
        tags: Array.isArray(payload.tags)
          ? payload.tags.filter((tag): tag is string => typeof tag === "string")
          : undefined,
      },
      { actorUserId: auth.userId },
    );
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: error.message,
      });
    }
    throw error;
  }
}
