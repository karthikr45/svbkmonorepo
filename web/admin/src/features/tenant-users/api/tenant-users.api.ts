import { del, get, patch, post } from "@/lib/api-client";

export type TenantUserRole = "admin" | "fin_admin" | "ops_admin";

export const TENANT_USER_ROLES: { value: TenantUserRole; label: string; help: string }[] = [
  {
    value: "admin",
    label: "Admin",
    help: "Full tenant access including user management.",
  },
  {
    value: "fin_admin",
    label: "Finance Admin",
    help: "Fees, payments, receipts, reports.",
  },
  {
    value: "ops_admin",
    label: "Operations Admin",
    help: "Students, announcements, media. No fee write access.",
  },
];

export interface TenantUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TenantUserRole | "super_admin" | "parent";
  branch?: string | null;
  tenantId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantUserBody {
  firstName: string;
  lastName: string;
  email: string;
  role: TenantUserRole;
  branch?: string;
  password?: string;
}

export interface UpdateTenantUserBody {
  firstName?: string;
  lastName?: string;
  role?: TenantUserRole;
  branch?: string;
  password?: string;
  isActive?: boolean;
}

export async function listTenantUsersApi(): Promise<TenantUserRow[]> {
  return get<TenantUserRow[]>("/tenant-admins");
}

export async function createTenantUserApi(
  body: CreateTenantUserBody,
): Promise<TenantUserRow> {
  return post<TenantUserRow, CreateTenantUserBody>("/tenant-admins", body);
}

export async function updateTenantUserApi(
  id: string,
  body: UpdateTenantUserBody,
): Promise<TenantUserRow> {
  return patch<TenantUserRow>(`/tenant-admins/${id}`, body);
}

export async function deleteTenantUserApi(id: string): Promise<void> {
  await del(`/tenant-admins/${id}`);
}
