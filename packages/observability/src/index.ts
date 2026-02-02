import pino from "pino";

export type Logger = pino.Logger<string>;

export function createLogger() {
  return pino<string>({
    level: process.env.LOG_LEVEL ?? "info"
  });
}

export function withCorrelation(logger: Logger, correlationId: string) {
  return logger.child({ correlationId });
}

export * from "./metrics";
