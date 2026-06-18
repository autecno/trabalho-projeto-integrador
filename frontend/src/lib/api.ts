import { clearStoredToken, getValidStoredToken } from "./auth";

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

const SESSION_EXPIRED_MESSAGE =
  "Sua sessão expirou. Entre novamente para continuar.";

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { auth = true, headers, ...requestOptions } = options;
  const nextHeaders = new Headers(headers);

  if (auth) {
    const token = getValidStoredToken();
    if (!token) {
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
    }

    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...requestOptions,
    headers: nextHeaders,
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
  }

  return response;
}

export async function readApiJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : fallbackMessage;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function getFriendlyErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}
