export interface LoginCredentials {
  email: string;
  password: string;
}

/** User info stored in-app after login. */
export interface AuthUser {
  email: string;
  role: string;
  tenantId: string;
  id : string;
}

/** Shape of `data.response` from the login/refresh endpoint. */
export interface LoginApiData {
  accessToken: string;
  refreshToken: string;
  email: string;
  role: string;
  tenantId: string;
  id: string;
}

/** Full API response wrapper from the backend. */
export interface LoginResponse {
  success: boolean;
  data: {
    message: string;
    response: LoginApiData;
  };
  message: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
}
