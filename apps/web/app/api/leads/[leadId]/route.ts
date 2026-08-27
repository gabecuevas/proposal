import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { updateLead } from "@/lib/crm/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";

type Params = { params: Promise<{ leadId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { leadId } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const status =
    typeof payload.status === "string" && LEAD_STATUSES.includes(payload.status as LeadStatus)
      ? (payload.status as LeadStatus)
      : undefined;
  const lead = await updateLead(leadId, auth.workspaceId, {
    title: typeof payload.title === "string" ? payload.title : undefined,
    status,
    source: typeof payload.source === "string" ? payload.source : undefined,
    value_minor: typeof payload.value_minor === "number" ? payload.value_minor : payload.value_minor === null ? null : undefined,
    currency: typeof payload.currency === "string" ? payload.currency : undefined,
    person_id: typeof payload.person_id === "string" || payload.person_id === null ? payload.person_id : undefined,
    company_id: typeof payload.company_id === "string" || payload.company_id === null ? payload.company_id : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    phone: typeof payload.phone === "string" ? payload.phone : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : undefined,
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}
