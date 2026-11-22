import { Link } from "react-router-dom";
import { ArrowRight, Heart, Star, Truck, ShieldCheck, RefreshCw } from "lucide-react";
import { useSupabaseCatalogue } from "../data/supabaseCatalogue";
import type { Product } from "../data/products";

const categoryImages: Record<string, string> = {
  men: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85",
  women: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=85",
  kids: "https://images.unsplash.com/photo-1503919005314-30d93d07d823?auto=format&fit=crop&w=700&q=85",
  accessories: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85",
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function ProductCard({ product }: { product: Product }) {
  const image = product.images[0] || product.colors[0]?.image;

  return (
    <article className="product-card">
      <Link to={`/product/${product.id}`} className="product-image">
        {image && <img src={image} alt={product.name} loading="lazy" />}
        <span className="product-label">
          {product.featured ? "FEATURED" : "NEW ARRIVAL"}
        </span>
      </Link>
      <button className="product-wishlist" aria-label={`Add ${product.name} to wishlist`}>
        <Heart size={17} />
      </button>
      <div className="product-info">
        <Link to={`/product/${product.id}`} className="product-name">
          {product.name}
        </Link>
        <strong>{money(product.price)}</strong>
        <div className="product-rating">
          <Star size={13} fill="currentColor" />
          <Star size={13} fill="currentColor" />
          <Star size={13} fill="currentColor" />
          <Star size={13} fill="currentColor" />
          <Star size={13} />
          <span>Product preview</span>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { products, categories, loading, error, imageError } = useSupabaseCatalogue();

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="home-eyebrow">THE URBAN COLLECTION</span>
          <h1>New Season.<br /><span>New Style.</span></h1>
          <p>
            Discover fashion from local stores and explore styles
            that express your personality.
          </p>
          <div className="home-hero-actions">
            <Link to="/category/men" className="gold-button">
              Shop Men <ArrowRight size={16} />
            </Link>
            <Link to="/category/women" className="outline-button">
              Shop Women
            </Link>
          </div>
        </div>
        <div className="home-hero-image">
          <img
            src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=90"
            alt="New season fashion collection"
          />
        </div>
      </section>

      <section className="service-benefits">
        <div><Truck /><span><strong>Flexible Shopping</strong><small>Online or visit a store</small></span></div>
        <div><ShieldCheck /><span><strong>Registered Stores</strong><small>Discover local vendors</small></span></div>
        <div><RefreshCw /><span><strong>Easy Ordering</strong><small>Simple shopping journey</small></span></div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">EXPLORE YOUR STYLE</span>
            <h2>Shop by Category</h2>
          </div>
          <Link to="/collections">View all <ArrowRight size={16} /></Link>
        </div>

        <div className="home-category-grid">
          {categories.filter((category) => category.active && !category.parentId).map((category) => (
            <Link
              to={`/category/${category.name.toLowerCase()}`}
              className="home-category-card"
              key={category.id}
            >
              <img src={categoryImages[category.name.toLowerCase()] ?? categoryImages.men} alt={category.name} loading="lazy" />
              <span>{category.name}</span>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">JUST ARRIVED</span>
            <h2>New Arrivals</h2>
          </div>
          <Link to="/category/men">View all <ArrowRight size={16} /></Link>
        </div>
        {error && <p className="catalogue-error" role="alert">{error}</p>}
        {!error && imageError && <p className="catalogue-error" role="alert">{imageError}</p>}
        {loading && <p className="catalogue-status">Loading published products…</p>}
        <div className="home-product-grid">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
          {!loading && !error && products.length === 0 && (
            <p className="home-catalogue-empty">New products will appear here soon.</p>
          )}
        </div>
      </section>

      <section className="collection-banner">
        <div>
          <span className="home-eyebrow">THE SEASONAL EDIT</span>
          <h2>Make room for<br />something new.</h2>
          <p>Explore fresh fashion from local stores.</p>
          <Link to="/collections" className="gold-button">
            Explore Collection <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">CUSTOMER FAVOURITES</span>
            <h2>Best Sellers</h2>
          </div>
          <Link to="/category/men">View all <ArrowRight size={16} /></Link>
        </div>
        <div className="home-product-grid">
          {[...products].reverse().map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {products.length === 0 && (
            <p className="home-catalogue-empty">Customer favourites will appear here soon.</p>
          )}
        </div>
      </section>

      <section className="nearby-promo">
        <div>
          <span className="home-eyebrow">SHOP LOCAL</span>
          <h2>Find fashion closer to home.</h2>
          <p>Discover participating stores in Itaunja and nearby areas.</p>
          <Link to="/nearby-shops" className="gold-button">
            Discover Nearby Shops <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="review-section">
        <span className="home-eyebrow">THE URBAN COMMUNITY</span>
        <h2>Style is better when shared.</h2>
        <p>Customer reviews will appear here as verified purchases and reviews become available.</p>
      </section>
    </main>
  );
}
