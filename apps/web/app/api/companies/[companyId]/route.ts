import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { updateCompany } from "@/lib/crm/companies";
import { parsePhones, primaryPhoneNumber } from "@/lib/crm/phones";

type Params = { params: Promise<{ companyId: string }> };

function optionalStringOrNull(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "MEMBER");
    const { companyId } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    const phones = Array.isArray(payload.phones) ? parsePhones(payload.phones) : undefined;
    const phone =
      phones !== undefined
        ? (primaryPhoneNumber(phones) ?? "")
        : optionalStringOrNull(payload.phone) ?? undefined;
    const company = await updateCompany(
      companyId,
      auth.workspaceId,
      {
        name: typeof payload.name === "string" ? payload.name : undefined,
        website: optionalStringOrNull(payload.website) ?? undefined,
        linkedin:
          payload.linkedin === null
            ? ""
            : typeof payload.linkedin === "string"
              ? payload.linkedin
              : undefined,
        phone,
        phones,
        email: optionalStringOrNull(payload.email) ?? undefined,
        address_line_1: optionalStringOrNull(payload.address_line_1) ?? undefined,
        address_line_2: optionalStringOrNull(payload.address_line_2) ?? undefined,
        city: optionalStringOrNull(payload.city) ?? undefined,
        state: optionalStringOrNull(payload.state) ?? undefined,
        postal_code: optionalStringOrNull(payload.postal_code) ?? undefined,
        country: optionalStringOrNull(payload.country) ?? undefined,
        industry: optionalStringOrNull(payload.industry) ?? undefined,
        notes: optionalStringOrNull(payload.notes) ?? undefined,
        tags: Array.isArray(payload.tags)
          ? payload.tags.filter((tag): tag is string => typeof tag === "string")
          : undefined,
        primary_contact_id:
          payload.primary_contact_id === null
            ? null
            : typeof payload.primary_contact_id === "string"
              ? payload.primary_contact_id
              : undefined,
      },
      { actorUserId: auth.userId },
    );
    if (!company) {
      return errorResponse(request, {
        status: 404,
        code: "not_found",
        message: "Company not found",
      });
    }
    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save company";
    if (message === "Unauthorized") {
      return errorResponse(request, { status: 401, code: "unauthorized", message });
    }
    if (message === "Forbidden") {
      return errorResponse(request, { status: 403, code: "forbidden", message });
    }
    return errorResponse(request, {
      status: 500,
      code: "company_update_failed",
      message: message || "Failed to save company",
    });
  }
}
