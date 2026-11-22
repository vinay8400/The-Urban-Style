import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Package,
  Truck,
  Store,
  Clock3,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchCustomerOrder, type StoreOrder } from "../data/supabaseOrders";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!user || !orderId) return () => { active = false; };
    void fetchCustomerOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load order details.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [orderId, user]);

  if (authLoading) {
    return <main className="order-success-page" role="status">Loading your order…</main>;
  }
  if (!user) {
    const destination = `/order/success?orderId=${encodeURIComponent(orderId ?? "")}`;
    return <Navigate to={`/login?next=${encodeURIComponent(destination)}`} replace />;
  }
  if (!orderId) {
    return (
      <main className="order-success-page">
        <div className="order-success-card">
          <Package size={42} />
          <h1>Order Details Unavailable</h1>
          <p>No order reference was provided.</p>
          <Link to="/" className="order-success-primary">Back to Home</Link>
        </div>
      </main>
    );
  }
  if (loading) {
    return <main className="order-success-page" role="status">Loading your order…</main>;
  }
  if (error || !order) {
    return (
      <main className="order-success-page">
        <div className="order-success-card">
          <Package size={42} />
          <h1>Order Details Unavailable</h1>
          <p>{error || "This order is unavailable to your account. Please contact the store if you need help."}</p>
          <Link to="/" className="order-success-primary">Back to Home</Link>
        </div>
      </main>
    );
  }

  const isPickup = order.fulfillment_method === "pickup";
  const payment = order.payments[0];

  return (
    <main className="order-success-page">
      <section className="order-success-card">
        <div className="order-success-icon"><CheckCircle2 size={43} /></div>
        <span className="order-success-eyebrow">THE URBAN STYLE</span>
        <h1>Order Received!</h1>
        <p className="order-success-intro">
          Thank you, {order.customer_name_snapshot}. Your order has been recorded.
          The store will contact you to confirm it.
        </p>

        <div className="order-success-id">
          <span>YOUR ORDER ID</span>
          <strong>{order.order_number}</strong>
          <small>Save this ID to refer to your order.</small>
        </div>

        <div className="order-success-status">
          <Clock3 size={19} />
          <div>
            <strong>{order.order_status.replaceAll("_", " ")}</strong>
            <p>The store will contact you with updates about your order.</p>
          </div>
        </div>

        <div className="order-success-details">
          <h2>Order Information</h2>
          <div className="order-success-row">
            <span>Customer</span><strong>{order.customer_name_snapshot}</strong>
          </div>
          <div className="order-success-row">
            <span>Mobile</span><strong>{order.customer_phone_snapshot}</strong>
          </div>
          <div className="order-success-row">
            <span>Order Date</span>
            <strong>{new Date(order.created_at).toLocaleDateString("en-IN")}</strong>
          </div>
          <div className="order-success-row">
            <span>Payment Method</span>
            <strong>
              {order.payment_method === "cod"
                ? "Cash on Delivery"
                : order.payment_method === "upi" ? "UPI" : "Pay at Store"}
            </strong>
          </div>
          <div className="order-success-row">
            <span>Payment Status</span>
            <strong className="order-success-pending">
              {payment?.status.replaceAll("_", " ") ?? "Pending"}
            </strong>
          </div>
          <div className="order-success-row">
            <span>Fulfilment</span>
            <strong>{isPickup ? "Store Pickup" : "Local Delivery"}</strong>
          </div>

          {!isPickup && (
            <div className="order-success-address">
              <Truck size={19} />
              <div>
                <strong>Delivery Address</strong>
                <p>
                  {order.address_line_snapshot}, {order.city_snapshot} - {order.postal_code_snapshot}
                </p>
                <small>Delivery status: {order.delivery_radius_status.replaceAll("_", " ")}</small>
              </div>
            </div>
          )}
          {isPickup && (
            <div className="order-success-address">
              <Store size={19} />
              <div>
                <strong>Store Pickup</strong>
                <p>Behind RPS Inter College, Itaunja, Lucknow, Uttar Pradesh – 226203.</p>
                <small>Wait for store confirmation before visiting.</small>
              </div>
            </div>
          )}
        </div>

        <div className="order-success-details">
          <h2>Items Ordered</h2>
          {order.items.map((item) => (
            <div className="order-success-product" key={item.id}>
              <div>
                <strong>{item.product_name_snapshot}</strong>
                <small>SKU: {item.sku_snapshot}</small>
                <small>{item.color_snapshot} · Size {item.size_snapshot}</small>
                <small>Quantity: {item.quantity}</small>
              </div>
              <b>{money(item.line_total)}</b>
            </div>
          ))}
          <div className="order-success-total">
            <span>Product Subtotal</span><strong>{money(order.subtotal)}</strong>
          </div>
          <div className="order-success-total">
            <span>Delivery charge</span><strong>{money(order.delivery_charge)}</strong>
          </div>
          <div className="order-success-total">
            <span>Total</span><strong>{money(order.total)}</strong>
          </div>
          <p className="order-success-note">
            Payment status and delivery eligibility are managed by the store.
          </p>
        </div>

        <div className="order-success-actions">
          <Link to="/category/men" className="order-success-primary">
            <ShoppingBag size={16} /> Continue Shopping
          </Link>
          <Link to="/" className="order-success-secondary">Back to Home</Link>
        </div>
        <div className="order-success-help">
          <Truck size={17} />
          <span>Need help? Contact the store at 8090365996.</span>
        </div>
      </section>
    </main>
  );
}
