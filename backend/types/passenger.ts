export interface Passenger {
  passenger_id: number;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  passport_number: string;
  nationality: string;
  date_of_birth: Date;
  contact_number: string;
  email: string;
  created_at: Date;
}