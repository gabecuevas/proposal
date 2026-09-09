import { expect, request as playwrightRequest, test } from "@playwright/test";
import { signUpOwner } from "./signup";

test.describe("immutable send snapshot", () => {
  test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run end-to-end flow.");

  test("sent snapshot survives draft mutation, library bump, and pricing change", async ({ page }) => {
    const userEmail = `playwright-integrity-${Date.now()}@example.com`;
    await signUpOwner(page, {
      email: userEmail,
      name: "Integrity User",
      workspaceName: "Integrity Workspace",
    });
    const authRequest = await playwrightRequest.newContext({
      storageState: await page.context().storageState(),
    });

    const blockResponse = await authRequest.post("/api/content-blocks", {
      data: {
        name: "Clause A",
        block_type: "text",
        editor_json: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Library Version A" }] }],
        },
      },
    });
    expect(blockResponse.ok()).toBeTruthy();
    const blockPayload = (await blockResponse.json()) as { block: { id: string } };

    const templateResponse = await authRequest.post("/api/templates", {
      data: { name: "Integrity Template" },
    });
    expect(templateResponse.ok()).toBeTruthy();
    const templatePayload = (await templateResponse.json()) as { template: { id: string } };

    const editor_json = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Sent body Version A" }] },
        { type: "contentBlockEmbed", attrs: { blockId: blockPayload.block.id, version: 1 } },
        { type: "quoteTable", attrs: { tableId: "default" } },
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
    };

    const patchTemplate = await authRequest.patch(`/api/templates/${templatePayload.template.id}`, {
      data: {
        editor_json,
        pricing_json: {
          currency: "USD",
          discountPercent: 0,
          taxPercent: 0,
          items: [{ id: "item-setup", name: "Setup", quantity: 1, unitPrice: 1000 }],
        },
      },
    });
    expect(patchTemplate.ok()).toBeTruthy();

    const documentResponse = await authRequest.post("/api/documents/from-template", {
      data: { templateId: templatePayload.template.id },
    });
    expect(documentResponse.ok()).toBeTruthy();
    const documentPayload = (await documentResponse.json()) as {
      document: { id: string; recipients_json: Array<{ id: string }> };
    };
    const documentId = documentPayload.document.id;
    const recipientId = documentPayload.document.recipients_json[0]?.id;
    expect(recipientId).toBeTruthy();

    const sendResponse = await authRequest.post(`/api/documents/${documentId}/send`);
    expect(sendResponse.ok()).toBeTruthy();
    const sendPayload = (await sendResponse.json()) as {
      document: { sent_version: { snapshot_hash: string; version_number: number } | null };
    };
    expect(sendPayload.document.sent_version?.snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
    const snapshotHash = sendPayload.document.sent_version?.snapshot_hash;

    const mutateDraft = await authRequest.patch(`/api/documents/${documentId}`, {
      data: {
        editor_json: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Tampered Version B" }] }],
        },
        pricing_json: {
          currency: "USD",
          discountPercent: 0,
          taxPercent: 0,
          items: [{ id: "item-setup", name: "Setup", quantity: 1, unitPrice: 9999 }],
        },
      },
    });
    expect(mutateDraft.status()).toBe(403);

    const bump = await authRequest.post(`/api/content-blocks/${blockPayload.block.id}/version`, {
      data: {
        editor_json: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Library Version B" }] }],
        },
      },
    });
    expect(bump.ok()).toBeTruthy();

    const signingSession = await authRequest.post(`/api/documents/${documentId}/signing-session`, {
      data: { recipientId },
    });
    expect(signingSession.ok()).toBeTruthy();
    const signingPayload = (await signingSession.json()) as { token: string };
    const sign = await authRequest.patch(`/api/documents/${documentId}/signer-fields/field-primary-signature`, {
      data: { actorRecipientId: recipientId, value: "Signed" },
      headers: { "x-signing-token": signingPayload.token },
    });
    expect(sign.ok()).toBeTruthy();

    const finalizeResponse = await authRequest.post(`/api/documents/${documentId}/finalize`);
    expect(finalizeResponse.ok()).toBeTruthy();
    const finalizePayload = (await finalizeResponse.json()) as { html: string; doc_hash: string };
    expect(finalizePayload.html).toContain("Sent body Version A");
    expect(finalizePayload.html).toContain("Library Version A");
    expect(finalizePayload.html).not.toContain("Library Version B");
    expect(finalizePayload.html).not.toContain("Tampered Version B");
    expect(finalizePayload.html).toContain("USD 1000.00");
    expect(finalizePayload.html).not.toContain("USD 9999.00");
    expect(finalizePayload.doc_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(finalizePayload.doc_hash).not.toBe(snapshotHash);

    const after = await authRequest.get(`/api/documents/${documentId}`);
    const afterPayload = (await after.json()) as {
      document: { sent_version: { snapshot_hash: string } | null };
    };
    expect(afterPayload.document.sent_version?.snapshot_hash).toBe(snapshotHash);
  });
});
