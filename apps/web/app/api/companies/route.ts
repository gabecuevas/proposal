import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole } from "@/lib/auth/request-context";
import { requireRequestAuth } from "@/lib/auth/require-request-auth";
import { createCompany, listCompanies } from "@/lib/crm/companies";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const companies = await listCompanies(auth.workspaceId, {
    limit: Number.isFinite(limit) ? Math.min(200, Math.max(1, limit)) : 50,
    query: q,
  });
  return jsonWithRequestId(request, { companies });
}

type CreateCompanyBody = {
  name?: string;
  website?: string;
  phone?: string;
  email?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  industry?: string;
  notes?: string;
  tags?: string[];
};

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  assertRole(auth, "MEMBER");
  const body = (await request.json()) as CreateCompanyBody;
  if (!body.name?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "name is required",
    });
  }
  const company = await createCompany(auth.workspaceId, auth.userId, {
    name: body.name,
    website: body.website,
    phone: body.phone,
    email: body.email,
    address_line_1: body.address_line_1,
    address_line_2: body.address_line_2,
    city: body.city,
    state: body.state,
    postal_code: body.postal_code,
    country: body.country,
    industry: body.industry,
    notes: body.notes,
    tags: body.tags,
  });
  return jsonWithRequestId(request, { company }, { status: 201 });
}
