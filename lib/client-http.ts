export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 12_000) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export async function readJson<T>(response: Response): Promise<Partial<T>> {
  try {
    return await response.json() as T;
  } catch {
    return {};
  }
}
