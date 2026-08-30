import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { updateContact } from "@/lib/contacts/store";
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
  const contact = await updateContact(contactId, auth.workspaceId, payload);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  return NextResponse.json({ contact });
}
