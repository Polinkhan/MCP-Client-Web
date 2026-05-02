export interface AttendanceRecord {
  date: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MeResponse {
  id: string | number;
  name?: string;
  email?: string;
  [key: string]: unknown;
}
