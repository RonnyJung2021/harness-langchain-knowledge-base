/**
 * 同一 `sessionId` 上的异步任务串行执行，避免并发 POST `/messages` 交错读写 history。
 */
export function createPerSessionExclusive(): <T>(
  sessionId: string,
  fn: () => Promise<T>,
) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>();

  return <T>(sessionId: string, fn: () => Promise<T>): Promise<T> => {
    const prev = tails.get(sessionId) ?? Promise.resolve();
    const current = prev.then(() => fn());
    tails.set(sessionId, current);
    void current.finally(() => {
      if (tails.get(sessionId) === current) {
        tails.delete(sessionId);
      }
    });
    return current;
  };
}
