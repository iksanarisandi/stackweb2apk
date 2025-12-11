// API Request types
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GenerateRequest {
  url: string;
  app_name: string;
  package_name: string;
  icon: File;
}

// Build Pipeline types
export interface BuildPayload {
  generate_id: string;
  url: string;
  app_name: string;
  package_name: string;
  icon_url: string;
  callback_url: string;
}

export interface BuildCallbackPayload {
  generate_id: string;
  success: boolean;
  apk_key?: string;
  error_message?: string;
}
