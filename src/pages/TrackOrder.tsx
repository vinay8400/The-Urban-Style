import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Search,
  Package,
  CheckCircle2,
  Clock3,
  Truck,
  Store,
  XCircle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchCustomerOrderByNumber, type StoreOrder } from "../data/supabaseOrders";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const statusSteps = [
  { key: "pending_confirmation", label: "Order Received", icon: Package },
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing Order", icon: Clock3 },
  { key: "dispatched", label: "Ready / Dispatched", icon: Truck },
  { key: "fulfilled", label: "Delivered / Collected", icon: Store },
];

const statusLabels: Record<string, string> = {
  pending_confirmation: "Awaiting store confirmation",
  confirmed: "Order confirmed",
  preparing: "Preparing your order",
  dispatched: "Ready for pickup / Out for delivery",
  fulfilled: "Delivered / Collected",
  cancelled: "Order cancelled",
};

export default function TrackOrder() {
  const { user, loading: authLoading } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setSearched(true);

    if (!orderId.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid Order ID and 10-digit mobile number.");
      return;
    }

    try {
      const found = await fetchCustomerOrderByNumber(orderId.trim());
      if (!found || found.customer_phone_snapshot !== phone.trim()) {
        setError("No matching order found. Check your Order ID and mobile number.");
        return;
      }
      setOrder(found);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search orders. Please try again.");
    }
  }

  if (authLoading) return <main className="track-order-page" role="status">Checking your sign-in…</main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent("/track-order")}`} replace />;

  const currentIndex = order
    ? statusSteps.findIndex((step) => step.key === order.order_status)
    : -1;

  return (
    <main className="track-order-page">
      <header className="track-order-heading">
        <span>THE URBAN STYLE</span>
        <h1>Track Your Order</h1>
        <p>Enter your order details to view its latest status.</p>
      </header>

      <section className="track-order-search-card">
        <form onSubmit={handleSearch}>
          <label>
            Order ID
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="              Example: TUS-AB12CD34EF56"
              required
            />
          </label>

          <label>
            Registered Mobile Number
            <input
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="10-digit mobile number"
              inputMode="numeric"
              required
            />
          </label>

          {error && <p className="track-order-error" role="alert">{error}</p>}

          <button type="submit">
            <Search size={16} /> Track Order
          </button>
        </form>
      </section>

      {searched && !order && !error && (
        <p className="track-order-empty">No order found.</p>
      )}

      {order && (
        <section className="track-order-result">
          <div className="track-order-result-heading">
            <div>
              <span>ORDER REFERENCE</span>
              <h2>{order.order_number}</h2>
              <p>
                Placed on {new Date(order.created_at).toLocaleDateString("en-IN")}
              </p>
            </div>
            <strong className="track-order-status-badge">
              {statusLabels[order.order_status] || "Status unavailable"}
            </strong>
          </div>

          {order.order_status === "cancelled" ? (
            <div className="track-order-cancelled">
              <XCircle size={26} />
              <strong>This order has been cancelled.</strong>
            </div>
          ) : (
            <div className="track-order-timeline">
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                const completed = currentIndex >= index;

                return (
                  <div
                    className={`track-order-step ${completed ? "completed" : ""}`}
                    key={step.key}
                  >
                    <div className="track-order-step-icon">
                      <Icon size={18} />
                    </div>
                    <div>
                      <strong>{step.label}</strong>
                      <small>
                        {completed ? "Completed" : "Awaiting update"}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="track-order-info">
            <h3>Order Details</h3>

            <div className="track-order-info-row">
              <span>Customer</span>
              <strong>{order.customer_name_snapshot}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Mobile</span>
              <strong>{order.customer_phone_snapshot}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Fulfilment</span>
              <strong>
                {order.fulfillment_method === "pickup"
                  ? "Store Pickup"
                  : "Local Delivery"}
              </strong>
            </div>

            <div className="track-order-info-row">
              <span>Payment</span>
              <strong>
                {order.payment_method === "cod"
                  ? "Cash on Delivery"
                  : order.payment_method === "upi"
                    ? "UPI"
                    : "Pay at Store"}
              </strong>
            </div>

            <div className="track-order-info-row">
              <span>Payment Status</span>
              <strong>{order.payments[0]?.status.replaceAll("_", " ") ?? "Pending"}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Order Total</span>
              <strong>{money(order.total)}</strong>
            </div>
          </div>

          <div className="track-order-products">
            <h3>Items in this Order</h3>

            {order.items.map((item) => (
              <div
                className="track-order-product"
                key={item.id}
              >
                <div>
                  <strong>{item.product_name_snapshot}</strong>
                  <small>{item.color_snapshot} · Size {item.size_snapshot}</small>
                  <small>Quantity: {item.quantity}</small>
                </div>
                <b>{money(item.line_total)}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="track-order-footer-link">
        <Link to="/">← Back to Home</Link>
        <Link to="/category/men">Continue Shopping →</Link>
      </div>
    </main>
  );
}