export type Tenant = {
  id: string;
  type: string;
  name: string;
  code: string;
  medium: string;
  boardType: string;
  tenantCode: string;
  tenantName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  /**
   * Optional admission-number template. Tokens: {TENANT}, {BRANCH},
   * {YYYY}, {YY}, {AY}, {AYY}, {####}. Empty = manual entry.
   */
  admissionNumberPattern?: string | null;
};

export const initialTenants: Tenant[] = [
 
  
 
];

export function findTenantById(id: string) {
  return initialTenants.find((tenant) => tenant.id === id) ?? null;
}
