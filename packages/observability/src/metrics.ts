type Labels = Record<string, string | number | boolean>;

interface CounterState {
  name: string;
  help?: string;
  values: Map<string, number>;
}

const counters = new Map<string, CounterState>();

function labelsKey(labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}="${String(value)}"`);
  return `{${parts.join(",")}}`;
}

export function registerCounter(name: string, help?: string): void {
  if (!counters.has(name)) {
    counters.set(name, { name, help, values: new Map() });
  }
}

export function incCounter(name: string, labels?: Labels, value = 1): void {
  if (!counters.has(name)) {
    registerCounter(name);
  }
  const counter = counters.get(name);
  if (!counter) {
    return;
  }
  const key = labelsKey(labels);
  const current = counter.values.get(key) ?? 0;
  counter.values.set(key, current + value);
}

export function renderMetrics(): string {
  const lines: string[] = [];
  for (const counter of counters.values()) {
    if (counter.help) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
    }
    lines.push(`# TYPE ${counter.name} counter`);
    if (counter.values.size === 0) {
      lines.push(`${counter.name} 0`);
      continue;
    }
    for (const [key, value] of counter.values.entries()) {
      lines.push(`${counter.name}${key} ${value}`);
    }
  }
  return lines.join("\n") + "\n";
}
