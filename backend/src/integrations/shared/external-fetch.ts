export const EXTERNAL_FETCH_TIMEOUT_MS = 12_000;

export class ApiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiRateLimitError';
  }
}

export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    EXTERNAL_FETCH_TIMEOUT_MS,
  );
  let response: Response;

  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `External API timed out after ${EXTERNAL_FETCH_TIMEOUT_MS / 1000}s: ${url}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      throw new ApiRateLimitError(
        'External sports API is rate-limited. Please wait a few seconds, then import fewer items at once.',
      );
    }

    throw new Error(`API request failed ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function fetchOptionalJson<T>(
  url: string,
  headers?: Record<string, string>,
) {
  try {
    return await fetchJson<T>(url, headers);
  } catch {
    return null;
  }
}
