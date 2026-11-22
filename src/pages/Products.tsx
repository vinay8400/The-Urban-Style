import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Heart,
  SlidersHorizontal,
  X,
  ChevronDown,
  Star,
  ArrowUpDown,
  Search,
} from "lucide-react";
import {
  categorySlug,
  productSearchScore,
} from "../data/adminProductCatalog";
import { useSupabaseCatalogue, type CatalogueCategory } from "../data/supabaseCatalogue";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function categoryFilterOptions(categories: CatalogueCategory[]) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return categories.map((category) => {
    const path: string[] = [];
    let current: CatalogueCategory | undefined = category;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current.name);
      current = current.parentId ? categoryMap.get(current.parentId) : undefined;
    }
    return { value: category.id, label: path.join(" / ") };
  });
}

function resolveCategoryPath(
  categories: CatalogueCategory[],
  segments: string[],
): CatalogueCategory[] {
  const path: CatalogueCategory[] = [];
  let parentId: string | null = null;
  for (const [index, segment] of segments.entries()) {
    const siblings = categories.filter((category) => category.parentId === parentId);
    const category = siblings.find((item) => categorySlug(item.name) === segment)
      ?? (index === 0 && segment === "children"
        ? siblings.find((item) => ["child", "children", "kids"].includes(categorySlug(item.name)))
        : undefined);
    if (!category) return [];
    path.push(category);
    parentId = category.id;
  }
  return path;
}

function titleCaseSlug(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function collectionCategorySlugs(slug: string | undefined) {
  if (slug === "t-shirts") return ["t-shirt", "t-shirts", "tee", "tees"];
  return slug ? [slug] : [];
}

function belongsToPrimaryCategory(
  category: CatalogueCategory,
  categories: CatalogueCategory[],
) {
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let current: CatalogueCategory | undefined = category;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (!current.parentId) {
      const rootName = categorySlug(current.name);
      return ["men", "women", "accessories", "child", "children", "kids"].includes(rootName);
    }
    current = categoryMap.get(current.parentId);
  }
  return false;
}

