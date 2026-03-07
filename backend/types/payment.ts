export interface Payment {
  payment_id: number;
  ticket_id: number | null;
  cargo_id: number | null;
  amount: number;
  payment_method: 'Credit Card' | 'Cash' | 'Online Transfer';
  payment_status: 'Pending' | 'Completed' | 'Failed';
  payment_date: Date;
}