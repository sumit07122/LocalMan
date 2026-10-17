export const Roles = {
  CUSTOMER: 'CUSTOMER',
  PROVIDER: 'PROVIDER',
  ADMIN: 'ADMIN',
  CITY_MANAGER: 'CITY_MANAGER',
  KYC_VERIFIER: 'KYC_VERIFIER',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
} as const;

export type RoleType = (typeof Roles)[keyof typeof Roles];
