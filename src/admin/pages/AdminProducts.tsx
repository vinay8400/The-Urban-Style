
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react";
import {
  normalizeVariantStock,
  notifyAdminProductsChanged,
} from "../../data/adminProductCatalog";

interface ProductSizeStock {
  size: string;
  color?: string;
  stock: number;
}

interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  categoryPath: string;
  image: string;
  images?: string[];
  description?: string;
  categoryId?: string;
  colors?: { name: string; hex: string }[];
  originalPrice: number;
  discountPercent: number;
  sizes: ProductSizeStock[];
  lowStockThreshold?: number;
  featured?: boolean;
  status: "published" | "draft";
  createdAt: string;
}

const PRODUCT_STORAGE_KEY = "urban-style-products";

function loadProducts(): AdminProduct[] {
  try {
    const saved = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getTotalStock(product: AdminProduct) {
  return normalizeVariantStock(product.sizes, product.colors).reduce(
    (total, variant) => total + variant.stock,
    0,
  );
}

function getSellingPrice(product: AdminProduct) {
  return Math.round(
    product.originalPrice * (1 - product.discountPercent / 100),
  );
}

function getStockStatus(product: AdminProduct) {
  const stock = getTotalStock(product);
  const threshold =
    typeof product.lowStockThreshold === "number"
      ? product.lowStockThreshold
      : 5;

  if (stock === 0) return "out";
  if (stock <= threshold) return "low";
  return "in";
}

export default function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>(loadProducts);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
    notifyAdminProductsChanged();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.categoryPath.toLowerCase().includes(query);

      const stockStatus = getStockStatus(product);
      const matchesStock =
        stockFilter === "all" || stockStatus === stockFilter;

      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;

      return matchesSearch && matchesStock && matchesStatus;
    });
  }, [products, search, stockFilter, statusFilter]);

  const totalStock = products.reduce(
    (total, product) => total + getTotalStock(product),
    0,
  );

  const inStockCount = products.filter(
    (product) => getStockStatus(product) === "in",
  ).length;

  const lowStockCount = products.filter(
    (product) => getStockStatus(product) === "low",
  ).length;

  const outOfStockCount = products.filter(
    (product) => getStockStatus(product) === "out",
  ).length;

  const deleteProduct = (product: AdminProduct) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setProducts((current) =>
      current.filter((item) => item.id !== product.id),
    );
  };

  const togglePublish = (id: string) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              status:
                product.status === "published" ? "draft" : "published",
            }
          : product,
      ),
    );
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const stockLabel = (product: AdminProduct) => {
    const status = getStockStatus(product);
    const stock = getTotalStock(product);

    if (status === "out") return "Out of Stock";
    if (status === "low") return `Low Stock · ${stock}`;
    return `In Stock · ${stock}`;
  };

  return (
    <main className="admin-products-page">
      <div className="admin-products-heading">
        <div>
          <span className="admin-products-eyebrow">THE URBAN STYLE / ADMIN</span>
          <h1>Products</h1>
          <p>Manage your store catalogue, prices and inventory.</p>
        </div>

        <Link to="/admin/products/new" className="admin-add-product-button">
          <Plus size={17} />
          Add New Product
        </Link>
      </div>

      <section className="admin-product-stats">
        <article className="admin-product-stat">
          <Package />
          <span>Total Products</span>
          <strong>{products.length}</strong>
        </article>

        <article className="admin-product-stat">
          <CheckCircle2 />
          <span>In Stock</span>
          <strong>{inStockCount}</strong>
        </article>

        <article className="admin-product-stat">
          <AlertTriangle />
          <span>Low Stock</span>
          <strong>{lowStockCount}</strong>
        </article>

        <article className="admin-product-stat">
          <XCircle />
          <span>Out of Stock</span>
          <strong>{outOfStockCount}</strong>
        </article>

        <article className="admin-product-stat">
          <Boxes />
          <span>Total Units</span>
          <strong>{totalStock}</strong>
        </article>
      </section>

      <section className="admin-product-table-card">
        <div className="admin-product-toolbar">
          <div>
            <h2>All Products</h2>
            <p>{filteredProducts.length} product(s) found</p>
          </div>

          <div className="admin-product-filters">
            <label className="admin-product-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, SKU or category..."
              />
            </label>

            <label className="admin-product-select">
              <Filter size={15} />
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
              >
                <option value="all">All stock</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </label>

            <select
              className="admin-product-status-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All publishing status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="admin-products-empty">
            <Package size={38} />
            <h3>{products.length === 0 ? "No products yet" : "No matching products"}</h3>
            <p>
              {products.length === 0
                ? "Add your first product to start building your catalogue."
                : "Try changing your search or filters."}
            </p>
            {products.length === 0 && (
              <Link
                to="/admin/products/new"
                className="admin-add-product-button"
              >
                <Plus size={16} /> Add Your First Product
              </Link>
            )}
          </div>
        ) : (
          <div className="admin-products-table-wrap">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Publishing</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-identity">
                          <img
                            src={product.image || ""}
                            alt={product.name}
                            onError={(event) => {
                              event.currentTarget.style.visibility = "hidden";
                            }}
                          />
                          <div>
                            <strong>{product.name}</strong>
                            <small>SKU: {product.sku || "—"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="admin-product-category">
                          {product.categoryPath || "Uncategorised"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-product-price">
                          <strong>{formatPrice(getSellingPrice(product))}</strong>
                          {product.discountPercent > 0 && (
                            <>
                              <small>{formatPrice(product.originalPrice)}</small>
                              <span>{product.discountPercent}% OFF</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`admin-stock-badge stock-${stockStatus}`}
                        >
                          {stockStatus === "in" && <CheckCircle2 size={13} />}
                          {stockStatus === "low" && <AlertTriangle size={13} />}
                          {stockStatus === "out" && <XCircle size={13} />}
                          {stockLabel(product)}
                        </span>
                        <small className="admin-stock-size-count">
                          {new Set(product.sizes.map((item) => item.size)).size} size option(s)
                        </small>
                      </td>

                      <td>
                        <span
                          className={`admin-publish-badge ${
                            product.status === "published"
                              ? "is-published"
                              : "is-draft"
                          }`}
                        >
                          {product.status === "published" ? "Published" : "Draft"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-product-actions">
                          <Link
                            to={`/admin/products/edit/${product.id}`}
                            title="Edit product"
                          >
                            <Pencil size={15} />
                          </Link>

                          <button
                            type="button"
                            title={
                              product.status === "published"
                                ? "Move to draft"
                                : "Publish product"
                            }
                            onClick={() => togglePublish(product.id)}
                          >
                            {product.status === "published" ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>

                          <button
                            type="button"
                            title="Delete product"
                            className="admin-product-delete"
                            onClick={() => deleteProduct(product)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
