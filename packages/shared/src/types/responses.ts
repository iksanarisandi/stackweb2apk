// API Response types
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'user' | 'admin';
  };
}

export interface GenerateResponse {
  id: string;
  status: string;
  message: string;
}

export interface DownloadResponse {
  url: string;
  expires_at: string;
}
