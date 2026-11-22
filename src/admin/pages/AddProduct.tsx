import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ImagePlus,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  normalizeVariantStock,
  notifyAdminProductsChanged,
} from "../../data/adminProductCatalog";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  createdAt: string;
}

interface ProductColor {
  name: string;
  hex: string;
}

interface ProductVariantStock {
  size: string;
  color: string;
  stock: number;
}

interface StoredProduct {
  id: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  categoryPath: string;
  image: string;
  images: string[];
  colors: ProductColor[];
  originalPrice: number;
  discountPercent: number;
  sellingPrice: number;
  sizes: ProductVariantStock[];
  lowStockThreshold: number;
  stockStatus: "in" | "low" | "out";
  status: "published" | "draft";
  featured: boolean;
  createdAt: string;
}

const PRODUCT_STORAGE_KEY = "urban-style-products";
const CATEGORY_STORAGE_KEY = "urban-style-categories";
const PRESET_SIZES = ["S", "M", "L", "XL", "XXL"];

const starterCategories: Category[] = [
  {
    id: "men",
    name: "Men",
    parentId: null,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "women",
    name: "Women",
    parentId: null,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "kids",
    name: "Kids",
    parentId: null,
    active: true,
    createdAt: new Date().toISOString(),
  },
];

interface ImagePreview {
  id: string;
  name: string;
  dataUrl: string;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`Unable to preview ${file.name}.`));
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function createProductId() {
  return `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface InitialFormData {
  categories: Category[];
  categoryLoadError: string;
  product: StoredProduct | null;
  productLoadError: string;
}

function readInitialFormData(productId?: string): InitialFormData {
  let categories = starterCategories;
  let categoryLoadError = "";
  let product: StoredProduct | null = null;
  let productLoadError = "";

  try {
    const savedCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (savedCategories !== null) {
      const parsed: unknown = JSON.parse(savedCategories);
      if (!Array.isArray(parsed)) {
        throw new Error("Saved categories have an invalid format.");
      }
      categories = parsed as Category[];
    }
  } catch (loadError) {
    categoryLoadError =
      loadError instanceof Error
        ? loadError.message
        : "Unable to load categories.";
  }

  if (productId) {
    try {
      const savedProducts = localStorage.getItem(PRODUCT_STORAGE_KEY);
      const records: unknown = savedProducts ? JSON.parse(savedProducts) : [];
      if (!Array.isArray(records)) {
        throw new Error("Saved products have an invalid format.");
      }

      product =
        records.find(
          (record): record is StoredProduct =>
            Boolean(record) &&
            typeof record === "object" &&
            "id" in record &&
            record.id === productId,
        ) ?? null;
      if (!product) {
        throw new Error("This product could not be found.");
      }
    } catch (loadError) {
      productLoadError =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this product.";
    }
  }

  return { categories, categoryLoadError, product, productLoadError };
}

function productColors(product: StoredProduct | null): ProductColor[] {
  if (!product) return [];
  const existingColors = Array.isArray(product.colors) ? product.colors : [];
  if (existingColors.length > 0) return existingColors;
  return [
    ...new Set(
      Array.isArray(product.sizes)
        ? product.sizes.map((variant) => variant.color || "Default")
        : [],
    ),
  ].map((color) => ({ name: color, hex: "#c9b89b" }));
}

export default function AddProduct() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [initialData] = useState(() => readInitialFormData(productId));
  const initialProduct = initialData.product;
  const initialColors = productColors(initialProduct);
  const initialVariants = normalizeVariantStock(
    initialProduct?.sizes,
    initialColors,
  );
  const initialImages =
    initialProduct?.images?.length
      ? initialProduct.images
      : initialProduct?.image
        ? [initialProduct.image]
        : [];
  const [categories] = useState<Category[]>(initialData.categories);
  const categoryLoadError = initialData.categoryLoadError;
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "");
  const [images, setImages] = useState<ImagePreview[]>(
    initialImages.map((dataUrl, index) => ({
      id: `existing-${index}`,
      name: `Product image ${index + 1}`,
      dataUrl,
    })),
  );
  const [colors, setColors] = useState<ProductColor[]>(initialColors);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#c9b89b");
  const [sizes, setSizes] = useState<string[]>([
    ...new Set(initialVariants.map((variant) => variant.size)),
  ]);
  const [customSize, setCustomSize] = useState("");
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>(
    Object.fromEntries(
      initialVariants.map((variant) => [
        `${variant.color}::${variant.size}`,
        String(variant.stock),
      ]),
    ),
  );
  const [originalPrice, setOriginalPrice] = useState(
    initialProduct ? String(initialProduct.originalPrice) : "",
  );
  const [discountPercent, setDiscountPercent] = useState(
    initialProduct ? String(initialProduct.discountPercent) : "0",
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialProduct ? String(initialProduct.lowStockThreshold ?? 5) : "5",
  );
  const [status, setStatus] = useState<"draft" | "published">(
    initialProduct?.status ?? "draft",
  );
  const [featured, setFeatured] = useState(Boolean(initialProduct?.featured));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const productLoadError = initialData.productLoadError;

  const categoryPath = (id: string, visited = new Set<string>()): string => {
    if (visited.has(id)) return "";
    const category = categories.find((item) => item.id === id);
    if (!category) return "";
    visited.add(id);

    if (!category.parentId) return category.name;
    const parentPath = categoryPath(category.parentId, visited);
    return parentPath ? `${parentPath} → ${category.name}` : category.name;
  };

  const hasActiveAncestors = (
    category: Category,
    visited = new Set<string>(),
  ): boolean => {
    if (!category.active || visited.has(category.id)) return false;
    visited.add(category.id);
    if (!category.parentId) return true;
    const parent = categories.find((item) => item.id === category.parentId);
    return parent ? hasActiveAncestors(parent, visited) : false;
  };

  const categoryOptions = useMemo(() => {
    const result: { category: Category; depth: number }[] = [];

    const visit = (parentId: string | null, depth: number, ancestry: Set<string>) => {
      categories
        .filter((category) => category.parentId === parentId)
        .forEach((category) => {
          if (ancestry.has(category.id)) return;
          result.push({ category, depth });
          const nextAncestry = new Set(ancestry);
          nextAncestry.add(category.id);
          visit(category.id, depth + 1, nextAncestry);
        });
    };

    visit(null, 0, new Set());
    return result;
  }, [categories]);

  const totalStock = colors.reduce(
    (colorTotal, color) =>
      colorTotal +
      sizes.reduce(
        (sizeTotal, size) =>
          sizeTotal +
          (Number.parseInt(stockByVariant[`${color.name}::${size}`] ?? "0", 10) ||
            0),
        0,
      ),
    0,
  );
  const threshold = Number.parseInt(lowStockThreshold, 10) || 0;
  const stockStatus =
    totalStock === 0 ? "Out of Stock" : totalStock <= threshold ? "Low Stock" : "In Stock";
  const numericPrice = Number(originalPrice);
  const numericDiscount = Number(discountPercent);
  const sellingPrice =
    Number.isFinite(numericPrice) && Number.isFinite(numericDiscount)
      ? Math.round(numericPrice * (1 - numericDiscount / 100))
      : 0;

  function addColor() {
    const normalizedName = colorName.trim();
    if (!normalizedName) {
      setError("Enter a colour name before adding it.");
      return;
    }
    if (colors.some((color) => color.name.toLowerCase() === normalizedName.toLowerCase())) {
      setError("That colour has already been added.");
      return;
    }
    setColors((current) => [...current, { name: normalizedName, hex: colorHex }]);
    setColorName("");
    setError("");
  }

  function addCustomSize() {
    const normalizedSize = customSize.trim().toUpperCase();
    if (!normalizedSize) return;
    if (sizes.some((size) => size.toLowerCase() === normalizedSize.toLowerCase())) {
      setError("That size has already been added.");
      return;
    }
    setSizes((current) => [...current, normalizedSize]);
    setCustomSize("");
    setError("");
  }

  async function handleImagesChange(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      const previews = await Promise.all(
        Array.from(files).map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error(`${file.name} is not an image file.`);
          }
          return {
            id: `${file.name}-${file.lastModified}-${Math.random()}`,
            name: file.name,
            dataUrl: await readImage(file),
          };
        }),
      );
      setImages((current) => [...current, ...previews]);
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : "Unable to load image previews.",
      );
    }
  }

  function saveProduct(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    const normalizedSku = sku.trim();
    const price = Number(originalPrice);
    const discount = Number(discountPercent);
    const parsedThreshold = Number(lowStockThreshold);
    const selectedCategory = categories.find((category) => category.id === categoryId);

    if (!selectedCategory || !hasActiveAncestors(selectedCategory)) {
      setError("Choose an active category from the category hierarchy.");
      return;
    }
    if (images.length === 0) {
      setError("Upload at least one product image.");
      return;
    }
    if (colors.length === 0 || sizes.length === 0) {
      setError("Add at least one colour and one size.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Original price cannot be negative.");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setError("Discount must be between 0% and 100%.");
      return;
    }
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0) {
      setError("Low stock threshold must be a non-negative whole number.");
      return;
    }

    const variants: ProductVariantStock[] = [];
    for (const color of colors) {
      for (const size of sizes) {
        const quantityText = stockByVariant[`${color.name}::${size}`] ?? "0";
        const quantity = Number(quantityText);
        if (!Number.isInteger(quantity) || quantity < 0) {
          setError(`Stock for ${color.name} / ${size} must be a non-negative whole number.`);
          return;
        }
        variants.push({ size, color: color.name, stock: quantity });
      }
    }

    setSaving(true);
    try {
      const existingValue = localStorage.getItem(PRODUCT_STORAGE_KEY);
      const existing: unknown = existingValue ? JSON.parse(existingValue) : [];
      if (!Array.isArray(existing)) {
        throw new Error("Saved products have an invalid format. No changes were saved.");
      }
      const editingProduct = productId
        ? existing.find((product: { id?: string }) => product.id === productId)
        : undefined;
      if (productId && !editingProduct) {
        throw new Error("This product no longer exists. No changes were saved.");
      }
      if (
        existing.some(
          (product: { id?: string; sku?: string }) =>
            product.id !== productId &&
            product.sku?.trim().toLowerCase() === normalizedSku.toLowerCase(),
        )
      ) {
        setError("A product with this SKU already exists.");
        setSaving(false);
        return;
      }

      const product: StoredProduct = {
        id:
          editingProduct?.id ??
          createProductId(),
        name: name.trim(),
        sku: normalizedSku,
        description: description.trim(),
        categoryId: selectedCategory.id,
        categoryPath: categoryPath(selectedCategory.id),
        image: images[0].dataUrl,
        images: images.map((image) => image.dataUrl),
        colors,
        originalPrice: price,
        discountPercent: discount,
        sellingPrice,
        sizes: variants,
        lowStockThreshold: parsedThreshold,
        stockStatus:
          totalStock === 0 ? "out" : totalStock <= parsedThreshold ? "low" : "in",
        status,
        featured,
        createdAt: editingProduct?.createdAt ?? new Date().toISOString(),
      };

      localStorage.setItem(
        PRODUCT_STORAGE_KEY,
        JSON.stringify(
          editingProduct
            ? existing.map((item) =>
                item.id === productId ? product : item,
              )
            : [...existing, product],
        ),
      );
      notifyAdminProductsChanged();
      navigate("/admin/products");
    } catch (saveError) {
      setError(
        saveError instanceof DOMException && saveError.name === "QuotaExceededError"
          ? "Browser storage is full. Reduce the image sizes and try again. Images are stored locally only, not uploaded to cloud storage."
          : saveError instanceof Error
            ? saveError.message
            : "Unable to save the product. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="admin-add-product-page">
      <header className="admin-add-product-heading">
        <div>
          <Link to="/admin/products" className="admin-add-product-back">
            <ArrowLeft size={15} /> Back to Products
          </Link>
          <span className="admin-products-eyebrow">THE URBAN STYLE / ADMIN</span>
          <h1>{productId ? "Edit Product" : "Add Product"}</h1>
          <p>Enter product details, variants, pricing and inventory.</p>
        </div>
      </header>

      {productLoadError && (
        <p className="admin-add-product-error" role="alert">{productLoadError}</p>
      )}
      {categoryLoadError && (
        <p className="admin-add-product-error" role="alert">{categoryLoadError}</p>
      )}

      {!productLoadError && <form className="admin-add-product-form" onSubmit={saveProduct}>
        <section className="admin-add-product-section">
          <h2>Product Information</h2>
          <div className="admin-add-product-fields">
            <label>
              Product name *
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label>
              SKU (unique product code) *
              <input
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                maxLength={60}
                required
              />
            </label>
            <label className="admin-add-product-full">
              Description *
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                required
              />
            </label>
            <label>
              Category *
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                <option value="">Select a category</option>
                {categoryOptions.map(({ category, depth }) => (
                  <option
                    value={category.id}
                    key={category.id}
                    disabled={!hasActiveAncestors(category)}
                  >
                    {`${"— ".repeat(depth)}${category.name}${category.active ? "" : " (Inactive)"}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {categoryOptions.length === 0 && !categoryLoadError && (
            <p className="admin-add-product-hint">
              No categories are available. Create one in Category Management first.
            </p>
          )}
        </section>

        <section className="admin-add-product-section">
          <h2>Product Images</h2>
          <label className="admin-add-product-upload">
            <ImagePlus size={22} />
            <span>Choose one or more product images *</span>
            <small>Previews are local to this browser and are not uploaded to cloud storage.</small>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                void handleImagesChange(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {images.length > 0 && (
            <div className="admin-add-product-image-grid">
              {images.map((image, index) => (
                <div className="admin-add-product-image" key={image.id}>
                  <img src={image.dataUrl} alt={image.name} />
                  <span>{index === 0 ? "Primary image" : image.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${image.name}`}
                    onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-add-product-section">
          <h2>Colours and Sizes</h2>
          <div className="admin-add-product-fields">
            <label>
              Colour name
              <input
                value={colorName}
                onChange={(event) => setColorName(event.target.value)}
                placeholder="e.g. Navy Blue"
              />
            </label>
            <label>
              Colour swatch
              <input
                type="color"
                value={colorHex}
                onChange={(event) => setColorHex(event.target.value)}
              />
            </label>
            <button type="button" className="admin-add-product-action" onClick={addColor}>
              <Plus size={16} /> Add colour
            </button>
          </div>
          {colors.length > 0 && (
            <div className="admin-add-product-chips">
              {colors.map((color) => (
                <span key={color.name}>
                  <i style={{ backgroundColor: color.hex }} />
                  {color.name}
                  <button
                    type="button"
                    aria-label={`Remove ${color.name}`}
                    onClick={() => setColors((current) => current.filter((item) => item.name !== color.name))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="admin-add-product-size-picker">
            <span>Available sizes *</span>
            <div>
              {PRESET_SIZES.map((size) => (
                <label key={size}>
                  <input
                    type="checkbox"
                    checked={sizes.includes(size)}
                    onChange={(event) =>
                      setSizes((current) =>
                        event.target.checked
                          ? [...current, size]
                          : current.filter((item) => item !== size),
                      )
                    }
                  />
                  {size}
                </label>
              ))}
              {sizes
                .filter((size) => !PRESET_SIZES.includes(size))
                .map((size) => (
                  <label key={size}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => setSizes((current) => current.filter((item) => item !== size))}
                    />
                    {size}
                  </label>
                ))}
            </div>
          </div>
          <div className="admin-add-product-custom-size">
            <input
              value={customSize}
              onChange={(event) => setCustomSize(event.target.value)}
              placeholder="Add another size (e.g. 3XL)"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomSize();
                }
              }}
            />
            <button type="button" className="admin-add-product-action" onClick={addCustomSize}>
              <Plus size={16} /> Add size
            </button>
          </div>
        </section>

        <section className="admin-add-product-section">
          <h2>Stock by Colour and Size</h2>
          {colors.length === 0 || sizes.length === 0 ? (
            <p className="admin-add-product-hint">
              Add at least one colour and size to enter combination-specific stock.
            </p>
          ) : (
            <div className="admin-add-product-stock-wrap">
              <table className="admin-add-product-stock-table">
                <thead>
                  <tr>
                    <th>Colour</th>
                    {sizes.map((size) => <th key={size}>{size}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {colors.map((color) => (
                    <tr key={color.name}>
                      <th>
                        <i style={{ backgroundColor: color.hex }} />
                        {color.name}
                      </th>
                      {sizes.map((size) => {
                        const key = `${color.name}::${size}`;
                        return (
                          <td key={size}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={stockByVariant[key] ?? "0"}
                              aria-label={`${color.name} ${size} stock`}
                              onChange={(event) =>
                                setStockByVariant((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              required
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="admin-add-product-fields admin-add-product-stock-settings">
            <label>
              Low stock threshold *
              <input
                type="number"
                min="0"
                step="1"
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
                required
              />
            </label>
            <div className="admin-add-product-stock-preview">
              <span>Total available units</span>
              <strong>{totalStock}</strong>
              <b className={`stock-${totalStock === 0 ? "out" : totalStock <= threshold ? "low" : "in"}`}>
                {stockStatus}
              </b>
            </div>
          </div>
        </section>

        <section className="admin-add-product-section">
          <h2>Pricing and Publishing</h2>
          <div className="admin-add-product-fields">
            <label>
              Original / MRP price (₹) *
              <input
                type="number"
                min="0"
                step="0.01"
                value={originalPrice}
                onChange={(event) => setOriginalPrice(event.target.value)}
                required
              />
            </label>
            <label>
              Discount percentage *
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                required
              />
            </label>
            <div className="admin-add-product-price-preview">
              <span>Calculated selling price</span>
              <strong>{formatCurrency(sellingPrice)}</strong>
            </div>
            <label>
              Product status *
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "draft" | "published")}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="admin-add-product-toggle">
              <input
                type="checkbox"
                checked={featured}
                onChange={(event) => setFeatured(event.target.checked)}
              />
              Featured product
            </label>
          </div>
        </section>

        {error && <p className="admin-add-product-error" role="alert">{error}</p>}

        <p className="admin-add-product-hint">
          Product images and catalogue data are saved in this browser only. Images are not uploaded to permanent cloud storage.
        </p>

        <div className="admin-add-product-footer">
          <Link to="/admin/products">Cancel</Link>
          <button type="submit" className="admin-add-product-action" disabled={saving}>
            <Upload size={16} />
            {saving ? "Saving..." : productId ? "Save Changes" : "Save Product"}
          </button>
        </div>
      </form>}
    </main>
  );
}
