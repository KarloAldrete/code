import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { LogLevel, StoredNotification } from "./types";
import type { Logger } from "./utils/logger";

export interface OtelLogConfig {
  /** PostHog ingest host, e.g., "https://us.i.posthog.com" */
  posthogHost: string;
  /** Project API key, e.g., "phc_xxx" */
  apiKey: string;
  /** Batch flush interval in ms (default: 500) */
  flushIntervalMs?: number;
  /** Override the logs endpoint path (default: /i/v1/logs) */
  logsPath?: string;
}

/**
 * Session context for resource attributes.
 * These are set once per OTEL logger instance and indexed via resource_fingerprint
 */
export interface SessionContext {
  /** Parent task grouping - all runs for a task share this */
  taskId: string;
  /** Primary conversation identifier - all events in a run share this */
  runId: string;
  /** Deployment environment - "local" for desktop, "cloud" for cloud sandbox */
  deviceType?: "local" | "cloud";
  /** Agent version, surfaced as the OTEL service.version resource attribute */
  serviceVersion?: string;
}

/** Maps the agent's log levels onto OTEL severities. */
const LOG_LEVEL_TO_SEVERITY: Record<
  LogLevel,
  { number: SeverityNumber; text: string }
> = {
  debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
};

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export class OtelLogWriter {
  private loggerProvider: LoggerProvider;
  private logger: ReturnType<LoggerProvider["getLogger"]>;

  constructor(
    config: OtelLogConfig,
    sessionContext: SessionContext,
    _debugLogger?: Logger,
  ) {
    const logsPath = config.logsPath ?? "/i/v1/logs";
    const exporter = new OTLPLogExporter({
      url: `${config.posthogHost}${logsPath}`,
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    const processor = new BatchLogRecordProcessor(exporter, {
      scheduledDelayMillis: config.flushIntervalMs ?? 500,
    });

    // Resource attributes are set ONCE per session and indexed via resource_fingerprint
    // So we have fast queries by run_id/task_id in PostHog Logs UI
    this.loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: "posthog-code-agent",
        ...(sessionContext.serviceVersion
          ? { [ATTR_SERVICE_VERSION]: sessionContext.serviceVersion }
          : {}),
        run_id: sessionContext.runId,
        task_id: sessionContext.taskId,
        device_type: sessionContext.deviceType ?? "local",
      }),
      processors: [processor],
    });

    this.logger = this.loggerProvider.getLogger("agent-session");
  }

  /**
   * Emit a structured agent log line to PostHog Logs.
   *
   * Maps the agent's log level onto an OTEL severity and stores the scope as a
   * `log.scope` attribute (mirroring the desktop electron-log OTEL transport),
   * so cloud-run logs are queryable by run_id / task_id / severity.
   */
  emitLog(
    level: LogLevel,
    scope: string,
    message: string,
    data?: unknown,
  ): void {
    const severity = LOG_LEVEL_TO_SEVERITY[level] ?? LOG_LEVEL_TO_SEVERITY.info;
    const body =
      data !== undefined ? `${message} ${safeStringify(data)}` : message;

    this.logger.emit({
      severityNumber: severity.number,
      severityText: severity.text,
      body,
      attributes: { "log.scope": scope },
    });
  }

  /**
   * Emit an agent event to PostHog Logs via OTEL.
   */
  emit(entry: { notification: StoredNotification }): void {
    const { notification } = entry;
    const eventType = notification.notification.method;

    this.logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: JSON.stringify(notification),
      attributes: {
        event_type: eventType,
      },
    });
  }

  async flush(): Promise<void> {
    await this.loggerProvider.forceFlush();
  }

  async shutdown(): Promise<void> {
    await this.loggerProvider.shutdown();
  }
}
