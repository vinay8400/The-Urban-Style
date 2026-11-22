
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RefreshCw,
  Star,
  ChevronRight,
  Plus,
  Minus,
  Ruler,
  Check,
} from "lucide-react";
import {
  getVariantStock,
} from "../data/adminProductCatalog";
import { useSupabaseCatalogue } from "../data/supabaseCatalogue";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
}

interface CheckoutIntent {
  mode: "buy-now";
  items: CartItem[];
  createdAt: number;
}

const CART_KEY = "urban-style-cart";
const CHECKOUT_INTENT_KEY = "urban-style-checkout-intent";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, loading: catalogueLoading, error: catalogueError, imageError } = useSupabaseCatalogue();
  const product = products.find((item) => item.id === id);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectionProductId, setSelectionProductId] = useState(product?.id ?? "");
  const [selectedSizeState, setSelectedSizeState] = useState("");
  const [selectedColorState, setSelectedColorState] = useState(
    product?.colors[0]?.name ?? "",
  );
  const [quantityState, setQuantityState] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [message, setMessage] = useState("");

  if (catalogueLoading) {
    return <main className="product-not-found"><p>Loading product…</p></main>;
  }
  if (!product) {
    return (
      <main className="product-not-found">
        <h1>Product not found</h1>
        <p>{catalogueError || "This product may have been removed or is unavailable."}</p>
        <Link to="/category/men" className="detail-primary-button">
          Browse Products
        </Link>
      </main>
    );
  }

  const productRecord = product;
  const hasCurrentSelection = selectionProductId === product.id;
  const selectedSize = hasCurrentSelection ? selectedSizeState : "";
  const selectedColor = hasCurrentSelection
    ? selectedColorState
    : product.colors[0]?.name ?? "";
  const quantity = hasCurrentSelection ? quantityState : 1;
  const activeColor =
    productRecord.colors.find((color) => color.name === selectedColor) ??
    productRecord.colors[0];
  const activeColorName = activeColor?.name ?? "";
  const availableQuantity =
    selectedSize && activeColorName
      ? getVariantStock(productRecord, selectedSize, activeColorName)
      : 0;

  const activeImage =
    selectedImage === 0 && activeColor
      ? activeColor.image
      : productRecord.images[selectedImage] ??
        productRecord.images[0] ??
        activeColor?.image ??
        "";

  const discount = productRecord.discountPercent;

  function addToCart(buyNow = false, intentCreatedAt?: number) {
    if (!selectedSize) {
      setMessage("Please select a size before continuing.");
      return;
    }

    if (!activeColor) {
      setMessage("Please select a colour.");
      return;
    }
    if (availableQuantity < 1) {
      setMessage("This size and colour combination is out of stock.");
      return;
    }
    if (quantity > availableQuantity) {
      setMessage(`Only ${availableQuantity} unit(s) are available for this variant.`);
      return;
    }

    const newItem: CartItem = {
      productId: productRecord.id,
      name: productRecord.name,
      price: productRecord.price,
      image: activeImage,
      size: selectedSize,
      color: activeColor.name,
      quantity,
    };

    try {
      if (buyNow) {
        const intent: CheckoutIntent = {
          mode: "buy-now",
          items: [newItem],
          createdAt: intentCreatedAt ?? 0,
        };
        localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(intent));
      } else {
        const latestProduct = products.find(
          (item) => item.id === productRecord.id,
        );
        if (!latestProduct) {
          setMessage("This product is no longer available.");
          return;
        }
        const existing: CartItem[] = JSON.parse(
          localStorage.getItem(CART_KEY) || "[]",
        );
        if (!Array.isArray(existing)) {
          throw new Error("Shopping bag data is invalid.");
        }
        const existingIndex = existing.findIndex(
          (item) =>
            item.productId === newItem.productId &&
            item.size === newItem.size &&
            item.color === newItem.color,
        );
        const inBagQuantity =
          existingIndex >= 0 ? Number(existing[existingIndex].quantity) || 0 : 0;
        const latestAvailable = getVariantStock(
          latestProduct,
          selectedSize,
          activeColor.name,
        );
        if (inBagQuantity + quantity > latestAvailable) {
          setMessage(
            latestAvailable < 1
              ? "This size and colour combination is out of stock."
              : `Only ${latestAvailable - inBagQuantity} more unit(s) can be added.`,
          );
          return;
        }

        if (existingIndex >= 0) {
          existing[existingIndex].quantity += quantity;
        } else {
          existing.push(newItem);
        }

        localStorage.setItem(CART_KEY, JSON.stringify(existing));
        localStorage.removeItem(CHECKOUT_INTENT_KEY);
        setMessage("Product added to your shopping bag.");
      }

      if (buyNow) {
        navigate("/checkout");
      }
    } catch {
      setMessage("Unable to update your cart. Please try again.");
    }
  }

  function toggleWishlist() {
    const key = "urban-style-wishlist";

    try {
      const current: string[] = JSON.parse(
        localStorage.getItem(key) || "[]",
      );

      const updated = current.includes(productRecord.id)
        ? current.filter((item) => item !== productRecord.id)
        : [...current, productRecord.id];

      localStorage.setItem(key, JSON.stringify(updated));
      setWishlisted(updated.includes(productRecord.id));
    } catch {
      setMessage("Unable to update wishlist.");
    }
  }

  return (
    <main className="product-detail-page">
      {catalogueError && <p className="catalogue-error" role="alert">{catalogueError}</p>}
      {!catalogueError && imageError && <p className="catalogue-error" role="alert">{imageError}</p>}
      <div className="detail-breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to="/category/men">Shop</Link>
        <ChevronRight size={13} />
        <span>{product.name}</span>
      </div>

      <div className="product-detail-layout">
        <section className="detail-gallery">
          <div className="detail-thumbnails">
            {product.images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                className={selectedImage === index ? "active" : ""}
                onClick={() => setSelectedImage(index)}
                aria-label={`View product image ${index + 1}`}
              >
                <img src={image} alt={`${product.name} view ${index + 1}`} />
              </button>
            ))}
          </div>

          <div className="detail-main-image">
            {activeImage && <img src={activeImage} alt={product.name} />}
            <span className="detail-image-label">THE URBAN EDIT</span>
          </div>
        </section>

        <section className="detail-information">
          <span className="detail-category">{product.category}</span>

          <h1>{product.name}</h1>

          {product.reviews > 0 && (
            <div className="detail-rating">
              <span>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    size={15}
                    fill={index < Math.round(product.rating) ? "currentColor" : "none"}
                  />
                ))}
              </span>
              <strong>{product.rating}</strong>
              <small>{product.reviews} reviews</small>
            </div>
          )}

          <div className="detail-price-row">
            <strong>{money(product.price)}</strong>
            {discount > 0 && (
              <>
                <del>{money(product.oldPrice)}</del>
                <span>{discount}% OFF</span>
              </>
            )}
          </div>

          <p className="detail-tax-note">Inclusive of applicable taxes</p>

          <div className="detail-divider" />

          <div className="detail-choice-block">
            <div className="detail-choice-heading">
              <strong>Colour:</strong>
              <span>{activeColorName}</span>
            </div>

            <div className="detail-colour-options">
              {product.colors.map((color) => {
                const isAvailable =
                  selectedSize.length === 0
                    ? product.sizes.some(
                        (size) => getVariantStock(product, size, color.name) > 0,
                      )
                    : getVariantStock(product, selectedSize, color.name) > 0;
                return (
                <button
                  key={color.name}
                  className={`${activeColorName === color.name ? "active" : ""} ${!isAvailable ? "is-unavailable" : ""}`}
                  disabled={!isAvailable}
                  onClick={() => {
                    setSelectionProductId(product.id);
                    setSelectedColorState(color.name);
                    setSelectedImage(0);
                    setMessage("");
                  }}
                  title={color.name}
                  aria-label={`Select ${color.name}`}
                >
                  <span style={{ backgroundColor: color.hex }} />
                </button>
                );
              })}
            </div>
          </div>

          <div className="detail-choice-block">
            <div className="detail-choice-heading">
              <strong>Select Size</strong>
              <button
                className="size-guide-trigger"
                onClick={() => setSizeGuideOpen(true)}
              >
                <Ruler size={14} /> Size Guide
              </button>
            </div>

            <div className="detail-size-options">
              {product.sizes.map((size) => {
                const isAvailable =
                  getVariantStock(product, size, activeColorName) > 0;
                return (
                <button
                  key={size}
                  className={`${selectedSize === size ? "active" : ""} ${!isAvailable ? "is-unavailable" : ""}`}
                  disabled={!isAvailable}
                  onClick={() => {
                    setSelectionProductId(product.id);
                    setSelectedColorState(activeColorName);
                    setSelectedSizeState(size);
                    setMessage("");
                  }}
                >
                  {size}
                </button>
                );
              })}
            </div>
          </div>

          <div className="detail-choice-block">
            <div className="detail-choice-heading">
              <strong>Quantity</strong>
              <span>
                {selectedSize
                  ? `${availableQuantity} available for ${activeColorName} / ${selectedSize}`
                  : `${product.stock} total units · Select a size`}
              </span>
            </div>

            <div className="detail-quantity-control">
              <button
                onClick={() => {
                  setSelectionProductId(product.id);
                  setQuantityState(Math.max(1, quantity - 1));
                }}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => {
                  setSelectionProductId(product.id);
                  setQuantityState(Math.min(availableQuantity, quantity + 1));
                }}
                disabled={!selectedSize || quantity >= availableQuantity}
                aria-label="Increase quantity"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {message && (
            <p className="detail-message" role="status">
              {message}
            </p>
          )}

          <div className="detail-action-buttons">
            <button
              className="detail-primary-button"
              onClick={() => addToCart(false)}
            >
              <ShoppingBag size={17} /> Add to Bag
            </button>

            <button
              className="detail-buy-button"
              onClick={() => addToCart(true, Date.now())}
            >
              Buy Now
            </button>

            <button
              className={`detail-wishlist-button ${wishlisted ? "active" : ""}`}
              onClick={toggleWishlist}
              aria-label="Add to wishlist"
              title="Add to wishlist"
            >
              <Heart fill={wishlisted ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="detail-service-list">
            <div><Truck /><span><strong>Delivery information</strong><small>Delivery options shown during checkout</small></span></div>
            <div><ShieldCheck /><span><strong>Quality commitment</strong><small>Product details provided by the store</small></span></div>
            <div><RefreshCw /><span><strong>Returns and exchanges</strong><small>Subject to the store's return policy</small></span></div>
          </div>

          <div className="detail-description">
            <h3>Product Description</h3>
            <p>{product.description}</p>

            <h3>Product Details</h3>
            <div className="detail-specification">
              <span>Fabric</span><strong>{product.fabric || "Not specified"}</strong>
              <span>Fit</span><strong>{product.fit || "Not specified"}</strong>
              <span>Care</span><strong>{product.care || "Not specified"}</strong>
              <span>Category</span><strong>{product.category}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="detail-related">
        <div>
          <span className="detail-category">COMPLETE YOUR LOOK</span>
          <h2>You May Also Like</h2>
        </div>

        <div className="detail-related-grid">
          {products
            .filter((item) => item.id !== product.id)
            .slice(0, 4)
            .map((item) => (
              <Link
                to={`/product/${item.id}`}
                className="detail-related-card"
                key={item.id}
              >
                {item.images[0] && (
                  <img src={item.images[0]} alt={item.name} loading="lazy" />
                )}
                <strong>{item.name}</strong>
                <span>{money(item.price)}</span>
              </Link>
            ))}
        </div>
      </section>

      {sizeGuideOpen && (
        <div
          className="size-guide-overlay"
          onClick={() => setSizeGuideOpen(false)}
        >
          <section
            className="size-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="size-guide-close"
              onClick={() => setSizeGuideOpen(false)}
              aria-label="Close size guide"
            >
              ×
            </button>

            <span className="detail-category">THE URBAN STYLE</span>
            <h2 id="size-guide-title">Size Guide</h2>
            <p>Approximate body measurements in inches. Check the product fit before ordering.</p>

            <div className="size-guide-table-wrap">
              <table className="size-guide-table">
                <thead>
                  <tr><th>Size</th><th>Chest</th><th>Shoulder</th><th>Length</th></tr>
                </thead>
                <tbody>
                  <tr><td>S</td><td>36</td><td>16</td><td>27</td></tr>
                  <tr><td>M</td><td>38</td><td>17</td><td>28</td></tr>
                  <tr><td>L</td><td>40</td><td>18</td><td>29</td></tr>
                  <tr><td>XL</td><td>42</td><td>19</td><td>30</td></tr>
                  <tr><td>XXL</td><td>44</td><td>20</td><td>31</td></tr>
                </tbody>
              </table>
            </div>

            <p className="size-guide-note">
              Measurements are illustrative demo values. The Admin should enter
              the actual measurements for each product before launch.
            </p>

            <button
              className="detail-primary-button"
              onClick={() => setSizeGuideOpen(false)}
            >
              <Check size={16} /> Done
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
