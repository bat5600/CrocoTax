"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type ApiSettingsResponse = {
  ok: boolean;
  error?: string;
  tenant?: { id: string; name: string };
  integrations?: {
    ghl?: { configured: boolean };
    pdp?: { provider: string; configured: boolean };
  };
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "unknown_error";
}

function readLocationId(searchLocationId?: string): string {
  return typeof searchLocationId === "string" ? searchLocationId.trim() : "";
}

export function SettingsClient({ locationId }: { locationId?: string }) {
  const normalizedLocationId = useMemo(() => readLocationId(locationId), [locationId]);
  const storageKey = useMemo(
    () =>
      normalizedLocationId
        ? `crocotax.portal.tenantApiToken.${normalizedLocationId}`
        : "crocotax.portal.tenantApiToken",
    [normalizedLocationId]
  );

  const [tenantApiToken, setTenantApiToken] = useState("");
  const [rememberToken, setRememberToken] = useState(true);
  const [pdpToken, setPdpToken] = useState("");

  const [settings, setSettings] = useState<ApiSettingsResponse | null>(null);
  const [status, setStatus] = useState<{
    state: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ state: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      setTenantApiToken(existing);
    }
  }, [storageKey]);

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (normalizedLocationId) {
      headers["x-ghl-location-id"] = normalizedLocationId;
    }
    if (tenantApiToken.trim()) {
      headers.authorization = `Bearer ${tenantApiToken.trim()}`;
    }
    return headers;
  }

  async function refreshSettings() {
    try {
      setStatus({ state: "loading", message: "Loading settings…" });
      const response = await fetch("/api/v1/settings", {
        method: "GET",
        headers: buildHeaders()
      });
      const data = (await response.json()) as ApiSettingsResponse;
      setSettings(data);
      if (!data.ok) {
        setStatus({ state: "error", message: data.error ?? "request_failed" });
        return;
      }
      setStatus({ state: "success", message: "Settings loaded." });
    } catch (error) {
      setStatus({ state: "error", message: safeErrorMessage(error) });
    }
  }

  async function savePdpToken(event: FormEvent) {
    event.preventDefault();

    if (!normalizedLocationId) {
      setStatus({
        state: "error",
        message: "Missing GHL location_id in the portal URL."
      });
      return;
    }

    const token = pdpToken.trim();
    if (!token) {
      setStatus({ state: "error", message: "Please paste your SUPER PDP token." });
      return;
    }

    try {
      setStatus({ state: "loading", message: "Saving SUPER PDP token…" });

      if (rememberToken && typeof window !== "undefined") {
        if (tenantApiToken.trim()) {
          window.localStorage.setItem(storageKey, tenantApiToken.trim());
        }
      }

      const response = await fetch("/api/v1/settings/pdp", {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "content-type": "application/json"
        },
        body: JSON.stringify({ token })
      });

      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setStatus({ state: "error", message: data.error ?? "request_failed" });
        return;
      }

      setPdpToken("");
      setStatus({ state: "success", message: "SUPER PDP token saved." });
      await refreshSettings();
    } catch (error) {
      setStatus({ state: "error", message: safeErrorMessage(error) });
    }
  }

  function forgetToken() {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(storageKey);
    setTenantApiToken("");
    setStatus({ state: "success", message: "Saved tenant token removed from this browser." });
  }

  const pdpConfigured = settings?.ok ? Boolean(settings.integrations?.pdp?.configured) : null;
  const pdpProvider = settings?.ok ? settings.integrations?.pdp?.provider : null;

  return (
    <section className="panel fade-up">
      <div className="panel-header">
        <div>
          <h3>Integrations</h3>
          <p>Connect this GHL subaccount to SUPER PDP.</p>
        </div>
        <button className="ghost-btn small" type="button" onClick={refreshSettings}>
          Refresh
        </button>
      </div>

      <div className="key-values" style={{ marginBottom: 16 }}>
        <div className="key-value">
          <span>GHL location_id</span>
          <strong>{normalizedLocationId || "Missing (add ?location_id=...)"}</strong>
        </div>
        <div className="key-value">
          <span>PDP provider</span>
          <strong>{pdpProvider ?? "Unknown"}</strong>
        </div>
        <div className="key-value">
          <span>SUPER PDP token</span>
          <strong>
            {pdpConfigured === null ? "Unknown" : pdpConfigured ? "Configured" : "Not set"}
          </strong>
        </div>
      </div>

      <form className="login-form" onSubmit={savePdpToken}>
        <label className="field">
          <span>CrocoTax tenant API token</span>
          <input
            type="password"
            placeholder="ct_live_..."
            value={tenantApiToken}
            onChange={(event) => setTenantApiToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>SUPER PDP token</span>
          <input
            type="password"
            placeholder="Paste your SUPER PDP access token…"
            value={pdpToken}
            onChange={(event) => setPdpToken(event.target.value)}
            autoComplete="off"
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={rememberToken}
            onChange={(event) => setRememberToken(event.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span className="muted">Remember tenant token on this browser</span>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="primary-btn" type="submit">
            Save SUPER PDP token
          </button>
          <button className="ghost-btn" type="button" onClick={forgetToken}>
            Forget tenant token
          </button>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          Status:{" "}
          {status.state === "idle"
            ? "Ready."
            : status.message ?? (status.state === "error" ? "Error." : "Working…")}
        </p>
      </form>
    </section>
  );
}
