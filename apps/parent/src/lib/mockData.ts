export interface FeeItem {
  amount: number;
  paid: boolean;
  paidDate?: string;
  receiptId?: string;
  dueDate: string;
  term: string;
}

export interface Child {
  id: string;
  name: string;
  school: string;
  grade: string;
  section: string;
  rollNumber: string;
  fees: {
    school: FeeItem;
    transportation: FeeItem;
    hostel: FeeItem;
  };
}

export interface ParentData {
  name: string;
  email: string;
  phone: string;
  children: Child[];
}

export const parentData: ParentData = {
  name: "Rajesh Kumar",
  email: "parent@svbk.com",
  phone: "+91 98765 43210",
  children: [
    {
      id: "1",
      name: "Arjun Kumar",
      school: "Sri Venkateswara Bala Kuteer",
      grade: "Grade 7",
      section: "Section A",
      rollNumber: "SVK-2024-701",
      fees: {
        school: {
          amount: 45000,
          paid: true,
          paidDate: "02 Apr 2026",
          receiptId: "RCP-2026-0042",
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        transportation: {
          amount: 12000,
          paid: false,
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        hostel: {
          amount: 35000,
          paid: true,
          paidDate: "01 Apr 2026",
          receiptId: "RCP-2026-0038",
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
      },
    },
    {
      id: "2",
      name: "Priya Kumar",
      school: "Sri Venkateswara Bala Kuteer",
      grade: "Grade 4",
      section: "Section B",
      rollNumber: "SVK-2024-412",
      fees: {
        school: {
          amount: 40000,
          paid: false,
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        transportation: {
          amount: 12000,
          paid: true,
          paidDate: "03 Apr 2026",
          receiptId: "RCP-2026-0045",
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        hostel: {
          amount: 35000,
          paid: false,
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
      },
    },
    {
      id: "3",
      name: "Vikram Kumar",
      school: "Sri Venkateswara Bala Kuteer",
      grade: "Grade 10",
      section: "Section C",
      rollNumber: "SVK-2022-1005",
      fees: {
        school: {
          amount: 52000,
          paid: true,
          paidDate: "01 Apr 2026",
          receiptId: "RCP-2026-0035",
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        transportation: {
          amount: 12000,
          paid: true,
          paidDate: "01 Apr 2026",
          receiptId: "RCP-2026-0036",
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
        hostel: {
          amount: 38000,
          paid: false,
          dueDate: "15 Apr 2026",
          term: "Term 1 – 2026",
        },
      },
    },
  ],
};
