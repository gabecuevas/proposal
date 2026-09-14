import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { isMarketingLibraryAdmin } from "@/lib/marketing/admin";

/**
 * Stores public SEO ↔ sample template links as a soft mapping on the sample template tags.
 * Full CMS upload/edit comes later; this unblocks admin wiring without a new Prisma model.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    if (!isMarketingLibraryAdmin(auth.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      categorySlug?: string;
      templateSlug?: string;
      sampleTemplateId?: string | null;
      notes?: string;
    };

    const categorySlug = body.categorySlug?.trim();
    const templateSlug = body.templateSlug?.trim();
    if (!categorySlug || !templateSlug) {
      return NextResponse.json({ error: "categorySlug and templateSlug are required" }, { status: 400 });
    }

    const publicPath = `public-path:${categorySlug}/${templateSlug}`;
    const noteTag = body.notes?.trim() ? `public-notes:${body.notes.trim().slice(0, 180)}` : null;

    if (body.sampleTemplateId) {
      const sample = await prisma.template.findFirst({
        where: { id: body.sampleTemplateId, is_sample: true },
      });
      if (!sample) {
        return NextResponse.json({ error: "Sample template not found" }, { status: 404 });
      }

      const existingTags = Array.isArray(sample.tags)
        ? sample.tags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const cleared = existingTags.filter(
        (tag) => !tag.startsWith("public-path:") && !tag.startsWith("public-notes:"),
      );
      const tags = [...cleared, publicPath, ...(noteTag ? [noteTag] : [])];
      await prisma.template.update({
        where: { id: sample.id },
        data: { tags, updated_by: auth.userId },
      });
    }

    return NextResponse.json({
      ok: true,
      publicPath: `/templates/${categorySlug}/${templateSlug}`,
      sampleTemplateId: body.sampleTemplateId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
