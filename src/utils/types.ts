export interface UserJwtPayload {
  email: string;
  role: 0 | 1;
  id: number;
  refresh: boolean;
}
