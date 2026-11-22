
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Truck,
  Store,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import {
  getPublishedAdminProducts,
  getVariantStock,
  normalizeVariantStock,
  notifyAdminProductsChanged,
} from "../data/adminProductCatalog";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  selected?: boolean;
}

type FulfilmentMethod = "delivery" | "pickup";
type PaymentMethod = "cod" | "upi" | "store";

const CART_KEY = "urban-style-cart";
const ORDERS_KEY = "urban-style-orders";
const CHECKOUT_INTENT_KEY = "urban-style-checkout-intent";
const PRODUCT_STORAGE_KEY = "urban-style-products";
const CHECKOUT_INTENT_MAX_AGE = 30 * 60 * 1000;

type CheckoutMode = "cart" | "buy-now";

interface CheckoutIntent {
  mode: CheckoutMode;
  items: CartItem[];
  createdAt: number;
}

interface CheckoutSnapshot {
  mode: CheckoutMode | null;
  items: CartItem[];
  valid: boolean;
}

function readCheckoutSnapshot(): CheckoutSnapshot {
  try {
    const saved = localStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!saved) return { mode: null, items: [], valid: false };

    const intent: CheckoutIntent = JSON.parse(saved);
    const valid =
      (intent.mode === "cart" || intent.mode === "buy-now") &&
      Array.isArray(intent.items) &&
      intent.items.length > 0 &&
      Number.isFinite(intent.createdAt) &&
      Date.now() >= intent.createdAt &&
      Date.now() - intent.createdAt <= CHECKOUT_INTENT_MAX_AGE;

    return valid
      ? { mode: intent.mode, items: intent.items, valid: true }
      : { mode: null, items: [], valid: false };
  } catch (loadError) {
    console.error("Unable to load checkout intent.", loadError);
    return { mode: null, items: [], valid: false };
  }
}

function getCartItemId(item: CartItem) {
  return JSON.stringify([item.productId, item.size, item.color]);
}

interface InventoryRecord extends Record<string, unknown> {
  id: string;
}

interface RequiredVariantStock {
  productId: string;
  size: string;
  color: string;
  quantity: number;
}

