"use client";

import { useEffect, useMemo, useState } from "react";

type CompliancePolicy = {
  workspaceId: string;
  auditRetentionDays: number;
  auditExportTokenTtlMinutes: number;
  cpqApprovalDiscountThreshold: number;
};

type ApiKeyItem = {
  id: string;
  name: string;
  key_prefix: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  revoked_at: string | null;
};

type ApiKeyAnalytics = {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  usedLast7d: number;
  computedAt: string;
};

type WebhookEndpointItem = {
  id: string;
  url: string;
  events: string[];
  allowed_ips: string[] | null;
  require_mtls: boolean;
  mtls_cert_fingerprint: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function parseApiError(payload: ApiErrorPayload | null): string {
  return payload?.error?.message ?? "Request failed";
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [policy, setPolicy] = useState<CompliancePolicy | null>(null);
  const [policyRetention, setPolicyRetention] = useState("90");
  const [policyTokenTtl, setPolicyTokenTtl] = useState("15");
  const [policyCpqDiscountThreshold, setPolicyCpqDiscountThreshold] = useState("15");

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiAnalytics, setApiAnalytics] = useState<ApiKeyAnalytics | null>(null);
  const [newApiKeyName, setNewApiKeyName] = useState("Automation Key");
  const [newApiKeyRole, setNewApiKeyRole] = useState<"OWNER" | "ADMIN" | "MEMBER">("MEMBER");
  const [newApiKeyTtlDays, setNewApiKeyTtlDays] = useState("90");
  const [newApiKeySecret, setNewApiKeySecret] = useState<string | null>(null);

  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpointItem[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("https://example.com/webhooks/proposal");
  const [newWebhookEvents, setNewWebhookEvents] = useState("document.sent,document.finalized");
  const [newWebhookAllowedIps, setNewWebhookAllowedIps] = useState("");
  const [newWebhookRequireMtls, setNewWebhookRequireMtls] = useState(false);
  const [newWebhookMtlsFingerprint, setNewWebhookMtlsFingerprint] = useState("");

  const endpointDraftById = useMemo(
    () =>
      Object.fromEntries(
        webhookEndpoints.map((endpoint) => [
          endpoint.id,
          {
            url: endpoint.url,
            events: endpoint.events.join(","),
            allowedIps: (endpoint.allowed_ips ?? []).join(","),
            requireMtls: endpoint.require_mtls,
            mtlsFingerprint: endpoint.mtls_cert_fingerprint ?? "",
            isActive: endpoint.is_active,
          },
        ]),
      ),
    [webhookEndpoints],
  );
  const [endpointDrafts, setEndpointDrafts] = useState<
    Record<
      string,
      {
        url: string;
        events: string;
        allowedIps: string;
        requireMtls: boolean;
        mtlsFingerprint: string;
        isActive: boolean;
      }
    >
  >({});

  useEffect(() => {
    setEndpointDrafts(endpointDraftById);
  }, [endpointDraftById]);

  async function loadAll() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const [policyRes, keysRes, analyticsRes, webhooksRes] = await Promise.all([
        fetch("/api/workspace/compliance/policy"),
        fetch("/api/workspace/api-keys?limit=200"),
        fetch("/api/workspace/api-keys/analytics"),
        fetch("/api/workspace/webhooks?limit=200"),
      ]);

      if (!policyRes.ok || !keysRes.ok || !analyticsRes.ok || !webhooksRes.ok) {
        throw new Error("Failed to load settings");
      }

      const policyPayload = (await policyRes.json()) as { policy: CompliancePolicy };
      const keysPayload = (await keysRes.json()) as { apiKeys: ApiKeyItem[] };
      const analyticsPayload = (await analyticsRes.json()) as { analytics: ApiKeyAnalytics };
      const webhooksPayload = (await webhooksRes.json()) as { endpoints: WebhookEndpointItem[] };

      setPolicy(policyPayload.policy);
      setPolicyRetention(String(policyPayload.policy.auditRetentionDays));
      setPolicyTokenTtl(String(policyPayload.policy.auditExportTokenTtlMinutes));
      setPolicyCpqDiscountThreshold(String(policyPayload.policy.cpqApprovalDiscountThreshold));
      setApiKeys(keysPayload.apiKeys);
      setApiAnalytics(analyticsPayload.analytics);
      setWebhookEndpoints(webhooksPayload.endpoints);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function savePolicy() {
    setStatus("");
    setError("");
    const response = await fetch("/api/workspace/compliance/policy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auditRetentionDays: Number(policyRetention),
        auditExportTokenTtlMinutes: Number(policyTokenTtl),
        cpqApprovalDiscountThreshold: Number(policyCpqDiscountThreshold),
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
      setError(parseApiError(payload));
      return;
    }
    const payload = (await response.json()) as { policy: CompliancePolicy };
    setPolicy(payload.policy);
    setStatus("Compliance policy saved.");
  }

  async function createApiKey() {
    setStatus("");
    setError("");
    const response = await fetch("/api/workspace/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newApiKeyName,
        role: newApiKeyRole,
        expiresInDays: Number(newApiKeyTtlDays),
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          apiKey: ApiKeyItem;
          secret: string;
        }
      | ApiErrorPayload
      | null;
    if (!response.ok) {
      setError(parseApiError(payload as ApiErrorPayload | null));
      return;
    }
    setNewApiKeySecret((payload as { secret: string }).secret);
    setStatus("API key created. Copy the secret now.");
    await loadAll();
  }

  async function rotateApiKey(apiKeyId: string) {
    setStatus("");
    setError("");
    const ttlInput = window.prompt("Enter replacement key TTL in days", "90");
    const expiresInDays = Number(ttlInput ?? "90");
    const response = await fetch(`/api/workspace/api-keys/${apiKeyId}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          secret: string;
        }
      | ApiErrorPayload
      | null;
    if (!response.ok) {
      setError(parseApiError(payload as ApiErrorPayload | null));
      return;
    }
    setNewApiKeySecret((payload as { secret: string }).secret);
    setStatus("API key rotated. Copy replacement secret now.");
    await loadAll();
  }

  async function revokeApiKey(apiKeyId: string) {
    setStatus("");
    setError("");
    const response = await fetch(`/api/workspace/api-keys/${apiKeyId}/revoke`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (!response.ok) {
      setError(parseApiError(payload));
      return;
    }
    setStatus("API key revoked.");
    await loadAll();
  }

  function parseListInput(input: string) {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  async function createWebhook() {
    setStatus("");
    setError("");
    const response = await fetch("/api/workspace/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: newWebhookUrl,
        events: parseListInput(newWebhookEvents),
        allowed_ips: parseListInput(newWebhookAllowedIps),
        require_mtls: newWebhookRequireMtls,
        mtls_cert_fingerprint: newWebhookMtlsFingerprint.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (!response.ok) {
      setError(parseApiError(payload));
      return;
    }
    setStatus("Webhook endpoint created.");
    await loadAll();
  }

  async function saveWebhook(endpointId: string) {
    setStatus("");
    setError("");
    const draft = endpointDrafts[endpointId];
    if (!draft) {
      return;
    }
    const response = await fetch(`/api/workspace/webhooks/${endpointId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: draft.url,
        events: parseListInput(draft.events),
        allowed_ips: parseListInput(draft.allowedIps),
        require_mtls: draft.requireMtls,
        mtls_cert_fingerprint: draft.mtlsFingerprint.trim() || undefined,
        is_active: draft.isActive,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (!response.ok) {
      setError(parseApiError(payload));
      return;
    }
    setStatus("Webhook endpoint updated.");
    await loadAll();
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted">Admin controls for compliance, API keys, and webhook trust policy.</p>
        {status ? <p className="mt-2 text-sm text-green-600">{status}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Compliance Policy</h2>
        <p className="mt-1 text-sm text-muted">Configure workspace retention and audit export token lifetime.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Audit Retention (days)</span>
            <input
              className="w-full rounded border border-border bg-background px-2 py-2"
              value={policyRetention}
              onChange={(event) => setPolicyRetention(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Export Token TTL (minutes)</span>
            <input
              className="w-full rounded border border-border bg-background px-2 py-2"
              value={policyTokenTtl}
              onChange={(event) => setPolicyTokenTtl(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">CPQ Approval Discount Threshold (%)</span>
            <input
              className="w-full rounded border border-border bg-background px-2 py-2"
              value={policyCpqDiscountThreshold}
              onChange={(event) => setPolicyCpqDiscountThreshold(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => void savePolicy()}
              disabled={loading}
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Save Policy
            </button>
          </div>
        </div>
        {policy ? (
          <p className="mt-2 text-xs text-muted">
            Workspace: {policy.workspaceId} | Retention: {policy.auditRetentionDays} days | Export TTL:{" "}
            {policy.auditExportTokenTtlMinutes} minutes | CPQ Approval Threshold:{" "}
            {policy.cpqApprovalDiscountThreshold}%
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="mt-1 text-sm text-muted">Create, rotate, and revoke workspace API keys with expiry controls.</p>
        {apiAnalytics ? (
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-5">
            <Stat label="Total" value={apiAnalytics.total} />
            <Stat label="Active" value={apiAnalytics.active} />
            <Stat label="Revoked" value={apiAnalytics.revoked} />
            <Stat label="Expired" value={apiAnalytics.expired} />
            <Stat label="Used (7d)" value={apiAnalytics.usedLast7d} />
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newApiKeyName}
            onChange={(event) => setNewApiKeyName(event.target.value)}
            placeholder="Key name"
          />
          <select
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newApiKeyRole}
            onChange={(event) => setNewApiKeyRole(event.target.value as "OWNER" | "ADMIN" | "MEMBER")}
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newApiKeyTtlDays}
            onChange={(event) => setNewApiKeyTtlDays(event.target.value)}
            placeholder="TTL days"
          />
          <button
            onClick={() => void createApiKey()}
            className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Create Key
          </button>
        </div>
        {newApiKeySecret ? (
          <div className="mt-2 rounded border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900">
            Secret (shown once): <code>{newApiKeySecret}</code>
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {apiKeys.map((key) => (
            <div key={key.id} className="rounded border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {key.name} ({key.role})
                  </p>
                  <p className="text-xs text-muted">
                    Prefix: {key.key_prefix} | Created: {formatDate(key.created_at)} | Last used:{" "}
                    {formatDate(key.last_used_at)}
                  </p>
                  <p className="text-xs text-muted">
                    Expires: {formatDate(key.expires_at)} | Expired: {key.is_expired ? "yes" : "no"} | Revoked:{" "}
                    {key.revoked_at ? "yes" : "no"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void rotateApiKey(key.id)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                  >
                    Rotate
                  </button>
                  <button
                    onClick={() => void revokeApiKey(key.id)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Webhook Trust Policy</h2>
        <p className="mt-1 text-sm text-muted">Configure endpoint IP allowlisting and mTLS requirement metadata.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newWebhookUrl}
            onChange={(event) => setNewWebhookUrl(event.target.value)}
            placeholder="https://example.com/webhooks/proposal"
          />
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newWebhookEvents}
            onChange={(event) => setNewWebhookEvents(event.target.value)}
            placeholder="document.sent,document.finalized"
          />
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newWebhookAllowedIps}
            onChange={(event) => setNewWebhookAllowedIps(event.target.value)}
            placeholder="Allowed IPs (comma-separated)"
          />
          <input
            className="rounded border border-border bg-background px-2 py-2 text-sm"
            value={newWebhookMtlsFingerprint}
            onChange={(event) => setNewWebhookMtlsFingerprint(event.target.value)}
            placeholder="mTLS cert fingerprint (optional)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newWebhookRequireMtls}
              onChange={(event) => setNewWebhookRequireMtls(event.target.checked)}
            />
            Require mTLS
          </label>
          <div className="flex items-center">
            <button
              onClick={() => void createWebhook()}
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Create Endpoint
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {webhookEndpoints.map((endpoint) => {
            const draft = endpointDrafts[endpoint.id];
            if (!draft) {
              return null;
            }
            return (
              <div key={endpoint.id} className="rounded border border-border bg-background p-3 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded border border-border bg-surface px-2 py-2"
                    value={draft.url}
                    onChange={(event) =>
                      setEndpointDrafts((current) => ({
                        ...current,
                        [endpoint.id]: {
                          ...draft,
                          url: event.target.value,
                        },
                      }))
                    }
                    placeholder="Webhook URL"
                  />
                  <input
                    className="rounded border border-border bg-surface px-2 py-2"
                    value={draft.events}
                    onChange={(event) =>
                      setEndpointDrafts((current) => ({
                        ...current,
                        [endpoint.id]: {
                          ...draft,
                          events: event.target.value,
                        },
                      }))
                    }
                    placeholder="Events"
                  />
                  <input
                    className="rounded border border-border bg-surface px-2 py-2"
                    value={draft.allowedIps}
                    onChange={(event) =>
                      setEndpointDrafts((current) => ({
                        ...current,
                        [endpoint.id]: {
                          ...draft,
                          allowedIps: event.target.value,
                        },
                      }))
                    }
                    placeholder="Allowed IPs"
                  />
                  <input
                    className="rounded border border-border bg-surface px-2 py-2"
                    value={draft.mtlsFingerprint}
                    onChange={(event) =>
                      setEndpointDrafts((current) => ({
                        ...current,
                        [endpoint.id]: {
                          ...draft,
                          mtlsFingerprint: event.target.value,
                        },
                      }))
                    }
                    placeholder="mTLS fingerprint"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.requireMtls}
                      onChange={(event) =>
                        setEndpointDrafts((current) => ({
                          ...current,
                          [endpoint.id]: {
                            ...draft,
                            requireMtls: event.target.checked,
                          },
                        }))
                      }
                    />
                    Require mTLS
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setEndpointDrafts((current) => ({
                          ...current,
                          [endpoint.id]: {
                            ...draft,
                            isActive: event.target.checked,
                          },
                        }))
                      }
                    />
                    Active
                  </label>
                  <button
                    onClick={() => void saveWebhook(endpoint.id)}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                  >
                    Save Endpoint
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Updated: {formatDate(endpoint.updated_at)} | ID: {endpoint.id}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
