export const IdempotencyStep = {
  WEBHOOK: "WEBHOOK",
  FETCH: "FETCH",
  MAP: "MAP",
  GENERATE: "GENERATE",
  SUBMIT: "SUBMIT",
  SYNC: "SYNC"
} as const;

export type IdempotencyStep = (typeof IdempotencyStep)[keyof typeof IdempotencyStep];

export function buildIdempotencyKey(step: IdempotencyStep, ...parts: string[]): string {
  return [step, ...parts].join(":");
}