function isInventoryRecord(value: unknown): value is InventoryRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof value.id === "string"
  );
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function Checkout() {
  const navigate = useNavigate();

  const [checkoutSnapshot] = useState(readCheckoutSnapshot);
  const cart = checkoutSnapshot.items;
  const checkoutMode = checkoutSnapshot.mode;
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [fulfilment, setFulfilment] =
    useState<FulfilmentMethod>("delivery");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Itaunja, Lucknow");
  const [pincode, setPincode] = useState("");

  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [upiReference, setUpiReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    if (checkoutSnapshot.valid) return;
    try {
      localStorage.removeItem(CHECKOUT_INTENT_KEY);
    } catch (clearError) {
      console.error("Unable to clear invalid checkout intent.", clearError);
    }
  }, [checkoutSnapshot.valid]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    [cart],
  );

  const itemCount = cart.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError("");

    if (cart.length === 0 || !checkoutMode) {
      setError("Your checkout session is unavailable. Return to your bag and try again.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (fulfilment === "delivery") {
      if (!address.trim() || !city.trim() || !/^\d{6}$/.test(pincode.trim())) {
        setError("Enter your complete address and valid 6-digit PIN code.");
        return;
      }
    }

    if (payment === "upi" && !upiReference.trim()) {
      setError("Enter your UPI transaction reference.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const requiredStock = new Map<string, RequiredVariantStock>();
      for (const item of cart) {
        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          !item.productId ||
          !item.size ||
          !item.color
        ) {
          throw new Error("Checkout contains an invalid product variant or quantity.");
        }
        const key = getCartItemId(item);
        const current = requiredStock.get(key);
        requiredStock.set(key, {
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: (current?.quantity ?? 0) + item.quantity,
        });
      }

      const currentProducts = getPublishedAdminProducts();
      for (const required of requiredStock.values()) {
        const product = currentProducts.find(
          (item) => item.id === required.productId,
        );
        if (!product) {
          throw new Error("A product in your checkout is no longer available.");
        }
        if (
          getVariantStock(product, required.size, required.color) <
          required.quantity
        ) {
          throw new Error(
            `Insufficient stock for ${product.name} (${required.color}, ${required.size}). Please update your bag.`,
          );
        }
      }

      const orderId = `TUS${Date.now().toString().slice(-9)}`;

      const order = {
        orderId,
        createdAt: new Date().toISOString(),
        checkoutMode,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
        },
        fulfilment: {
          method: fulfilment,
          address: fulfilment === "delivery" ? address.trim() : "",
          city: fulfilment === "delivery" ? city.trim() : "",
          pincode: fulfilment === "delivery" ? pincode.trim() : "",
          deliveryRadiusStatus:
            fulfilment === "delivery" ? "pending_verification" : "not_applicable",
        },
        payment: {
          method: payment,
          upiReference: payment === "upi" ? upiReference.trim() : "",
          status: "pending_verification",
        },
        items: cart,
        subtotal,
        deliveryCharge: null,
        total: subtotal,
        customerNotes: notes.trim(),
        orderStatus: "pending_confirmation",
        storageMode: "local_demo",
      };

      const previousOrdersRaw = localStorage.getItem(ORDERS_KEY);
      const previousOrders: unknown = JSON.parse(previousOrdersRaw || "[]");
      if (!Array.isArray(previousOrders)) {
        throw new Error("Unable to read existing orders.");
      }
      const previousProductsRaw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      const previousProducts: unknown = JSON.parse(previousProductsRaw || "[]");
      if (
        !Array.isArray(previousProducts) ||
        !previousProducts.every(isInventoryRecord)
      ) {
        throw new Error("Unable to safely verify current product inventory.");
      }
      const previousCartRaw = localStorage.getItem(CART_KEY);
      localStorage.setItem(
        ORDERS_KEY,
        JSON.stringify([...previousOrders, order]),
      );

      try {
        const requiredByProduct = new Map<
          string,
          Map<string, RequiredVariantStock>
        >();
        for (const required of requiredStock.values()) {
          const variants =
            requiredByProduct.get(required.productId) ??
            new Map<string, RequiredVariantStock>();
          variants.set(JSON.stringify([required.size, required.color]), required);
          requiredByProduct.set(required.productId, variants);
        }

        const updatedProducts = previousProducts.map((record) => {
          const deductions = requiredByProduct.get(record.id);
          if (!deductions) return record;
          if (record.status !== "published") {
            throw new Error("A product in your checkout is no longer published.");
          }

          const colors = Array.isArray(record.colors)
            ? record.colors.filter(
                (color): color is { name: string } =>
                  typeof color === "object" &&
                  color !== null &&
                  "name" in color &&
                  typeof color.name === "string",
              )
            : [];
          const variants = normalizeVariantStock(record.sizes, colors);
          for (const required of deductions.values()) {
            const variant = variants.find(
              (item) =>
                item.size === required.size && item.color === required.color,
            );
            if (!variant || variant.stock < required.quantity) {
              throw new Error(
                `Insufficient stock for ${String(record.name)} (${required.color}, ${required.size}). Please update your bag.`,
              );
            }
            variant.stock -= required.quantity;
          }
          return { ...record, sizes: variants };
        });

        localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(updatedProducts));
        if (checkoutMode === "cart") {
          const currentCart = JSON.parse(previousCartRaw || "[]");
          if (!Array.isArray(currentCart)) {
            throw new Error("Unable to verify your shopping bag.");
          }
          const purchasedIds = new Set(cart.map(getCartItemId));
          const remainingCart = currentCart.filter(
            (item: CartItem) => !purchasedIds.has(getCartItemId(item)),
          );
          localStorage.setItem(CART_KEY, JSON.stringify(remainingCart));
        }
        localStorage.removeItem(CHECKOUT_INTENT_KEY);
      } catch (commitError) {
        if (previousOrdersRaw === null) {
          localStorage.removeItem(ORDERS_KEY);
        } else {
          localStorage.setItem(ORDERS_KEY, previousOrdersRaw);
        }
        if (previousProductsRaw === null) {
          localStorage.removeItem(PRODUCT_STORAGE_KEY);
        } else {
          localStorage.setItem(PRODUCT_STORAGE_KEY, previousProductsRaw);
        }
        if (previousCartRaw === null) {
          localStorage.removeItem(CART_KEY);
        } else {
          localStorage.setItem(CART_KEY, previousCartRaw);
        }
        throw commitError;
      }

      notifyAdminProductsChanged();
      navigate(`/order/success?orderId=${orderId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to place the demo order. Please try again.",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (cart.length === 0) {
    return (
      <main className="checkout-page checkout-empty">
        <ShoppingBag size={40} />
        <h1>{checkoutMode ? "No items selected" : "Checkout session unavailable"}</h1>
        <p>
          {checkoutMode
            ? "Select the products you want to purchase in your shopping bag."
            : "Return to your bag or product page to start checkout again."}
        </p>
        <Link to="/cart" className="checkout-submit-button">
          Return to Shopping Bag
        </Link>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-heading">
        <span>THE URBAN STYLE</span>
        <h1>Checkout</h1>
        <p>
          {checkoutMode === "buy-now" ? "Buy Now checkout · " : "Shopping bag checkout · "}
          Complete your details to place your order.
        </p>
      </div>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="checkout-main">
          <section className="checkout-card">
            <div className="checkout-section-title">
              <span>01</span>
              <div>
                <h2>Contact Information</h2>
                <p>Where can we reach you about your order?</p>
              </div>
            </div>

            <div className="checkout-fields">
              <label>
                Full Name *
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                />
              </label>

              <label>
                Mobile Number *
                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  required
                  autoComplete="tel"
                />
              </label>

            </div>
          </section>

          <section className="checkout-card">
            <div className="checkout-section-title">
              <span>02</span>
              <div>
                <h2>How would you like to receive your order?</h2>
                <p>Choose local delivery or collect from our store.</p>
              </div>
            </div>

            <div className="checkout-choice-grid">
              <button
                type="button"
                className={`checkout-choice ${fulfilment === "delivery" ? "active" : ""}`}
                onClick={() => setFulfilment("delivery")}
              >
                <Truck size={21} />
                <strong>Local Delivery</strong>
                <small>Within 10 km of our store</small>
              </button>

              <button
                type="button"
                className={`checkout-choice ${fulfilment === "pickup" ? "active" : ""}`}
                onClick={() => setFulfilment("pickup")}
              >
                <Store size={21} />
                <strong>Store Pickup</strong>
                <small>Collect from our store</small>
              </button>
            </div>

            {fulfilment === "delivery" ? (
              <>
                <div className="checkout-delivery-notice">
                  <MapPin size={18} />
                  <p>
                    Delivery is available only within a maximum 10 km radius.
                    Your address and delivery eligibility will be verified by
                    the store before confirmation.
                  </p>
                </div>

                <div className="checkout-fields">
                  <label className="checkout-full-width">
                    House / Street / Area *
                    <textarea
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="House number, street, locality..."
                      required
                      rows={3}
                    />
                  </label>

                  <label>
                    City / Town *
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    PIN Code *
                    <input
                      value={pincode}
                      onChange={(event) =>
                        setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="6-digit PIN code"
                      inputMode="numeric"
                      required
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="checkout-store-address">
                <Store size={20} />
                <div>
                  <strong>THE URBAN STYLE — Store Pickup</strong>
                  <p>
                    Behind RPS Inter College, Itaunja, Lucknow,
                    Uttar Pradesh – 226203.
                  </p>
                  <small>Pickup timing will be confirmed by the store.</small>
                </div>
              </div>
            )}
          </section>

          <section className="checkout-card">
            <div className="checkout-section-title">
              <span>03</span>
              <div>
                <h2>Payment Method</h2>
                <p>Choose how you want to pay.</p>
              </div>
            </div>

            <div className="checkout-payment-options">
              <label className={`checkout-payment-option ${payment === "cod" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "cod"}
                  onChange={() => setPayment("cod")}
                />
                <Truck size={19} />
                <span>
                  <strong>Cash on Delivery</strong>
                  <small>Pay when your order is delivered</small>
                </span>
              </label>

              <label className={`checkout-payment-option ${payment === "upi" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "upi"}
                  onChange={() => setPayment("upi")}
                />
                <CreditCard size={19} />
                <span>
                  <strong>UPI Payment</strong>
                  <small>Manual payment verification by store</small>
                </span>
              </label>

              <label className={`checkout-payment-option ${payment === "store" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "store"}
                  onChange={() => setPayment("store")}
                />
                <Store size={19} />
                <span>
                  <strong>Pay at Physical Store</strong>
                  <small>Pay when you collect your order</small>
                </span>
              </label>
            </div>

            {payment === "upi" && (
              <div className="checkout-upi-box">
                <strong>UPI Transaction Reference</strong>
                <p>
                  Complete your UPI payment using the store's official payment
                  details. Enter the transaction reference below.
                </p>
                <label>
                  UPI Transaction ID / UTR *
                  <input
                    value={upiReference}
                    onChange={(event) => setUpiReference(event.target.value)}
                    placeholder="Enter UPI reference number"
                    required
                  />
                </label>
                <small>
                  Payment will remain pending until the store verifies it.
                  Do not enter your UPI PIN here.
                </small>
              </div>
            )}
          </section>

          <section className="checkout-card">
            <div className="checkout-section-title">
              <span>04</span>
              <div>
                <h2>Additional Notes</h2>
                <p>Optional instructions for the store.</p>
              </div>
            </div>

            <label className="checkout-notes-label">
              Order notes
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Any special instructions..."
              />
            </label>
          </section>

          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <aside className="checkout-summary">
          <h2>Order Summary</h2>

          {cart.map((item) => (
            <div
              className="checkout-product"
              key={`${item.productId}-${item.size}-${item.color}`}
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

          <div className="checkout-total-line">
            <span>Subtotal ({itemCount} items)</span>
            <strong>{money(subtotal)}</strong>
          </div>

          <div className="checkout-total-line">
            <span>Delivery charges</span>
            <span>To be confirmed</span>
          </div>

          <div className="checkout-total-final">
            <span>Estimated total</span>
            <strong>{money(subtotal)}</strong>
          </div>

          <p className="checkout-charge-note">
            Final delivery charges, delivery eligibility and order confirmation
            will be communicated by the store.
          </p>

          <button
            type="submit"
            className="checkout-submit-button"
            disabled={submitting}
          >
            {submitting ? "Placing Demo Order..." : "Place Order"}
          </button>

          <div className="checkout-security-note">
            <ShieldCheck size={17} />
            <span>Payment verification is handled by the store.</span>
          </div>

          <Link to="/cart" className="checkout-back-link">
            ← Back to Shopping Bag
          </Link>
        </aside>
      </form>
    </main>
  );
}
