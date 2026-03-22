import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createContact, listContacts } from "@/lib/contacts/store";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const pagination = parseCursorPagination(request, 50);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const contacts = await listContacts(auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
    query: q,
    tag,
  });
  const page = getNextCursorFromTimestampPage(contacts, pagination.limit, (item) => item.updated_at);
  return jsonWithRequestId(request, { contacts: page.items, nextCursor: page.nextCursor });
}

type CreateContactBody = {
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
};

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const body = (await request.json()) as CreateContactBody;
  if (!body.first_name?.trim() || !body.last_name?.trim() || !body.email?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "first_name, last_name, and email are required",
    });
  }

  try {
    const contact = await createContact({
      workspaceId: auth.workspaceId,
      ownerUserId: auth.userId,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      company_name: body.company_name,
      title: body.title,
      address_line_1: body.address_line_1,
      address_line_2: body.address_line_2,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country,
      website: body.website,
      notes: body.notes,
      custom_fields_json: body.custom_fields_json,
      tags: body.tags,
      color_label: body.color_label,
    });
    return jsonWithRequestId(request, { contact }, { status: 201 });
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "contact_create_failed",
      message: "Failed to create contact",
    });
  }
}
