export interface AuthProvider {
  session(): Promise<{ userId: string }>
}
