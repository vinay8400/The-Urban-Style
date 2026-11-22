import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Package,
  CheckCircle2,
  Clock3,
  Truck,
  Store,
  XCircle,
} from "lucide-react";

interface SavedOrder {
  orderId: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
  fulfilment: {
    method: "delivery" | "pickup";
    address: string;
    city: string;
    pincode: string;
  };
  payment: {
    method: string;
    status: string;
  };
  items: {
    productId: string;
    name: string;
    price: number;
    image: string;
    size: string;
    color: string;
    quantity: number;
  }[];
  subtotal: number;
  total: number;
  orderStatus: string;
}

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
  { key: "delivered", label: "Delivered / Collected", icon: Store },
];

const statusLabels: Record<string, string> = {
  pending_confirmation: "Awaiting store confirmation",
  confirmed: "Order confirmed",
  preparing: "Preparing your order",
  dispatched: "Ready for pickup / Out for delivery",
  delivered: "Delivered / Collected",
  cancelled: "Order cancelled",
};

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setSearched(true);

    if (!orderId.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid Order ID and 10-digit mobile number.");
      return;
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem("urban-style-orders") || "[]",
      );

      if (!Array.isArray(saved)) {
        setError("Unable to read order records.");
        return;
      }

      const found = saved.find(
        (item: SavedOrder) =>
          item.orderId.toLowerCase() === orderId.trim().toLowerCase() &&
          item.customer.phone === phone.trim(),
      );

      if (!found) {
        setError("No matching order found. Check your Order ID and mobile number.");
        return;
      }

      setOrder(found);
    } catch {
      setError("Unable to search orders. Please try again.");
    }
  }

  const currentIndex = order
    ? statusSteps.findIndex((step) => step.key === order.orderStatus)
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
              placeholder="Example: TUS362801072"
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
              <h2>{order.orderId}</h2>
              <p>
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN")}
              </p>
            </div>
            <strong className="track-order-status-badge">
              {statusLabels[order.orderStatus] || "Status unavailable"}
            </strong>
          </div>

          {order.orderStatus === "cancelled" ? (
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
              <strong>{order.customer.name}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Mobile</span>
              <strong>{order.customer.phone}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Fulfilment</span>
              <strong>
                {order.fulfilment.method === "pickup"
                  ? "Store Pickup"
                  : "Local Delivery"}
              </strong>
            </div>

            <div className="track-order-info-row">
              <span>Payment</span>
              <strong>
                {order.payment.method === "cod"
                  ? "Cash on Delivery"
                  : order.payment.method === "upi"
                    ? "UPI"
                    : "Pay at Store"}
              </strong>
            </div>

            <div className="track-order-info-row">
              <span>Payment Status</span>
              <strong>{order.payment.status.replaceAll("_", " ")}</strong>
            </div>

            <div className="track-order-info-row">
              <span>Order Total</span>
              <strong>{money(order.total)}</strong>
            </div>
          </div>

          <div className="track-order-products">
            <h3>Items in this Order</h3>

            {order.items.map((item, index) => (
              <div
                className="track-order-product"
                key={`${item.productId}-${item.size}-${index}`}
              >
                <img src={item.image} alt={item.name} />
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.color} · Size {item.size}</small>
                  <small>Quantity: {item.quantity}</small>
                </div>
                <b>{money(item.price * item.quantity)}</b>
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