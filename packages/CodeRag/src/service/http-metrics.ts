type RouteMetrics = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
};

const formatRouteLabel = (route: string): string => route.replace(/[^a-zA-Z0-9_:]/g, "_");

/**
 * Collects lightweight request metrics for the built-in HTTP service.
 */
export class HttpMetricsCollector {
  private readonly metricsByRoute = new Map<string, RouteMetrics>();

  record(route: string, durationMs: number, isError: boolean): void {
    const metrics = this.metricsByRoute.get(route) ?? {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0
    };
    metrics.count += 1;
    metrics.errorCount += isError ? 1 : 0;
    metrics.totalDurationMs += durationMs;
    this.metricsByRoute.set(route, metrics);
  }

  render(): string {
    const lines = [
      "# HELP coderag_http_requests_total Total HTTP requests handled by CodeRag.",
      "# TYPE coderag_http_requests_total counter",
      "# HELP coderag_http_request_errors_total Total failed HTTP requests handled by CodeRag.",
      "# TYPE coderag_http_request_errors_total counter",
      "# HELP coderag_http_request_duration_ms_total Total request handling time in milliseconds.",
      "# TYPE coderag_http_request_duration_ms_total counter"
    ];

    for (const [route, metrics] of [...this.metricsByRoute.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const label = formatRouteLabel(route);
      lines.push(`coderag_http_requests_total{route="${label}"} ${metrics.count}`);
      lines.push(`coderag_http_request_errors_total{route="${label}"} ${metrics.errorCount}`);
      lines.push(`coderag_http_request_duration_ms_total{route="${label}"} ${metrics.totalDurationMs.toFixed(2)}`);
    }

    return `${lines.join("\n")}\n`;
  }
}
