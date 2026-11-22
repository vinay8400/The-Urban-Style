import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import {
  getPublishedAdminProducts,
  getVariantStock,
  usePublishedAdminProducts,
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

const CART_KEY = "urban-style-cart";
const CHECKOUT_INTENT_KEY = "urban-style-checkout-intent";

interface CheckoutIntent {
  mode: "cart";
  items: CartItem[];
  createdAt: number;
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function loadStoredCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(saved)) {
      throw new Error("Saved shopping bag data has an invalid format.");
    }
    return saved.map((item) => ({ ...item, selected: item.selected === true }));
  } catch (error) {
    console.error("Unable to load shopping bag.", error);
    return [];
  }
}

export default function Cart() {
  const navigate = useNavigate();
  const products = usePublishedAdminProducts();
  const [items, setItems] = useState<CartItem[]>(loadStoredCart);
  const [storageError, setStorageError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  function saveCart(updated: CartItem[]) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(updated));
      setItems(updated);
      setStorageError("");
    } catch (error) {
      setStorageError("Unable to save your shopping bag changes. Please try again.");
      console.error("Unable to save shopping bag changes.", error);
    }
  }

  function getItemId(item: CartItem) {
    return JSON.stringify([item.productId, item.size, item.color]);
  }

  function toggleItem(itemId: string) {
    saveCart(
      items.map((item) =>
        getItemId(item) === itemId ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function toggleAll(selected: boolean) {
    saveCart(items.map((item) => ({ ...item, selected })));
  }

  function proceedToCheckout(createdAt: number) {
    try {
      const intent: CheckoutIntent = {
        mode: "cart",
        items: selectedItems.map((item) => {
          const checkoutItem = { ...item };
          delete checkoutItem.selected;
          return checkoutItem;
        }),
        createdAt,
      };
      localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent));
      setCheckoutError("");
      navigate("/checkout");
    } catch (error) {
      setCheckoutError("Unable to start checkout. Please try again.");
      console.error("Unable to save cart checkout intent.", error);
    }
  }

  function updateQuantity(index: number, change: number) {
    const updated = [...items];
    const nextQuantity = updated[index].quantity + change;

    if (nextQuantity < 1) return;
    if (change > 0) {
      const currentItem = updated[index];
      const latestProduct = getPublishedAdminProducts().find(
        (product) => product.id === currentItem.productId,
      );
      const available = latestProduct
        ? getVariantStock(latestProduct, currentItem.size, currentItem.color)
        : 0;
      if (nextQuantity > available) {
        setCheckoutError(
          available < 1
            ? "This variant is no longer available."
            : `Only ${available} unit(s) are available for this variant.`,
        );
        return;
      }
    }

    updated[index] = {
      ...updated[index],
      quantity: nextQuantity,
    };

    saveCart(updated);
    setCheckoutError("");
  }

  function removeItem(index: number) {
    saveCart(items.filter((_, itemIndex) => itemIndex !== index));
  }

  const selectedItems = items.filter((item) => item.selected);
  const selectedCount = selectedItems.length;
  const subtotal = selectedItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedCount > 0 && selectedCount < items.length;
    }
  }, [selectedCount, items.length]);

  const totalQuantity = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  if (items.length === 0) {
    return (
      <main className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-icon">
            <ShoppingBag size={35} />
          </div>
          <span className="cart-eyebrow">THE URBAN STYLE</span>
          <h1>Your Bag Is Empty</h1>
          <p>
            Looks like you haven't added anything to your bag yet.
            Explore our collection and find your style.
          </p>
          <Link to="/category/men" className="cart-shop-button">
            Explore Collection <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-heading">
        <span className="cart-eyebrow">THE URBAN STYLE</span>
        <h1>Shopping Bag</h1>
        <p>{totalQuantity} item(s) in your bag</p>
      </div>

      <div className="cart-layout">
        <section className="cart-items-section">
          <div className="cart-section-heading">
            <h2>Your Items</h2>
            <span>{items.length} product(s)</span>
          </div>

          <label className="cart-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={isAllSelected}
              onChange={(event) => toggleAll(event.target.checked)}
            />
            <span>Select All</span>
          </label>

          <p className="cart-selection-count" aria-live="polite">
            {selectedCount} of {items.length} items selected
          </p>
          {storageError && (
            <p className="cart-storage-error" role="alert">{storageError}</p>
          )}
          {checkoutError && (
            <p className="cart-storage-error" role="alert">{checkoutError}</p>
          )}

          {items.map((item, index) => {
            const itemId = getItemId(item);
            const product = products.find((entry) => entry.id === item.productId);
            const available = product
              ? getVariantStock(product, item.size, item.color)
              : 0;
            return (
            <article
              className={`cart-item ${item.selected ? "is-selected" : "is-unselected"}`}
              key={itemId}
            >
              <label className="cart-item-select" aria-label={`Select ${item.name}`}>
                <input
                  type="checkbox"
                  checked={item.selected === true}
                  onChange={() => toggleItem(itemId)}
                  aria-label={`Select ${item.name}, ${item.color}, size ${item.size}`}
                />
              </label>

              <Link to={`/product/${item.productId}`} className="cart-item-image">
                <img src={item.image} alt={item.name} />
              </Link>

              <div className="cart-item-info">
                <Link to={`/product/${item.productId}`}>
                  <h3>{item.name}</h3>
                </Link>

                <p>Colour: {item.color}</p>
                <p>Size: {item.size}</p>
                <p className={available > 0 ? "cart-variant-stock" : "cart-variant-stock is-unavailable"}>
                  {available > 0
                    ? `${available} available`
                    : "Currently unavailable"}
                  {item.quantity > available && available > 0
                    ? ` · Reduce quantity to ${available} or less`
                    : ""}
                </p>

                <div className="cart-item-bottom">
                  <div className="cart-quantity">
                    <button
                      onClick={() => updateQuantity(index, -1)}
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={13} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, 1)}
                      disabled={item.quantity >= available}
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <button
                    className="cart-remove"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>

              <strong className="cart-item-price">
                {money(item.price * item.quantity)}
              </strong>
            </article>
            );
          })}

          <Link to="/category/men" className="cart-continue">
            ← Continue Shopping
          </Link>
        </section>

        <aside className="cart-summary">
          <h2>Order Summary</h2>

          <div className="cart-summary-line">
            <span>Subtotal ({selectedCount} selected)</span>
            <strong>{money(subtotal)}</strong>
          </div>

          <div className="cart-summary-line">
            <span>Delivery</span>
            <span>Calculated at checkout</span>
          </div>

          <div className="cart-summary-divider" />

          <div className="cart-summary-total">
            <strong>Estimated Total</strong>
            <strong>{money(subtotal)}</strong>
          </div>

          <p className="cart-summary-note">
            Final delivery charges and order details will be confirmed at checkout.
          </p>

          {selectedCount > 0 ? (
            <button
              type="button"
              className="cart-checkout-button"
              onClick={() => proceedToCheckout(Date.now())}
            >
              Proceed to Checkout <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" className="cart-checkout-button" disabled>
              Select an item to checkout
            </button>
          )}

          <div className="cart-payment-note">
            <ShoppingBag size={16} />
            <span>Secure order process</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
