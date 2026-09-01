import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { updateCompany } from "@/lib/crm/companies";

type Params = { params: Promise<{ companyId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { companyId } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const company = await updateCompany(
    companyId,
    auth.workspaceId,
    {
      name: typeof payload.name === "string" ? payload.name : undefined,
      website: typeof payload.website === "string" ? payload.website : undefined,
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      address_line_1: typeof payload.address_line_1 === "string" ? payload.address_line_1 : undefined,
      address_line_2: typeof payload.address_line_2 === "string" ? payload.address_line_2 : undefined,
      city: typeof payload.city === "string" ? payload.city : undefined,
      state: typeof payload.state === "string" ? payload.state : undefined,
      postal_code: typeof payload.postal_code === "string" ? payload.postal_code : undefined,
      country: typeof payload.country === "string" ? payload.country : undefined,
      industry: typeof payload.industry === "string" ? payload.industry : undefined,
      notes: typeof payload.notes === "string" ? payload.notes : undefined,
      tags: Array.isArray(payload.tags) ? payload.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    },
    { actorUserId: auth.userId },
  );
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json({ company });
}
