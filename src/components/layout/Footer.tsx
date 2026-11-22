import { Link } from "react-router-dom";
import {
  MapPin,
  Phone,
  Camera,
  Globe,
  MessageCircle,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <img src="/assets/brand/logo-icon.jpeg" alt="THE URBAN STYLE" />
          <h3>THE URBAN STYLE</h3>
          <p>FASHION · QUALITY · CONFIDENCE</p>
          <span>Discover fashion. Support local businesses.</span>
        </div>

        <div className="footer-column">
          <h4>Shop</h4>
          <Link to="/category/men">Men</Link>
          <Link to="/category/women">Women</Link>
          <Link to="/category/kids">Kids</Link>
          <Link to="/collections">Collections</Link>
          <Link to="/nearby-shops">Nearby Shops</Link>
        </div>

        <div className="footer-column">
          <h4>Customer Service</h4>
          <Link to="/account">My Account</Link>
          <Link to="/account/orders">My Orders</Link>
          <Link to="/track-order">Track Order</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/contact">Contact Us</Link>
        </div>

        <div className="footer-column footer-contact">
          <h4>Visit Us</h4>
          <p>
            Behind RPS Inter College, Itaunja, Lucknow,
            Uttar Pradesh – 226203
          </p>
          <a href="https://share.google/ShFZrr0ezlU90nLbI" target="_blank" rel="noreferrer">
            <MapPin size={15} /> Open in Google Maps
          </a>
          <a href="tel:+918090365996">
            <Phone size={15} /> 8090365996
          </a>
          <a href="tel:+917388026659">
            <Phone size={15} /> 7388026659
          </a>
        </div>

        <div className="footer-column">
          <h4>Follow Us</h4>
          <a href="https://www.instagram.com/the_urbanstyle_/" target="_blank" rel="noreferrer">
            <Camera size={16} /> Instagram
          </a>
          <a href="https://www.facebook.com/share/1A1FiNVcKG/" target="_blank" rel="noreferrer">
            <Globe size={16} /> Facebook
          </a>
          <a href="https://wa.me/918090365996" target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} THE URBAN STYLE. All rights reserved.</span>
        <span>FASHION · QUALITY · CONFIDENCE</span>
      </div>
    </footer>
  );
}
