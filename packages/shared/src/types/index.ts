// User types
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

// Generate types
export type GenerateStatus = 'pending' | 'confirmed' | 'building' | 'ready' | 'failed';
export type BuildType = 'webview' | 'html';

export interface Generate {
  id: string;
  user_id: string;
  url: string | null;  // Nullable for HTML view
  build_type: BuildType;  // NEW
  app_name: string;
  package_name: string;
  icon_key: string;
  html_files_key: string | null;  // NEW
  keystore_key: string | null;  // NEW
  keystore_password: string | null;  // NEW
  keystore_alias: string | null;  // NEW
  apk_key: string | null;
  aab_key: string | null;  // NEW
  amount: number;  // NEW
  status: GenerateStatus;
  error_message: string | null;
  download_count: number;
  enable_gps: boolean;
  enable_camera: boolean;
  html_file_count: number;  // NEW
  created_at: string;
  completed_at: string | null;
}

// Payment types
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface Payment {
  id: string;
  user_id: string;
  generate_id: string;
  amount: number;
  status: PaymentStatus;
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
}

// Re-export request/response types
export * from './requests';
export * from './responses';
