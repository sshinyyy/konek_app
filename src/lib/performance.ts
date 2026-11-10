type PerformanceOperation = "auth.login" | "requests.list";

export function logPerformance(operation: PerformanceOperation, startedAt: number): void {
  if (process.env.PERFORMANCE_LOGS !== "true") return;
  console.info(JSON.stringify({
    event: "app.performance",
    operation,
    durationMs: Math.round(performance.now() - startedAt),
  }));
}
