export interface House {
  id: number;
  microdistrict: string;
  house_number: string;
  floors_count: number;
  apartments?: Apartment[];
}

export interface Apartment {
  id: number;
  house_id: number;
  floor: number;
  apartment_num: number;
  residents?: Resident[];
}

export interface Resident {
  id: number;
  apartment_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  move_in_date: string;
}
