export interface Cargo {
  cargo_id: number;
  flight_id: number;
  tracking_number: string;
  cargo_type: 'General' | 'Perishable' | 'Hazardous' | 'Fragile' | 'Live Animals' | 'Mail';
  description: string | null;
  weight_kg: number;
  origin_airport_id: number;
  destination_airport_id: number;
  sender_name: string;
  sender_contact: string;
  reciever_name: string;
  reciever_contact: string;
  status: 'Booked' | 'Loaded' | 'In Transit' | 'Unloaded' | 'Customs Hold' | 'Delivered' | 'Cancelled';
  is_insured: boolean;
}