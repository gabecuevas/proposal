import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { countContacts } from "@/lib/contacts/store";
import { countCompanies } from "@/lib/crm/companies";
import { countUnreadInbox } from "@/lib/crm/emails";
import { countLeads } from "@/lib/crm/leads";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const [leads, people, companies, inbox] = await Promise.all([
    countLeads(auth.workspaceId),
    countContacts(auth.workspaceId),
    countCompanies(auth.workspaceId),
    countUnreadInbox(auth.workspaceId),
  ]);
  return jsonWithRequestId(request, { counts: { leads, people, companies, inbox } });
}
