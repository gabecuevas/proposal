import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { convertLeadToContact, LeadValidationError } from "@/lib/crm/leads";

type Params = { params: Promise<{ leadId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { leadId } = await params;

  try {
    const result = await convertLeadToContact(leadId, auth.workspaceId, auth.userId);
    if (!result) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return jsonWithRequestId(request, result);
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
