// ── Requests ─────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  /** Mínimo 8 caracteres */
  password: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  /** 8–72 caracteres */
  password: string
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
}

export interface RegisterResponse {
  message: string
}

export interface ForgotPasswordResponse {
  message: string
}

export interface ResetPasswordResponse {
  message: string
}
