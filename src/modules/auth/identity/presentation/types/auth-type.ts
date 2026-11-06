export const AuthTypes = {
  NONE: 'NONE',
  BEARER: 'BEARER',
  COOKIE: 'COOKIE',
} as const;
export type AuthTypes = keyof typeof AuthTypes;
