type DbResult = { error: { code?: string; message: string } | null };

export async function retryTransientDb<T extends DbResult>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  const first = await operation();
  return first.error?.message.includes("fetch failed")
    ? await operation()
    : first;
}
