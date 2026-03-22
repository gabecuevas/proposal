import { expect, request as playwrightRequest, test } from "@playwright/test";

test.describe("document automation lifecycle", () => {
  test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run end-to-end flow.");

  test("template -> render -> sign -> finalize", async ({ browser, page }) => {
    const userEmail = `playwright-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByPlaceholder("Work email").fill(userEmail);
    await page.getByPlaceholder("Full name").fill("Playwright User");
    await page.getByPlaceholder("Workspace name (optional)").fill("Playwright Workspace");
    await page.getByPlaceholder("Password").fill("playwright-password");
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/app/);
    const authRequest = await playwrightRequest.newContext({
      storageState: await page.context().storageState(),
    });

    const editor_json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Proposal for " },
            { type: "variableToken", attrs: { key: "client.name" } },
          ],
        },
        { type: "quoteTable", attrs: { tableId: "default" } },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Signer: " },
            {
              type: "signerField",
              attrs: {
                fieldId: "field-primary-signature",
                recipientId: "recipient-primary",
                type: "signature",
                required: true,
              },
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Finance approval: " },
            {
              type: "signerField",
              attrs: {
                fieldId: "field-finance-signature",
                recipientId: "recipient-finance",
                type: "signature",
                required: true,
              },
            },
          ],
        },
      ],
    };

    const templateResponse = await authRequest.post("/api/templates", {
      data: { name: "Playwright Proposal Template" },
    });
    expect(
      templateResponse.ok(),
      `Template create failed with status ${templateResponse.status()} and body: ${await templateResponse.text()}`,
    ).toBeTruthy();
    const templatePayload = (await templateResponse.json()) as {
      template: { id: string };
    };

    const patchTemplateResponse = await authRequest.patch(`/api/templates/${templatePayload.template.id}`, {
      data: {
        editor_json,
        variable_registry: {
          "client.name": { required: true, label: "Client Name" },
        },
        pricing_json: {
          currency: "USD",
          discountPercent: 5,
          taxPercent: 8,
          items: [{ id: "item-setup", name: "Setup", quantity: 1, unitPrice: 1000 }],
        },
      },
    });
    expect(patchTemplateResponse.ok()).toBeTruthy();

    const documentResponse = await authRequest.post("/api/documents/from-template", {
      data: { templateId: templatePayload.template.id },
    });
    expect(documentResponse.ok()).toBeTruthy();
    const documentPayload = (await documentResponse.json()) as {
      document: { id: string; recipients_json: Array<{ id: string }> };
    };
    const activeRecipientId = documentPayload.document.recipients_json[0]?.id;
    const financeRecipientId = documentPayload.document.recipients_json[1]?.id;
    expect(activeRecipientId).toBeTruthy();
    expect(financeRecipientId).toBeTruthy();

    const patchDocumentResponse = await authRequest.patch(`/api/documents/${documentPayload.document.id}`, {
      data: {
        variables_json: {
          client: { name: "Acme Incorporated" },
        },
      },
    });
    expect(patchDocumentResponse.ok()).toBeTruthy();

    const sendResponse = await authRequest.post(`/api/documents/${documentPayload.document.id}/send`);
    expect(sendResponse.ok()).toBeTruthy();
    const signingSessionResponse = await authRequest.post(
      `/api/documents/${documentPayload.document.id}/signing-session`,
      {
        data: { recipientId: activeRecipientId },
      },
    );
    expect(signingSessionResponse.ok()).toBeTruthy();
    const missingRecipientSigningSession = await authRequest.post(
      `/api/documents/${documentPayload.document.id}/signing-session`,
      {
        data: {},
      },
    );
    expect(missingRecipientSigningSession.status()).toBe(400);
    const missingRecipientPayload = (await missingRecipientSigningSession.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(missingRecipientPayload.error.code).toBe("validation_error");
    expect(missingRecipientPayload.requestId.length).toBeGreaterThan(0);
    const signingSessionPayload = (await signingSessionResponse.json()) as {
      signingUrl: string;
    };
    const financeSigningSessionResponse = await authRequest.post(
      `/api/documents/${documentPayload.document.id}/signing-session`,
      {
        data: { recipientId: financeRecipientId },
      },
    );
    expect(financeSigningSessionResponse.ok()).toBeTruthy();
    const financeSigningSessionPayload = (await financeSigningSessionResponse.json()) as {
      token: string;
    };

    const senderRenderResponse = await authRequest.get(
      `/api/documents/${documentPayload.document.id}/render?mode=sender-preview`,
    );
    expect(senderRenderResponse.ok()).toBeTruthy();
    const senderRenderPayload = (await senderRenderResponse.json()) as { html: string; missing: string[] };
    expect(senderRenderPayload.missing).toEqual([]);
    expect(senderRenderPayload.html).toContain("Acme Incorporated");
    expect(senderRenderPayload.html).toContain("Total due now:");

    const financeOutOfOrderSave = await authRequest.patch(
      `/api/documents/${documentPayload.document.id}/signer-fields/field-finance-signature`,
      {
        data: {
          actorRecipientId: financeRecipientId,
          value: "Finance signer before primary",
        },
        headers: {
          "x-signing-token": financeSigningSessionPayload.token,
        },
      },
    );
    expect(financeOutOfOrderSave.status()).toBe(403);

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    await recipientPage.goto(signingSessionPayload.signingUrl);
    const viewedDocResponse = await authRequest.get(`/api/documents/${documentPayload.document.id}`);
    expect(viewedDocResponse.ok()).toBeTruthy();
    const viewedDocPayload = (await viewedDocResponse.json()) as {
      document: { status: string };
    };
    expect(["VIEWED", "SENT"]).toContain(viewedDocPayload.document.status);

    await recipientPage.getByRole("textbox").fill("Signed by Primary Recipient");
    await recipientPage.getByRole("button", { name: "Save value" }).click();

    const financeSigningSessionUrlResponse = await authRequest.post(
      `/api/documents/${documentPayload.document.id}/signing-session`,
      {
        data: { recipientId: financeRecipientId },
      },
    );
    expect(financeSigningSessionUrlResponse.ok()).toBeTruthy();
    const financeSigningSessionUrlPayload = (await financeSigningSessionUrlResponse.json()) as {
      signingUrl: string;
    };
    const financeRecipientContext = await browser.newContext();
    const financeRecipientPage = await financeRecipientContext.newPage();
    await financeRecipientPage.goto(financeSigningSessionUrlPayload.signingUrl);
    await financeRecipientPage.getByRole("textbox").fill("Finance signer after primary");
    await financeRecipientPage.getByRole("button", { name: "Save value" }).click();

    const finalizeResponse = await authRequest.post(`/api/documents/${documentPayload.document.id}/finalize`);
    expect(finalizeResponse.ok()).toBeTruthy();
    const finalizePayload = (await finalizeResponse.json()) as {
      doc_hash: string;
      html: string;
      pdf_key: string;
      queued: boolean;
    };
    expect(finalizePayload.doc_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(finalizePayload.html).toContain("Certificate");
    expect(finalizePayload.pdf_key).toContain(`${documentPayload.document.id}`);
    expect(finalizePayload.queued).toBeTruthy();

    const checkoutResponse = await authRequest.post(
      `/api/documents/${documentPayload.document.id}/checkout-session`,
    );
    expect([201, 503]).toContain(checkoutResponse.status());
    if (checkoutResponse.status() === 201) {
      const checkoutPayload = (await checkoutResponse.json()) as {
        session: { checkoutUrl: string; amountMinor: number; currency: string };
      };
      expect(checkoutPayload.session.checkoutUrl.startsWith("http")).toBeTruthy();
      expect(checkoutPayload.session.amountMinor).toBeGreaterThan(0);
    }

    const activityResponse = await authRequest.get(`/api/documents/${documentPayload.document.id}/activity`);
    expect(activityResponse.ok()).toBeTruthy();
    const activityPayload = (await activityResponse.json()) as {
      events: Array<{ event_type: string }>;
      requestId: string;
      nextCursor: string | null;
    };
    expect(activityPayload.events.some((event) => event.event_type === "DOCUMENT_SENT")).toBeTruthy();
    expect(activityPayload.events.some((event) => event.event_type === "DOCUMENT_FINALIZED")).toBeTruthy();
    expect(activityPayload.requestId.length).toBeGreaterThan(0);

    const auditActivityResponse = await authRequest.get(`/api/audit/activity?limit=1`);
    expect(auditActivityResponse.ok()).toBeTruthy();
    const auditActivityPayload = (await auditActivityResponse.json()) as {
      events: Array<{ id: string }>;
      nextCursor: string | null;
      requestId: string;
    };
    expect(auditActivityPayload.events.length).toBeLessThanOrEqual(1);
    expect(auditActivityPayload.requestId.length).toBeGreaterThan(0);

    const replayMissingDelivery = await authRequest.post(
      `/api/workspace/webhooks/deliveries/missing-delivery/replay`,
    );
    expect(replayMissingDelivery.status()).toBe(404);
    const replayMissingPayload = (await replayMissingDelivery.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(replayMissingPayload.error.code).toBe("delivery_not_found");

    const badLoginResponse = await authRequest.post("/api/auth/login", {
      data: { email: userEmail, password: "bad-password" },
    });
    expect(badLoginResponse.status()).toBe(401);
    const badLoginPayload = (await badLoginResponse.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(badLoginPayload.error.code).toBe("invalid_credentials");
    expect(badLoginPayload.requestId.length).toBeGreaterThan(0);

    const compliancePolicyResponse = await authRequest.get("/api/workspace/compliance/policy");
    expect(compliancePolicyResponse.ok()).toBeTruthy();
    const compliancePolicyPayload = (await compliancePolicyResponse.json()) as {
      policy: {
        auditRetentionDays: number;
        auditExportTokenTtlMinutes: number;
      };
    };
    expect(compliancePolicyPayload.policy.auditRetentionDays).toBeGreaterThan(0);
    expect(compliancePolicyPayload.policy.auditExportTokenTtlMinutes).toBeGreaterThan(0);

    const compliancePolicyPatchResponse = await authRequest.patch("/api/workspace/compliance/policy", {
      data: {
        auditRetentionDays: 120,
        auditExportTokenTtlMinutes: 20,
        cpqApprovalDiscountThreshold: 10,
      },
    });
    expect(compliancePolicyPatchResponse.ok()).toBeTruthy();

    const highDiscountTemplatePatch = await authRequest.patch(`/api/templates/${templatePayload.template.id}`, {
      data: {
        pricing_json: {
          currency: "USD",
          discountPercent: 25,
          taxPercent: 8,
          items: [{ id: "item-setup-high-discount", name: "Setup", quantity: 1, unitPrice: 1000 }],
        },
      },
    });
    expect(highDiscountTemplatePatch.ok()).toBeTruthy();
    const approvalDocumentResponse = await authRequest.post("/api/documents/from-template", {
      data: { templateId: templatePayload.template.id },
    });
    expect(approvalDocumentResponse.ok()).toBeTruthy();
    const approvalDocumentPayload = (await approvalDocumentResponse.json()) as {
      document: { id: string };
    };

    const blockedSendResponse = await authRequest.post(`/api/documents/${approvalDocumentPayload.document.id}/send`);
    expect(blockedSendResponse.status()).toBe(409);
    const blockedSendPayload = (await blockedSendResponse.json()) as {
      error: { code: string; message: string };
    };
    expect(blockedSendPayload.error.code).toBe("quote_approval_required");

    const requestApprovalResponse = await authRequest.post(
      `/api/documents/${approvalDocumentPayload.document.id}/approval`,
      {
        data: { reason: "Discount exception for strategic deal" },
      },
    );
    expect(requestApprovalResponse.status()).toBe(201);

    const stillBlockedSendResponse = await authRequest.post(`/api/documents/${approvalDocumentPayload.document.id}/send`);
    expect(stillBlockedSendResponse.status()).toBe(409);

    const approveResponse = await authRequest.post(
      `/api/documents/${approvalDocumentPayload.document.id}/approval/decision`,
      {
        data: {
          decision: "APPROVED",
          reason: "Approved by finance operations",
        },
      },
    );
    expect(approveResponse.ok()).toBeTruthy();

    const approvedSendResponse = await authRequest.post(`/api/documents/${approvalDocumentPayload.document.id}/send`);
    expect(approvedSendResponse.ok()).toBeTruthy();

    const webhookCreateResponse = await authRequest.post("/api/workspace/webhooks", {
      data: {
        url: "https://example.com/proposal-webhooks",
        events: ["document.sent"],
        allowed_ips: ["127.0.0.1"],
        require_mtls: false,
      },
    });
    expect(webhookCreateResponse.ok()).toBeTruthy();
    const webhookCreatePayload = (await webhookCreateResponse.json()) as {
      endpoint: { id: string };
    };
    const webhookUpdateResponse = await authRequest.patch(
      `/api/workspace/webhooks/${webhookCreatePayload.endpoint.id}`,
      {
        data: {
          allowed_ips: ["127.0.0.1", "::1"],
          require_mtls: true,
          mtls_cert_fingerprint: "AA:BB:CC",
        },
      },
    );
    expect(webhookUpdateResponse.ok()).toBeTruthy();

    const exportBefore = new Date().toISOString();
    const exportTokenResponse = await authRequest.post("/api/audit/export-token", {
      data: {
        type: "activity",
        before: exportBefore,
        limit: 25,
      },
    });
    expect(exportTokenResponse.ok()).toBeTruthy();
    const exportTokenPayload = (await exportTokenResponse.json()) as {
      token: string;
    };
    expect(exportTokenPayload.token.length).toBeGreaterThan(20);

    const auditExportResponse = await authRequest.get(
      `/api/audit/export?token=${encodeURIComponent(exportTokenPayload.token)}`,
    );
    expect(auditExportResponse.ok()).toBeTruthy();
    const exportChecksum = auditExportResponse.headers()["x-audit-checksum"];
    const exportLedgerId = auditExportResponse.headers()["x-audit-ledger-id"];
    expect(exportChecksum).toBeTruthy();
    expect(exportLedgerId).toBeTruthy();
    const exportBody = await auditExportResponse.text();
    expect(exportBody.length).toBeGreaterThan(0);

    const evidenceBundleResponse = await authRequest.get(
      `/api/audit/evidence-bundle?token=${encodeURIComponent(exportTokenPayload.token)}`,
    );
    expect(evidenceBundleResponse.ok()).toBeTruthy();
    const evidencePayload = (await evidenceBundleResponse.json()) as {
      manifest: {
        checksum: string;
        before: string | null;
        limit: number;
      };
      signatureToken: string;
      rows: unknown[];
    };
    expect(evidencePayload.signatureToken.length).toBeGreaterThan(20);
    expect(Array.isArray(evidencePayload.rows)).toBeTruthy();
    expect(evidencePayload.manifest.checksum).toBeTruthy();

    const checksumResponse = await authRequest.get(
      `/api/audit/checksum?type=activity&before=${encodeURIComponent(exportBefore)}&limit=25&expectedChecksum=${encodeURIComponent(
        evidencePayload.manifest.checksum,
      )}`,
    );
    expect(checksumResponse.ok()).toBeTruthy();
    const checksumPayload = (await checksumResponse.json()) as {
      matches: boolean | null;
    };
    expect(checksumPayload.matches).toBeTruthy();
  });
});
