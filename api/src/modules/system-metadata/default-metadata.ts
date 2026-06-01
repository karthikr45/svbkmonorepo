/**
 * Default system_metadata catalog — the seed data the UI assumes is
 * present (dropdown options). Both the CLI seed and the API boot run
 * this so a fresh clone never sees empty dropdowns.
 *
 * Super-admin can extend any list at runtime via the System Metadata
 * UI; nothing here is "the only allowed value".
 */
export const DEFAULT_METADATA: {
  type: string;
  value: string;
  displayOrder: number;
}[] = [
  // Academic years — a small rolling window. The Add-Tenant /
  // Add-Student forms use these; the AcademicYearSelect helper
  // current-year-detects regardless of order.
  { type: 'academic_year', value: '2024-2025', displayOrder: 1 },
  { type: 'academic_year', value: '2025-2026', displayOrder: 2 },
  { type: 'academic_year', value: '2026-2027', displayOrder: 3 },
  { type: 'academic_year', value: '2027-2028', displayOrder: 4 },

  // Boards
  { type: 'board_type', value: 'CBSE', displayOrder: 1 },
  { type: 'board_type', value: 'ICSE', displayOrder: 2 },
  { type: 'board_type', value: 'State', displayOrder: 3 },
  { type: 'board_type', value: 'IB', displayOrder: 4 },

  // Mediums
  { type: 'medium', value: 'English', displayOrder: 1 },
  { type: 'medium', value: 'Telugu', displayOrder: 2 },
  { type: 'medium', value: 'Hindi', displayOrder: 3 },

  // Tenant types
  { type: 'tenant_type', value: 'School', displayOrder: 1 },
  { type: 'tenant_type', value: 'Hostel', displayOrder: 2 },
  { type: 'tenant_type', value: 'Transport', displayOrder: 3 },

  // Classes
  ...[
    'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
    'Inter 1Y', 'Inter 2Y',
  ].map((v, i) => ({ type: 'class', value: v, displayOrder: i })),

  // Sections
  ...['A', 'B', 'C', 'D', 'E'].map((v, i) => ({
    type: 'section',
    value: v,
    displayOrder: i,
  })),

  // Inter streams
  ...['MPC', 'BiPC', 'CEC', 'MEC', 'HEC'].map((v, i) => ({
    type: 'stream',
    value: v,
    displayOrder: i,
  })),

  // Admin roles. The four built-ins drive permission gating; anything
  // else added here is a label only.
  { type: 'admin_role', value: 'admin', displayOrder: 1 },
  { type: 'admin_role', value: 'fin_admin', displayOrder: 2 },
  { type: 'admin_role', value: 'ops_admin', displayOrder: 3 },

  // Term labels
  { type: 'term', value: '1st Term Fee', displayOrder: 1 },
  { type: 'term', value: '2nd Term Fee', displayOrder: 2 },
  { type: 'term', value: '3rd Term Fee', displayOrder: 3 },
  { type: 'term', value: '4th Term Fee', displayOrder: 4 },
  { type: 'term', value: '5th Term Fee', displayOrder: 5 },

  // Billing mode + months
  { type: 'billing_mode', value: 'term_wise', displayOrder: 1 },
  { type: 'billing_mode', value: 'monthly', displayOrder: 2 },
  ...[
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March',
  ].map((v, i) => ({ type: 'month', value: v, displayOrder: i + 1 })),

  // Status enums surfaced in UI filters
  { type: 'payment_status', value: 'UNPAID', displayOrder: 1 },
  { type: 'payment_status', value: 'PARTIAL', displayOrder: 2 },
  { type: 'payment_status', value: 'PAID', displayOrder: 3 },
  { type: 'clearance_status', value: 'PENDING', displayOrder: 1 },
  { type: 'clearance_status', value: 'CLEARED', displayOrder: 2 },
  { type: 'clearance_status', value: 'BOUNCED', displayOrder: 3 },
  { type: 'template_status', value: 'approved', displayOrder: 1 },
  { type: 'template_status', value: 'rejected', displayOrder: 2 },

  // Tenant config dropdowns
  { type: 'environment_type', value: 'Production', displayOrder: 1 },
  { type: 'environment_type', value: 'QA', displayOrder: 2 },
  { type: 'environment_type', value: 'Development', displayOrder: 3 },
  { type: 'payment_gateway', value: 'Razorpay', displayOrder: 1 },
  { type: 'payment_gateway', value: 'Cashfree', displayOrder: 2 },

  // ── Geography. Flat lists; super-admin can extend from the System
  // Metadata UI without a deploy. If you need parent-child (state
  // belongs to country) add a `parent_value` column later.
  ...[
    'India',
    'United States',
    'United Kingdom',
    'United Arab Emirates',
    'Australia',
    'Canada',
    'Singapore',
  ].map((v, i) => ({ type: 'country', value: v, displayOrder: i + 1 })),

  // 28 states + 8 union territories of India.
  ...[
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ].map((v, i) => ({ type: 'state', value: v, displayOrder: i + 1 })),

  // Major Indian cities — admins extend per onboarding.
  ...[
    'Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Pune',
    'Delhi', 'New Delhi', 'Gurugram', 'Noida', 'Kolkata',
    'Ahmedabad', 'Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati',
    'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam',
    'Kochi', 'Thiruvananthapuram', 'Coimbatore', 'Madurai',
    'Tiruchirappalli', 'Mysuru', 'Mangaluru', 'Nagpur', 'Nashik',
    'Indore', 'Bhopal', 'Jaipur', 'Lucknow', 'Chandigarh',
    'Bhubaneswar', 'Patna', 'Surat', 'Vadodara',
  ].map((v, i) => ({ type: 'city', value: v, displayOrder: i + 1 })),
];
