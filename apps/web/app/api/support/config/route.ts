import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { isSupportMessengerEnabled } from "@/lib/support/flags";

export async function GET(request: NextRequest) {
  return jsonWithRequestId(request, {
    messengerEnabled: isSupportMessengerEnabled(),
  });
}
