import { Link, Route, Routes } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import TrackOrder from "./pages/TrackOrder";
import AdminDashboard from "./admin/pages/AdminDashboard";
import CategoryManagement from "./admin/pages/CategoryManagement";
import AdminProducts from "./admin/pages/AdminProducts";
import AddProduct from "./admin/pages/AddProduct";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="placeholder-page">
      <span className="home-eyebrow">THE URBAN STYLE</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/" className="gold-button">Back to Homepage</Link>
    </main>
  );
}

function NotFound() {
  return (
    <PlaceholderPage
      title="404 — Page Not Found"
      description="The page you are looking for does not exist."
    />
  );
}

export default function App() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/category/*" element={<Products />} />
        <Route path="/collections" element={<PlaceholderPage title="Collections" description="Explore curated fashion collections." />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/search" element={<Products />} />

        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/payment" element={<PlaceholderPage title="Payment" description="Choose UPI QR, Cash on Delivery or store payment." />} />
        <Route path="/order/success" element={<OrderSuccess />} />
        <Route path="/track-order" element={<TrackOrder />} />

        <Route path="/account" element={<PlaceholderPage title="My Account" description="Manage your profile, addresses and account settings." />} />
        <Route path="/account/orders" element={<PlaceholderPage title="My Orders" description="View your order history and order details." />} />
        <Route path="/wishlist" element={<PlaceholderPage title="My Wishlist" description="Your saved fashion products will appear here." />} />
        <Route path="/size-guide" element={<PlaceholderPage title="Size Guide" description="Find the right size with our measurement guide." />} />

        <Route path="/nearby-shops" element={<PlaceholderPage title="Nearby Shops" description="Discover local fashion stores using Google Maps." />} />
        <Route path="/store/:storeId" element={<PlaceholderPage title="Store Profile" description="Explore a vendor's store, location and products." />} />
        <Route path="/contact" element={<PlaceholderPage title="Contact Us" description="Connect with THE URBAN STYLE." />} />

        <Route path="/admin/categories" element={<CategoryManagement />} />
        <Route path="/admin/products/new" element={<AddProduct />} />
        <Route path="/admin/products/edit/:productId" element={<AddProduct />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/vendor/*" element={<PlaceholderPage title="Vendor Dashboard" description="Vendor store management portal." />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </>
  );
}
