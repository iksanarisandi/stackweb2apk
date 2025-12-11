/**
 * Authentication utilities for Web2APK frontend
 * Handles JWT token storage and retrieval
 */

const TOKEN_KEY = 'web2apk_token';
const USER_KEY = 'web2apk_user';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Store authentication token and user data
 * Note: For production, httpOnly cookies should be set by the server
 * This is a client-side fallback for development
 */
export function setAuth(token: string, user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Get stored authentication token
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Get stored user data
 */
export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem(USER_KEY);
    if (userData) {
      try {
        return JSON.parse(userData) as User;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Clear authentication data (logout)
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Check if user has admin role
 */
export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}
