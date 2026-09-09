import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { ContactDuplicateError, deleteContact, updateContact } from "@/lib/contacts/store";
import { firstContactDetailsError } from "@/lib/crm/contact-field-validation";

type Params = { params: Promise<{ contactId: string }> };

type UpdateContactBody = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  title?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  website?: string;
  notes?: string;
  custom_fields_json?: Record<string, unknown>;
  tags?: string[];
  color_label?: string;
  company_id?: string | null;
  source?: string | null;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { contactId } = await params;
  const payload = (await request.json()) as UpdateContactBody;
  const validationMessage = firstContactDetailsError({
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    title: payload.title,
    website: payload.website,
  });
  if (validationMessage) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: validationMessage,
    });
  }
  try {
    const contact = await updateContact(contactId, auth.workspaceId, payload, { actorUserId: auth.userId });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    return NextResponse.json({ contact });
  } catch (error) {
    if (error instanceof ContactDuplicateError) {
      return errorResponse(request, {
        status: 409,
        code: "contact_duplicate",
        message: error.message,
      });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { contactId } = await params;
  const result = await deleteContact(contactId, auth.workspaceId);
  if (!result.ok && result.reason === "not_found") {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Contact not found",
    });
  }
  if (!result.ok && result.reason === "active_documents") {
    return errorResponse(request, {
      status: 409,
      code: "contact_active_documents",
      message: "Unable to Delete Contacts with Active Documents",
    });
  }
  return NextResponse.json({ ok: true });
}
