import type { ID, Role } from './domain'

export interface SessionUser {
  id: ID
  role: Role
  fullName: string
  email: string
  avatarUrl?: string
}

export interface Session {
  user: SessionUser
}

export type OAuthProvider = 'google' | 'microsoft'

export interface SignInInput {
  email: string
  password: string
  remember: boolean
}

export interface SignUpInput {
  fullName: string
  email: string
  password: string
}
