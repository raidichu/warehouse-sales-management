export interface JwtPayload {
  sub: string;       // user id
  email: string;
  fullName: string;
  permissions: string[];
}
