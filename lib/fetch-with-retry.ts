interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Network request failed")
    );
  }
  return false;
}

function isRetryableError(error: unknown, response?: Response): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  if (response) {
    const status = response.status;
    return status === 408 || status === 429 || status >= 500 || status === 0;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
    onRetry,
    signal,
    ...fetchOptions
  } = options;

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const timeoutSignal = createTimeoutSignal(timeout);
      const abortController = new AbortController();

      if (signal) {
        signal.addEventListener("abort", () => abortController.abort());
      }
      timeoutSignal.addEventListener("abort", () => abortController.abort());

      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortController.signal,
      });

      const shouldRetry = !response.ok && isRetryableError(null, response);
      if (shouldRetry && attempt < retries) {
        lastResponse = response;
        const error = new Error(
          `Request failed with status ${response.status}`,
        );
        onRetry?.(attempt + 1, error);
        await delay(retryDelay * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (signal?.aborted) {
        throw new Error("Request was aborted");
      }

      const isNetworkErr = isNetworkError(error);
      if (isNetworkErr && attempt < retries) {
        onRetry?.(attempt + 1, lastError);
        await delay(retryDelay * (attempt + 1));
        continue;
      }

      if (attempt === retries) {
        if (lastResponse) {
          return lastResponse;
        }
        throw lastError;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error("Failed to fetch after retries");
}

export async function fetchJSON<T = unknown>(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}. ${errorText}`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}
