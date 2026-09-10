export type AuthUser = {
  email: string;
  full_name: string;
  id: string;
  role: string;
};

export type StoreRecord = {
  banner_url: string | null;
  contact_email: string;
  description: string;
  id: string;
  logo_url: string | null;
  name: string;
  owner_id: string;
  phone: string | null;
  slug: string;
  status: string;
};

export type CategoryRecord = {
  description: string | null;
  id: string;
  name: string;
  slug: string;
};

export type ProductRecord = {
  category_id: string;
  currency: string;
  description: string;
  featured_image_url: string | null;
  id: string;
  name: string;
  owner_id: string;
  price: string;
  sku: string;
  slug: string;
  sold_quantity: number;
  status: string;
  stock_quantity: number;
  store_id: string;
};

export type OrderRecord = {
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string | null;
  created_at: string;
  id: string;
  owner_id: string;
  payment_method: string;
  payment_reference: string;
  product_id: string;
  quantity: number;
  shipping_address: string;
  status: string;
  store_id: string;
  total_price: string;
  unit_price: string;
};