export default function Products() {
  const { products, categories, loading, error, imageError } = useSupabaseCatalogue();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minimumDiscount, setMinimumDiscount] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = searchParams.get("q") ?? "";
  const onSearchPage = location.pathname === "/search";
  const routeCategory = useMemo(
    () =>
      location.pathname.startsWith("/category/")
        ? location.pathname
            .slice("/category/".length)
            .split("/")
            .map(decodeSegment)
            .map(categorySlug)
            .filter(Boolean)
        : [],
    [location.pathname],
  );
  const isCollectionRoute = routeCategory[0] === "collection";
  const collectionCategoryIds = useMemo(
    () => isCollectionRoute
      ? categories
          .filter((category) =>
            category.parentId !== null &&
            collectionCategorySlugs(routeCategory[1]).includes(categorySlug(category.name)) &&
            belongsToPrimaryCategory(category, categories),
          )
          .map((category) => category.id)
      : [],
    [categories, isCollectionRoute, routeCategory],
  );
  const resolvedCategoryPath = useMemo(
    () => isCollectionRoute ? [] : resolveCategoryPath(categories, routeCategory),
    [categories, isCollectionRoute, routeCategory],
  );
  const activeCategory = resolvedCategoryPath.at(-1);
  const childCategories = categories.filter((category) =>
    category.parentId === activeCategory?.id && category.active,
  );
  const categoryRoutePath = resolvedCategoryPath
    .map((category) => categorySlug(category.name))
    .join("/");
  const maxCataloguePrice = useMemo(
    () => Math.max(3000, ...products.map((product) => product.price)),
    [products],
  );
  const title = onSearchPage
    ? "Search Results"
    : isCollectionRoute
      ? titleCaseSlug(routeCategory[1] ?? "collection")
      : resolvedCategoryPath.map((category) => category.name).join(" / ") ||
        (routeCategory.length ? "Category not found" : "All Products");

  const categoryOptions = useMemo(
    () => categoryFilterOptions(categories),
    [categories],
  );
  const sizes = useMemo(
    () => [...new Set(products.flatMap((product) => product.sizes))].sort(),
    [products],
  );
  const colors = useMemo(() => {
    const colorMap = new Map<string, string>();
    products.forEach((product) =>
      product.colors.forEach((color) => colorMap.set(color.name, color.hex)),
    );
    return [...colorMap];
  }, [products]);

  function toggleValue(
    value: string,
    selected: string[],
    setter: (value: string[]) => void,
  ) {
    setter(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  }

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesRouteCategory =
        routeCategory.length === 0 ||
        (isCollectionRoute
          ? collectionCategoryIds.some((id) => product.categoryIdPath.includes(id))
          : Boolean(activeCategory && product.categoryIdPath.includes(activeCategory.id)));
      const matchesSelectedCategory =
        selectedCategories.length === 0 ||
        selectedCategories.some((categoryId) => product.categoryIdPath.includes(categoryId));
      const matchesSize =
        selectedSizes.length === 0 ||
        selectedSizes.some((size) => product.sizes.includes(size));
      const matchesColor =
        selectedColors.length === 0 ||
        selectedColors.some((color) =>
          product.colors.some((productColor) => productColor.name === color),
        );
      const matchesSearch = productSearchScore(product, search) > 0;

      return (
        matchesRouteCategory &&
        matchesSelectedCategory &&
        matchesSize &&
        matchesColor &&
        (minPrice === null || product.price >= minPrice) &&
        (maxPrice === null || product.price <= maxPrice) &&
        (minimumDiscount === null || product.discountPercent >= minimumDiscount) &&
        (!inStockOnly || product.stock > 0) &&
        matchesSearch
      );
    });

    if (sort === "low") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "high") result = [...result].sort((a, b) => b.price - a.price);
    if (sort === "relevance" && search.trim()) {
      result = [...result].sort(
        (a, b) =>
          productSearchScore(b, search) - productSearchScore(a, search),
      );
    }
    if (sort === "newest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    if (sort === "featured") {
      result = [...result].sort(
        (a, b) => Number(b.featured) - Number(a.featured),
      );
    }

    return result;
  }, [
    products,
    routeCategory,
    isCollectionRoute,
    collectionCategoryIds,
    activeCategory,
    selectedCategories,
    selectedSizes,
    selectedColors,
    minPrice,
    maxPrice,
    minimumDiscount,
    inStockOnly,
    search,
    sort,
  ]);

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setMinPrice(null);
    setMaxPrice(null);
    setMinimumDiscount(null);
    setInStockOnly(false);
  }

  const activeFilters = [
    ...selectedCategories.map((value) => ({
      id: `category:${value}`,
      label: categoryOptions.find((item) => item.value === value)?.label ?? value,
      remove: () => setSelectedCategories((current) => current.filter((item) => item !== value)),
    })),
    ...selectedSizes.map((value) => ({
      id: `size:${value}`,
      label: `Size: ${value}`,
      remove: () => setSelectedSizes((current) => current.filter((item) => item !== value)),
    })),
    ...selectedColors.map((value) => ({
      id: `color:${value}`,
      label: `Colour: ${value}`,
      remove: () => setSelectedColors((current) => current.filter((item) => item !== value)),
    })),
    ...(minPrice !== null ? [{
      id: "min-price",
      label: `Min: ${money(minPrice)}`,
      remove: () => setMinPrice(null),
    }] : []),
    ...(maxPrice !== null ? [{
      id: "max-price",
      label: `Max: ${money(maxPrice)}`,
      remove: () => setMaxPrice(null),
    }] : []),
    ...(minimumDiscount !== null ? [{
      id: "discount",
      label: `${minimumDiscount}%+ off`,
      remove: () => setMinimumDiscount(null),
    }] : []),
    ...(inStockOnly ? [{
      id: "stock",
      label: "In stock",
      remove: () => setInStockOnly(false),
    }] : []),
  ];

  function toggleWishlist(id: string) {
    setWishlist((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <main className="listing-page">
      <div className="listing-breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>{title}</span>
      </div>

      <section className="listing-heading">
        <div>
          <span className="listing-kicker">THE URBAN COLLECTION</span>
          <h1>{title}{onSearchPage ? "" : " Collection"}</h1>
          <p>Explore our selection of fashion and everyday essentials.</p>
        </div>

        <button
          className="mobile-filter-button"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={17} /> Filters
        </button>
      </section>

      {childCategories.length > 0 && (
        <nav className="listing-subcategory-nav" aria-label={`${activeCategory?.name ?? "Category"} subcategories`}>
          {childCategories.map((category) => (
            <Link
              to={`/category/${categoryRoutePath}/${categorySlug(category.name)}`}
              key={category.id}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}

      {routeCategory.length > 0 && !isCollectionRoute && !activeCategory && (
        <p className="catalogue-error" role="status">
          This category is unavailable or inactive.
        </p>
      )}

      <div className="listing-toolbar">
        <span>{filteredProducts.length} Products</span>
        <label className="listing-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set("q", event.target.value);
              else next.delete("q");
              setSearchParams(next, { replace: true });
            }}
            placeholder="Search catalogue..."
            aria-label="Search products"
          />
        </label>
        <label>
          <ArrowUpDown size={15} />
          Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
          </select>
        </label>
      </div>
      {error && <p className="catalogue-error" role="alert">{error}</p>}
      {!error && imageError && <p className="catalogue-error" role="alert">{imageError}</p>}
      {loading && <p className="catalogue-status">Loading published products…</p>}

      {activeFilters.length > 0 && (
        <div className="listing-active-filters" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button type="button" key={filter.id} onClick={filter.remove}>
              {filter.label} <X size={12} />
            </button>
          ))}
          <button type="button" className="listing-clear-filters" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="listing-layout">
        <aside className={`listing-sidebar ${filtersOpen ? "show" : ""}`}>
          <div className="filter-header">
            <h2>Filters</h2>
            <button onClick={clearFilters}>Clear All</button>
            <button
              className="filter-close"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <X />
            </button>
          </div>

          <div className="filter-group">
            <h3>Categories <ChevronDown size={15} /></h3>
            {categoryOptions.map(({ value, label }) => (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(value)}
                  onChange={() =>
                    toggleValue(value, selectedCategories, setSelectedCategories)
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Size <ChevronDown size={15} /></h3>
            <div className="filter-size-list">
              {sizes.map((size) => (
                <button
                  key={size}
                  className={selectedSizes.includes(size) ? "selected" : ""}
                  onClick={() => toggleValue(size, selectedSizes, setSelectedSizes)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h3>Colour <ChevronDown size={15} /></h3>
            <div className="filter-color-list">
              {colors.map(([color, hex]) => (
                <button
                  key={color}
                  className={selectedColors.includes(color) ? "selected" : ""}
                  onClick={() => toggleValue(color, selectedColors, setSelectedColors)}
                  title={color}
                  aria-label={color}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <div className="selected-color-names">
              {selectedColors.join(", ") || "All colours"}
            </div>
          </div>

          <div className="filter-group">
            <h3>Price Range <ChevronDown size={15} /></h3>
            <div className="filter-price-inputs">
              <label>
                Min
                <input
                  type="number"
                  min="0"
                  placeholder="₹0"
                  value={minPrice ?? ""}
                  onChange={(event) =>
                    setMinPrice(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))
                  }
                />
              </label>
              <label>
                Max
                <input
                  type="number"
                  min="0"
                  placeholder={money(maxCataloguePrice)}
                  value={maxPrice ?? ""}
                  onChange={(event) =>
                    setMaxPrice(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))
                  }
                />
              </label>
            </div>
          </div>

          <div className="filter-group">
            <h3>Minimum Discount <ChevronDown size={15} /></h3>
            <select
              className="filter-select"
              value={minimumDiscount ?? ""}
              onChange={(event) =>
                setMinimumDiscount(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Any discount</option>
              {[10, 20, 30, 40, 50].map((discount) => (
                <option key={discount} value={discount}>{discount}% or more</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-option">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) => setInStockOnly(event.target.checked)}
              />
              In-stock products only
            </label>
          </div>

          <button className="mobile-apply-filters" onClick={() => setFiltersOpen(false)}>
            Show {filteredProducts.length} Products
          </button>
        </aside>

        {filtersOpen && (
          <button
            className="filter-backdrop"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
        )}

        <section className="listing-products">
          {filteredProducts.length > 0 ? (
            <div className="listing-product-grid">
              {filteredProducts.map((product) => {
                const image = product.images[0] || product.colors[0]?.image;
                return (
                  <article className="listing-product-card" key={product.id}>
                    <Link to={`/product/${product.id}`} className="listing-product-image">
                      {image && <img src={image} alt={product.name} loading="lazy" />}
                      <span className="listing-product-tag">
                        {product.featured ? "FEATURED" : "THE URBAN EDIT"}
                      </span>
                    </Link>

                    <button
                      className={`listing-wishlist ${wishlist.includes(product.id) ? "active" : ""}`}
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={`Toggle ${product.name} wishlist`}
                    >
                      <Heart size={18} fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
                    </button>

                    <div className="listing-product-info">
                      <Link to={`/product/${product.id}`}>{product.name}</Link>
                      <div className="listing-price">
                        <strong>{money(product.price)}</strong>
                        {product.discountPercent > 0 && (
                          <>
                            <del>{money(product.oldPrice)}</del>
                            <span>{product.discountPercent}% OFF</span>
                          </>
                        )}
                      </div>
                      <div className="listing-rating">
                        {product.reviews > 0 ? (
                          <>
                            <Star size={13} fill="currentColor" />
                            <strong>{product.rating}</strong>
                            <span>({product.reviews} reviews)</span>
                          </>
                        ) : (
                          <span>New product</span>
                        )}
                      </div>
                      <div className="listing-available-sizes">
                        {product.sizes.map((size) => <span key={size}>{size}</span>)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : !loading && !error ? (
            <div className="listing-empty">
              <h2>No products found</h2>
              <p>Try changing your search or filters to see more published products.</p>
              <button className="gold-button" onClick={clearFilters}>Clear Filters</button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
