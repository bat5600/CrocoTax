const LS_TENANT_KEY = "crocotax_tenant_id";
const LS_TOKEN_KEY = "crocotax_api_token";

export function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_TENANT_KEY);
}

export function getApiToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_TOKEN_KEY);
}

export function getTenantName(): string {
  const id = getTenantId();
  return id ?? "No tenant configured";
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error("NO_TENANT");
  }

  const token = getApiToken();
  const headers: Record<string, string> = {
    "x-tenant-id": tenantId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`/api/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Status display helpers ──────────────────────────────────────────

const STATUS_LABEL_MAP: Record<string, string> = {
  NEW: "Processing",
  FETCHED: "Processing",
  MAPPED: "Processing",
  GENERATED: "Processing",
  SUBMITTED: "Pending",
  SYNCED: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  PAID: "Paid",
  ERROR: "Error",
};

const TONE_MAP: Record<string, string> = {
  Accepted: "ok",
  Paid: "ok",
  Processing: "pending",
  Pending: "pending",
  Rejected: "failed",
  Error: "failed",
};

export function displayStatus(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  return STATUS_LABEL_MAP[raw.toUpperCase()] ?? raw;
}

export function statusTone(displayLabel: string): string {
  return TONE_MAP[displayLabel] ?? "pending";
}

// ── Filter categories ───────────────────────────────────────────────

export type FilterCategory = "All" | "Accepted" | "Pending" | "Rejected";

export function matchesFilter(
  displayLabel: string,
  filter: FilterCategory
): boolean {
  if (filter === "All") return true;
  if (filter === "Accepted") return displayLabel === "Accepted" || displayLabel === "Paid";
  if (filter === "Pending") return displayLabel === "Pending" || displayLabel === "Processing";
  if (filter === "Rejected") return displayLabel === "Rejected" || displayLabel === "Error";
  return true;
}

// ── Relative time helper ────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
