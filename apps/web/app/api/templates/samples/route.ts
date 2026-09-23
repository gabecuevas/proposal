import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  countSampleTemplatesByFolder,
  listSampleTemplates,
} from "@/lib/editor/template-store";
import { SAMPLE_TEMPLATE_FOLDERS, isSampleFolderSlug } from "@/lib/templates/sample-catalog";
import { ensureMasterQuoteSampleTemplate } from "@/lib/templates/ensure-master-quote-sample";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    await ensureMasterQuoteSampleTemplate({
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
    });

    const url = new URL(request.url);
    const folder = url.searchParams.get("folder")?.trim() || null;
    const q = url.searchParams.get("q")?.trim() || undefined;

    if (folder && !isSampleFolderSlug(folder)) {
      return jsonWithRequestId(request, { error: "Unknown sample folder.", folders: [], templates: [] }, { status: 400 });
    }

    const [counts, templates] = await Promise.all([
      countSampleTemplatesByFolder(),
      listSampleTemplates({
        folderSlug: folder,
        query: q,
        limit: Number(url.searchParams.get("limit") ?? 200) || 200,
      }),
    ]);

    const folders = SAMPLE_TEMPLATE_FOLDERS.map((item) => ({
      ...item,
      template_count: counts[item.slug] ?? 0,
    }));

    return jsonWithRequestId(request, {
      folders,
      templates: folder ? templates.filter((item) => item.sample_folder_slug === folder) : templates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load sample templates";
    return jsonWithRequestId(request, { error: message, folders: [], templates: [] }, { status: 500 });
  }
}
