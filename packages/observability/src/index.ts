import pino from "pino";

export type Logger = ReturnType<typeof pino>;

export function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info"
  });
}

export function withCorrelation(logger: Logger, correlationId: string) {
  return logger.child({ correlationId });
}

export * from "./metrics";
