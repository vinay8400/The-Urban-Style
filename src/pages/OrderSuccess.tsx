import { Link, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import {
  CheckCircle2,
  Package,
  Truck,
  Store,
  Clock3,
  ShoppingBag,
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
    deliveryRadiusStatus: string;
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

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  const order = useMemo<SavedOrder | null>(() => {
    if (!orderId) return null;

    try {
      const saved = JSON.parse(
        localStorage.getItem("urban-style-orders") || "[]",
      );

      if (!Array.isArray(saved)) return null;

      return saved.find((item: SavedOrder) => item.orderId === orderId) ?? null;
    } catch {
      return null;
    }
  }, [orderId]);

  if (!order) {
    return (
      <main className="order-success-page">
        <div className="order-success-card">
          <Package size={42} />
          <h1>Order Details Unavailable</h1>
          <p>
            We could not find this order in this browser. Please contact the
            store if you need help.
          </p>
          <Link to="/" className="order-success-primary">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const isPickup = order.fulfilment.method === "pickup";

  return (
    <main className="order-success-page">
      <section className="order-success-card">
        <div className="order-success-icon">
          <CheckCircle2 size={43} />
        </div>

        <span className="order-success-eyebrow">THE URBAN STYLE</span>
        <h1>Order Received!</h1>
        <p className="order-success-intro">
          Thank you, {order.customer.name}. Your order has been recorded.
          The store will contact you to confirm it.
        </p>

        <div className="order-success-id">
          <span>YOUR ORDER ID</span>
          <strong>{order.orderId}</strong>
          <small>
            Save this ID to refer to your order.
          </small>
        </div>

        <div className="order-success-status">
          <Clock3 size={19} />
          <div>
            <strong>Awaiting store confirmation</strong>
            <p>
              Your order is not yet confirmed. The store will verify
              availability and contact you.
            </p>
          </div>
        </div>

        <div className="order-success-details">
          <h2>Order Information</h2>

          <div className="order-success-row">
            <span>Customer</span>
            <strong>{order.customer.name}</strong>
          </div>

          <div className="order-success-row">
            <span>Mobile</span>
            <strong>{order.customer.phone}</strong>
          </div>

          <div className="order-success-row">
            <span>Order Date</span>
            <strong>
              {new Date(order.createdAt).toLocaleDateString("en-IN")}
            </strong>
          </div>

          <div className="order-success-row">
            <span>Payment Method</span>
            <strong>
              {order.payment.method === "cod"
                ? "Cash on Delivery"
                : order.payment.method === "upi"
                  ? "UPI"
                  : "Pay at Store"}
            </strong>
          </div>

          <div className="order-success-row">
            <span>Payment Status</span>
            <strong className="order-success-pending">
              Pending verification
            </strong>
          </div>

          <div className="order-success-row">
            <span>Fulfilment</span>
            <strong>{isPickup ? "Store Pickup" : "Local Delivery"}</strong>
          </div>

          {!isPickup && (
            <div className="order-success-address">
              <MapPinFallback />
              <div>
                <strong>Delivery Address</strong>
                <p>
                  {order.fulfilment.address}, {order.fulfilment.city} -{" "}
                  {order.fulfilment.pincode}
                </p>
                <small>
                  10 km delivery eligibility is pending store verification.
                </small>
              </div>
            </div>
          )}

          {isPickup && (
            <div className="order-success-address">
              <Store size={19} />
              <div>
                <strong>Store Pickup</strong>
                <p>
                  Behind RPS Inter College, Itaunja, Lucknow,
                  Uttar Pradesh – 226203.
                </p>
                <small>Wait for store confirmation before visiting.</small>
              </div>
            </div>
          )}
        </div>

        <div className="order-success-details">
          <h2>Items Ordered</h2>

          {order.items.map((item, index) => (
            <div
              className="order-success-product"
              key={`${item.productId}-${item.size}-${item.color}-${index}`}
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

          <div className="order-success-total">
            <span>Product Subtotal</span>
            <strong>{money(order.subtotal)}</strong>
          </div>

          <p className="order-success-note">
            Final delivery charges, availability and payment status will be
            confirmed by the store.
          </p>
        </div>

        <div className="order-success-actions">
          <Link to="/category/men" className="order-success-primary">
            <ShoppingBag size={16} /> Continue Shopping
          </Link>

          <Link to="/" className="order-success-secondary">
            Back to Home
          </Link>
        </div>

        <div className="order-success-help">
          <Truck size={17} />
          <span>
            Need help? Contact the store at 8090365996.
          </span>
        </div>
      </section>
    </main>
  );
}

function MapPinFallback() {
  return <Truck size={19} />;
}
