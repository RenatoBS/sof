export type Account = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  plan: string;
  planPrice: number;
  whatsappPhoneNumberId: string;
  status: string;
  createdAt: string;
};

export type Employee = {
  id: string;
  accountId: string;
  name: string;
  specialty: string;
  phone: string;
  color: string;
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
