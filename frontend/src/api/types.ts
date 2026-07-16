/** Índice 0 = domingo … 6 = sábado. */
export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

export type OpeningHours = DaySchedule[];

export type Account = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  plan: string;
  planPrice: number;
  whatsappPhoneNumberId: string;
  openingHours: OpeningHours;
  status: string;
  createdAt: string;
};

export type Service = {
  id: string;
  accountId: string;
  name: string;
  duration: number;
  price: number;
  createdAt: string;
};

export type Employee = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  color: string;
  services: Service[];
  createdAt: string;
};

export type EmployeeSession = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  color: string;
  mustChangePassword: boolean;
  businessName: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  accountId: string;
  employeeId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  price: number;
  status: string;
  source: 'manual' | 'whatsapp';
  createdAt: string;
};
