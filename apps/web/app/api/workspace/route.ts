import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { validateCompanyWebsite } from "@/lib/auth/company-website";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { isSupportedCurrency } from "@/lib/commercial/currencies";
import { assetUrl } from "@/lib/storage/asset-url";

const workspaceSelect = {
  id: true,
  name: true,
  logo_asset_key: true,
  brand_color: true,
  legal_name: true,
  website: true,
  no_website: true,
  business_email: true,
  business_phone: true,
  company_size: true,
  industry: true,
  country: true,
  timezone: true,
  currency: true,
  locale: true,
  quote_validity_days: true,
  invoice_payment_term_days: true,
  sample_mode_enabled: true,
  updatedAt: true,
} as const;

function mapWorkspace(workspace: {
  id: string;
  name: string;
  logo_asset_key: string | null;
  brand_color: string | null;
  legal_name: string | null;
  website: string | null;
  no_website: boolean;
  business_email: string | null;
  business_phone: string | null;
  company_size: string | null;
  industry: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  locale: string | null;
  quote_validity_days: number | null;
  invoice_payment_term_days: number | null;
  sample_mode_enabled: boolean;
  updatedAt: Date;
}) {
  return {
    id: workspace.id,
    name: workspace.name,
    logoAssetKey: workspace.logo_asset_key,
    logoUrl: workspace.logo_asset_key ? assetUrl(workspace.logo_asset_key) : null,
    brandColor: workspace.brand_color,
    legalName: workspace.legal_name,
    website: workspace.website,
    noWebsite: workspace.no_website,
    businessEmail: workspace.business_email,
    businessPhone: workspace.business_phone,
    companySize: workspace.company_size,
    industry: workspace.industry,
    country: workspace.country,
    timezone: workspace.timezone,
    currency: workspace.currency,
    locale: workspace.locale,
    quoteValidityDays: workspace.quote_validity_days,
    invoicePaymentTermDays: workspace.invoice_payment_term_days,
    sampleModeEnabled: workspace.sample_mode_enabled,
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await getRequestAuthContext(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(request, {
      status: message === "Forbidden" ? 403 : 401,
      code: message === "Forbidden" ? "forbidden" : "unauthorized",
      message,
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: workspaceSelect,
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }
  return jsonWithRequestId(request, { workspace: mapWorkspace(workspace), viewerRole: auth.role });
}

export async function PATCH(request: NextRequest) {
  let auth;
  try {
    auth = await getRequestAuthContext(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(request, {
      status: message === "Forbidden" ? 403 : 401,
      code: message === "Forbidden" ? "forbidden" : "unauthorized",
      message,
    });
  }

  const body = (await request.json()) as {
    name?: string;
    logoAssetKey?: string | null;
    brandColor?: string | null;
    legalName?: string | null;
    website?: string | null;
    noWebsite?: boolean;
    businessEmail?: string | null;
    businessPhone?: string | null;
    companySize?: string | null;
    industry?: string | null;
    country?: string | null;
    timezone?: string | null;
    currency?: string | null;
    locale?: string | null;
    quoteValidityDays?: number | null;
    invoicePaymentTermDays?: number | null;
    expectedUpdatedAt?: string;
  };

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    assertRole(auth, "ADMIN");
    if (!body.name.trim()) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "name is required",
      });
    }
    data.name = body.name.trim();
  }

  if (body.logoAssetKey !== undefined) {
    assertRole(auth, "MEMBER");
    data.logo_asset_key = body.logoAssetKey?.trim() || null;
  }

  const adminFieldsTouched =
    body.brandColor !== undefined ||
    body.legalName !== undefined ||
    body.website !== undefined ||
    body.noWebsite !== undefined ||
    body.businessEmail !== undefined ||
    body.businessPhone !== undefined ||
    body.companySize !== undefined ||
    body.industry !== undefined ||
    body.country !== undefined ||
    body.timezone !== undefined ||
    body.currency !== undefined ||
    body.locale !== undefined ||
    body.quoteValidityDays !== undefined ||
    body.invoicePaymentTermDays !== undefined;

  if (adminFieldsTouched) {
    assertRole(auth, "ADMIN");
  }

  if (body.brandColor !== undefined) {
    const color = body.brandColor?.trim() || null;
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "brandColor must be a hex color like #1e3a5f",
      });
    }
    data.brand_color = color;
  }
  if (body.legalName !== undefined) {
    data.legal_name = body.legalName?.trim() || null;
  }
  if (body.noWebsite !== undefined) {
    data.no_website = Boolean(body.noWebsite);
    if (body.noWebsite) {
      data.website = null;
    }
  }
  if (body.website !== undefined && !body.noWebsite) {
    if (!body.website?.trim()) {
      data.website = null;
    } else {
      const validated = validateCompanyWebsite(body.website);
      if (!validated.ok) {
        return errorResponse(request, {
          status: 400,
          code: "validation_error",
          message: validated.error,
        });
      }
      data.website = validated.href;
      data.no_website = false;
    }
  }
  if (body.businessEmail !== undefined) {
    data.business_email = body.businessEmail?.trim() || null;
  }
  if (body.businessPhone !== undefined) {
    data.business_phone = body.businessPhone?.trim() || null;
  }
  if (body.companySize !== undefined) {
    data.company_size = body.companySize?.trim() || null;
  }
  if (body.industry !== undefined) {
    data.industry = body.industry?.trim() || null;
  }
  if (body.country !== undefined) {
    data.country = body.country?.trim().toUpperCase() || null;
  }
  if (body.timezone !== undefined) {
    data.timezone = body.timezone?.trim() || null;
  }
  if (body.currency !== undefined) {
    if (auth.role !== "OWNER") {
      return errorResponse(request, {
        status: 403,
        code: "forbidden",
        message: "Only an Account Owner can change the default currency.",
      });
    }
    const currency = body.currency?.trim().toUpperCase() ?? "";
    if (!isSupportedCurrency(currency)) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message: "Choose a supported currency.",
      });
    }
    data.currency = currency;
  }
  if (body.locale !== undefined) {
    data.locale = body.locale?.trim() || null;
  }
  if (body.quoteValidityDays !== undefined) {
    data.quote_validity_days =
      body.quoteValidityDays === null ? null : Math.max(1, Math.min(365, Number(body.quoteValidityDays)));
  }
  if (body.invoicePaymentTermDays !== undefined) {
    data.invoice_payment_term_days =
      body.invoicePaymentTermDays === null
        ? null
        : Math.max(0, Math.min(365, Number(body.invoicePaymentTermDays)));
  }

  if (Object.keys(data).length === 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "No updatable fields provided",
    });
  }

  if (body.expectedUpdatedAt) {
    const current = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { updatedAt: true },
    });
    if (current && current.updatedAt.toISOString() !== body.expectedUpdatedAt) {
      return errorResponse(request, {
        status: 409,
        code: "conflict",
        message: "Workspace was updated elsewhere. Reload and try again.",
      });
    }
  }

  const workspace = await prisma.workspace.update({
    where: { id: auth.workspaceId },
    data,
    select: workspaceSelect,
  });
  return jsonWithRequestId(request, { workspace: mapWorkspace(workspace), viewerRole: auth.role });
}
