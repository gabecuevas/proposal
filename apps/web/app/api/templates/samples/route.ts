import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  countSampleTemplatesByFolder,
  listSampleTemplates,
} from "@/lib/editor/template-store";
import { SAMPLE_TEMPLATE_FOLDERS, isSampleFolderSlug } from "@/lib/templates/sample-catalog";

export async function GET(request: NextRequest) {
  try {
    await getRequestAuthContext(request);
    const url = new URL(request.url);
    const folder = url.searchParams.get("folder")?.trim() || null;
    const q = url.searchParams.get("q")?.trim() || undefined;

    if (folder && !isSampleFolderSlug(folder)) {
      return jsonWithRequestId(request, { error: "Unknown sample folder.", folders: [], templates: [] }, { status: 400 });
    }

    const [counts, templates] = await Promise.all([
      countSampleTemplatesByFolder(),
      folder
        ? listSampleTemplates({ folderSlug: folder, query: q, limit: 200 })
        : Promise.resolve([]),
    ]);

    const folders = SAMPLE_TEMPLATE_FOLDERS.map((item) => ({
      ...item,
      template_count: counts[item.slug] ?? 0,
    }));

    return jsonWithRequestId(request, {
      folders,
      templates: folder ? templates : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load sample templates";
    return jsonWithRequestId(request, { error: message, folders: [], templates: [] }, { status: 500 });
  }
}
