"use client";

import { useEffect, useState } from "react";

type SignerField = {
  fieldId: string;
  recipientId: string;
  type: "signature" | "initial" | "date" | "text" | "checkbox";
  required: boolean;
};

type Props = {
  params: Promise<{ documentId: string; recipientId: string }>;
};

export default function RecipientSigningPage({ params }: Props) {
  const [documentId, setDocumentId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [html, setHtml] = useState("");
  const [fields, setFields] = useState<SignerField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signingToken, setSigningToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const resolved = await params;
      setDocumentId(resolved.documentId);
      setRecipientId(resolved.recipientId);
      const url = new URL(window.location.href);
      const token = url.searchParams.get("token");
      setSigningToken(token);
      const authHeaders = token ? { "x-signing-token": token } : undefined;

      const [renderResponse, fieldResponse] = await Promise.all([
        fetch(
          `/api/documents/${resolved.documentId}/render?mode=recipient-fill&recipientId=${resolved.recipientId}`,
          { headers: authHeaders },
        ),
        fetch(`/api/documents/${resolved.documentId}/signer-fields`, { headers: authHeaders }),
        fetch(`/api/documents/${resolved.documentId}/viewed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeaders ?? {}),
          },
          body: JSON.stringify({ actorRecipientId: resolved.recipientId }),
        }),
      ]);

      if (renderResponse.ok) {
        const renderPayload = (await renderResponse.json()) as { html: string };
        setHtml(renderPayload.html);
      }

      if (fieldResponse.ok) {
        const fieldPayload = (await fieldResponse.json()) as { fields: SignerField[] };
        setFields(fieldPayload.fields.filter((field) => field.recipientId === resolved.recipientId));
      }
    }

    void load();
  }, [params]);

  async function saveField(fieldId: string) {
    await fetch(`/api/documents/${documentId}/signer-fields/${fieldId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(signingToken ? { "x-signing-token": signingToken } : {}),
      },
      body: JSON.stringify({
        actorRecipientId: recipientId,
        value: values[fieldId] ?? "",
      }),
    });
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-4 px-6 py-8 lg:grid-cols-[1fr_340px]">
      <article
        className="prose prose-invert max-w-none rounded-xl border border-border bg-surface p-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <aside className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold">Recipient Fields</h1>
        {fields.map((field) => (
          <div key={field.fieldId} className="rounded border border-border p-2">
            <p className="mb-1 text-xs text-muted">
              {field.type} ({field.required ? "required" : "optional"})
            </p>
            <input
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={values[field.fieldId] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.fieldId]: event.target.value }))
              }
            />
            <button
              onClick={() => saveField(field.fieldId)}
              className="w-full rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            >
              Save value
            </button>
          </div>
        ))}
      </aside>
    </main>
  );
}
