export function withDbTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
