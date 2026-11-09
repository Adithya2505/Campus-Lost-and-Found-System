export type Role = "user" | "admin";
export type SessionUser = {
  user_id: number;
  college_id: string;
  full_name: string;
  role: Role;
};
export type ItemStatus = "awaiting_deposit" | "available" | "collected";
export type Item = {
  item_id: number;
  category_id: number;
  category_name: string;
  item_name: string;
  description: string;
  color: string;
  brand: string;
  photo_path: string;
  found_location: string;
  found_date: string;
  status: ItemStatus;
  created_at: string;
};
export type ManagedItem = Item & {
  submitted_by_name: string;
  submitted_by_college_id: string;
  claimant_name: string | null;
  claimant_college_id: string | null;
  collected_at: string | null;
  handed_over_by_name: string | null;
};
export type Category = { category_id: number; category_name: string };
