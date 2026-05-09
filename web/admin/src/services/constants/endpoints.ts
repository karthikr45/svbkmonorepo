/**
 *  endpoints by feature. Add new features (auth, user, …) here.
 */

// import { notification } from "@/features/notifications/service/notification.service";

export const API_ENDPOINTS = {
  auth: {
    verifyLogin: "/verifyLogin",
    logout: "/logout",
    refreshToken: "/refresh",
  },
  user: {
    profile: "/user/profile",
    update: "/user/update",
  },
  studentsDetails: {
    getStudentsDetailsByBranch: "/students",
    getStudentById: "/students", // usage: /students/:id
    updateStudentById: "/students", // usage: /students/:id
    getAcademicYears: "/academic-years",
    getStudentByAdmission: "/studentsDetails/getStudentDetailsByAdmission",
    addPenalty: "/fees/penalty/add",
    waivePenalty: "/fees/penalty/waive",
    createOrder: "/studentsDetails/create/order",
    checkTermDetails: "/students/upload/validate",
    uploadStudentData: "/students/upload/confirm",
    getAdminNotifications:"/studentsDetails/getAdminNotifications",
    getLatestStudents: "/students/latest",
  },
  templates: {
    getTemplates: "/templates",
    saveTemplate: "/templates",
  },
  tenants: {
    saveTenant: "/tenants/save",
    getTenants: "/tenants/get-tenant",
    getTenantById: "/tenants/get-tenant",  // usage: /tenants/get-tenant/:id
    saveTenantConfig: "/tenant-configs/upsert",
    /** GET usage: /tenant-configs/tenant/:tenantId */
    getTenantConfigsByTenantId: "/tenant-configs/tenant",
    /** GET/DELETE usage: /tenant-configs/:id */
    deleteTenantConfigById: "/tenant-configs",
    updateTenant: "/tenants/update",       // usage: /tenants/update/:id
  },
  admins: {
    saveAdmin: "/admins/save",
    getAdmins: "/admins/get-admin",
  },
  payments: {
    createOrder: "/payments/create-order",
    verifyPayment: "/payments/verify-payment",
  },
  payNow: {
    getStudentWithFees: "/students/by-admission/with-fees",
  },
  fees: {
    getDashboardStats: "/fees/dashboard/stats",
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
