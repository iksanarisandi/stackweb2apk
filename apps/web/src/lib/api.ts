/**
 * API client utilities for Web2APK frontend
 */

const API_BASE_URL = 'https://web2apk-api.threadsauto.workers.dev';

export interface ApiError {
  error: string;
  message: string;
  details?: {
    issues?: Array<{ path: string; message: string }>;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

/**
 * Make an API request with proper error handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: {
          error: data.error || 'UNKNOWN_ERROR',
          message: data.message || 'An unexpected error occurred',
          details: data.details,
        },
      };
    }

    return { data };
  } catch {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please try again.',
      },
    };
  }
}

/**
 * Make an authenticated API request
 */
export async function authApiRequest<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
