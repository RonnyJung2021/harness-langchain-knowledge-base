/**
 * 全局串行执行「替换 KB」相关逻辑，避免并发 ingest 损坏 kb_store。
 */
export function createReplaceKbExclusive(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const current = tail.then(() => fn());
    tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  };
}
