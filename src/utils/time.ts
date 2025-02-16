export function measureExecutionTime(taskName: string, fn: () => void) {
  const start = process.hrtime();
  fn();
  const [seconds, nanoseconds] = process.hrtime(start);
  const timeMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
  console.log(`🕒 ${taskName} completed in ${timeMs}ms`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
