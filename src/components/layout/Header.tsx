import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Search,
  ShoppingBag,
  UserRound,
  MapPin,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  categoryPathSegments,
  searchPublishedProducts,
  usePublishedAdminProducts,
} from "../../data/adminProductCatalog";

const RECENT_SEARCHES_KEY = "urban-style-recent-searches";

function readRecentSearches(): string[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(RECENT_SEARCHES_KEY) || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

const navigation = [
  { label: "Home", to: "/" },
  { label: "Men", to: "/category/men" },
  { label: "Women", to: "/category/women" },
  { label: "Kids", to: "/category/kids" },
  { label: "Collections", to: "/collections" },
  { label: "Nearby Shops", to: "/nearby-shops" },
];

export default function Header() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const products = usePublishedAdminProducts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    const error = await signOut();
    if (error) {
      setSignOutError(error);
    } else {
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 275);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const matchingProducts = useMemo(
    () => searchPublishedProducts(products, debouncedSearch).slice(0, 5),
    [products, debouncedSearch],
  );
  const usefulSuggestions = useMemo(
    () =>
      [...new Set(
        products.flatMap((product) => [
          categoryPathSegments(product.category).at(-1) ?? "",
          ...product.sizes.slice(0, 1),
          ...product.colors.slice(0, 1).map((color) => color.name),
        ]),
      )]
        .filter(Boolean)
        .slice(0, 5),
    [products],
  );

  function rememberSearch(query: string) {
    const updated = [query, ...recentSearches.filter((item) => item !== query)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Unable to save recent searches.", error);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      rememberSearch(query);
      setSearchOpen(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  function submitSuggestion(query: string) {
    setSearch(query);
    rememberSearch(query);
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <div className="announcement-bar">
        <span>FASHION · QUALITY · CONFIDENCE</span>
        <span>Discover fashion from local stores</span>
        <a href="https://wa.me/918090365996">Contact us</a>
      </div>

      <header className="site-header">
        <button
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <Link to="/" className="header-brand" onClick={closeMenu}>
          <img src="/assets/brand/logo-main.jpeg" alt="THE URBAN STYLE" />
        </Link>

        <nav className={`header-navigation ${menuOpen ? "open" : ""}`}>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={({ isActive }) => isActive ? "active" : ""}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-tools">
          <Link to="/search" aria-label="Search" title="Search">
            <Search />
          </Link>
          <Link
            to={user ? (isAdmin ? "/admin" : "/account") : "/login"}
            className="header-account-link"
            aria-label={user ? `${isAdmin ? "Admin dashboard" : "Account"}: ${user.email ?? "signed in"}` : "Sign in"}
            title={user ? (isAdmin ? "Admin dashboard" : user.email ?? "My account") : "Sign in"}
          >
            <UserRound />
            <span>{user ? (isAdmin ? "Admin" : "Account") : "Sign in"}</span>
          </Link>
          <Link to="/cart" className="header-cart" aria-label="Shopping cart">
            <ShoppingBag />
            <span>0</span>
          </Link>
          {user && (
            <button
              className="header-logout"
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </header>
      {signOutError && <p className="header-auth-error" role="alert">{signOutError}</p>}

      <div className="header-search-row">
        <form
          className="global-search-wrap"
          onSubmit={submitSearch}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setSearchOpen(false);
            }
          }}
        >
        <div className="global-search">
          <Search size={18} />
          <input
            value={search}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search products, fashion and stores..."
            aria-label="Search products"
            aria-expanded={searchOpen}
            aria-controls="global-search-suggestions"
            autoComplete="off"
          />
          <button type="submit">Search</button>
        </div>
        {searchOpen && (
          <div className="global-search-suggestions" id="global-search-suggestions">
            {debouncedSearch ? (
              matchingProducts.length > 0 ? (
                <>
                  <span className="search-suggestions-heading">Products</span>
                  {matchingProducts.map((product) => (
                    <button
                      type="button"
                      className="search-suggestion-product"
                      key={product.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        rememberSearch(search.trim());
                        setSearchOpen(false);
                        navigate(`/product/${product.id}`);
                      }}
                    >
                      <img
                        src={product.images[0] || product.colors[0]?.image || ""}
                        alt=""
                      />
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.category}</small>
                      </span>
                      <b>{new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(product.price)}</b>
                    </button>
                  ))}
                  <button className="search-see-all" type="submit">
                    See all results for “{search.trim()}”
                  </button>
                </>
              ) : (
                <p className="search-suggestions-empty">No matching published products.</p>
              )
            ) : (
              <>
                {recentSearches.length > 0 && (
                  <>
                    <span className="search-suggestions-heading">Recent searches</span>
                    {recentSearches.map((query) => (
                      <button
                        type="button"
                        className="search-suggestion-term"
                        key={query}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => submitSuggestion(query)}
                      >
                        <Search size={14} /> {query}
                      </button>
                    ))}
                  </>
                )}
                {usefulSuggestions.length > 0 && (
                  <>
                    <span className="search-suggestions-heading">Try searching</span>
                    <div className="search-suggestion-chips">
                      {usefulSuggestions.map((term) => (
                        <button
                          type="button"
                          key={term}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => submitSuggestion(term)}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
        </form>
        <Link to="/nearby-shops" className="location-shortcut">
          <MapPin size={15} />
          <span>Find local stores</span>
        </Link>
      </div>
    </>
  );
}
