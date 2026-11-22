import { supabase } from "../lib/supabase";

export interface StoreOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface StorePayment {
  id: string;
  order_id: string;
  method: "upi" | "cod" | "store";
  amount: number;
  status: "pending" | "pending_verification" | "paid" | "failed" | "refund_pending" | "refunded";
  upi_reference: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

export interface StoreOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  fulfillment_method: "delivery" | "pickup";
  address_recipient_snapshot: string | null;
  address_phone_snapshot: string | null;
  address_line_snapshot: string | null;
  city_snapshot: string | null;
  postal_code_snapshot: string | null;
  country_snapshot: string | null;
  delivery_radius_status: string;
  payment_method: "upi" | "cod" | "store";
  order_status: string;
  subtotal: number;
  delivery_charge: number;
  total: number;
  customer_notes: string;
  created_at: string;
  items: StoreOrderItem[];
  payments: StorePayment[];
}

const ORDER_COLUMNS = [
  "id", "order_number", "customer_id", "customer_name_snapshot",
  "customer_phone_snapshot", "fulfillment_method", "address_recipient_snapshot",
  "address_phone_snapshot", "address_line_snapshot", "city_snapshot",
  "postal_code_snapshot", "country_snapshot", "delivery_radius_status",
  "payment_method", "order_status", "subtotal", "delivery_charge", "total",
  "customer_notes", "created_at",
].join(",");

const ITEM_COLUMNS = [
  "id", "order_id", "product_id", "variant_id", "product_name_snapshot",
  "sku_snapshot", "size_snapshot", "color_snapshot", "unit_price",
  "quantity", "line_total",
].join(",");

const PAYMENT_COLUMNS = [
  "id", "order_id", "method", "amount", "status", "upi_reference",
  "verified_by", "verified_at",
].join(",");

function failureMessage(error: { message?: string } | null, operation: string) {
  return error?.message || `Unable to ${operation}. Check your account permissions and Supabase configuration.`;
}

async function attachOrderDetails(
  rows: Record<string, unknown>[],
): Promise<StoreOrder[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id as string);
  const [itemsResult, paymentsResult] = await Promise.all([
    supabase.from("order_items").select(ITEM_COLUMNS).in("order_id", ids),
    supabase.from("payments").select(PAYMENT_COLUMNS).in("order_id", ids),
  ]);
  if (itemsResult.error) throw new Error(failureMessage(itemsResult.error, "load order items"));
  if (paymentsResult.error) throw new Error(failureMessage(paymentsResult.error, "load payment details"));

  const items = (itemsResult.data ?? []) as unknown as StoreOrderItem[];
  const payments = (paymentsResult.data ?? []) as unknown as StorePayment[];
  return rows.map((row) => ({
    ...row,
    subtotal: Number(row.subtotal),
    delivery_charge: Number(row.delivery_charge),
    total: Number(row.total),
    items: items.filter((item) => item.order_id === row.id),
    payments: payments.filter((payment) => payment.order_id === row.id),
  })) as StoreOrder[];
}

export async function fetchAdminOrders(): Promise<StoreOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(failureMessage(error, "load store orders"));
  return attachOrderDetails((data ?? []) as unknown as Record<string, unknown>[]);
}

export async function fetchCustomerOrder(orderId: string): Promise<StoreOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(failureMessage(error, "load order"));
  if (!data) return null;
  const [order] = await attachOrderDetails([data as unknown as Record<string, unknown>]);
  return order ?? null;
}

export async function fetchCustomerOrderByNumber(orderNumber: string): Promise<StoreOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw new Error(failureMessage(error, "search order"));
  return data ? fetchCustomerOrder(data.id) : null;
}

export async function advanceStoreOrder(orderId: string, nextStatus: string) {
  const { error } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_next_status: nextStatus,
  });
  if (error) throw new Error(failureMessage(error, "update order status"));
}

export async function cancelStoreOrder(orderId: string) {
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) throw new Error(failureMessage(error, "cancel order"));
}

export async function fulfillStoreOrder(orderId: string) {
  const { error } = await supabase.rpc("fulfill_order", { p_order_id: orderId });
  if (error) throw new Error(failureMessage(error, "fulfil order"));
}

export async function verifyStorePayment(orderId: string, adminUserId: string) {
  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      verified_by: adminUserId,
      verified_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .eq("method", "upi")
    .eq("status", "pending_verification")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(failureMessage(error, "verify UPI payment"));
  if (!data) throw new Error("This UPI payment is no longer awaiting verification.");
}
