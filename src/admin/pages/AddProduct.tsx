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
} from "../../data/adminProductCatalog";
import {
  saveAdminProduct,
  useSupabaseCatalogue,
} from "../../data/supabaseCatalogue";

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

const PRESET_SIZES = ["S", "M", "L", "XL", "XXL"];

interface ImagePreview {
  id: string;
  name: string;
  dataUrl: string;
  storagePath?: string;
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

export default function AddProduct() {
  const { productId } = useParams();
  const catalogue = useSupabaseCatalogue(true);
  if (catalogue.loading) {
    return <main className="admin-add-product-page"><p>Loading product and categories from Supabase…</p></main>;
  }
  if (catalogue.error) {
    return <main className="admin-add-product-page"><p className="admin-add-product-error" role="alert">{catalogue.error}</p></main>;
  }
  const product = catalogue.products.find((item) => item.id === productId);
  if (productId && !product) {
    return <main className="admin-add-product-page"><p className="admin-add-product-error" role="alert">This product could not be found in Supabase.</p></main>;
  }
  return <AddProductForm key={productId ?? "new"} productId={productId} catalogue={catalogue} initialProduct={product} />;
}

function AddProductForm({
  productId,
  catalogue,
  initialProduct,
}: {
  productId?: string;
  catalogue: ReturnType<typeof useSupabaseCatalogue>;
  initialProduct: ReturnType<typeof useSupabaseCatalogue>["products"][number] | undefined;
}) {
  const navigate = useNavigate();
  const initialVariants = normalizeVariantStock(initialProduct?.variants, initialProduct?.colors);
  const initialImagePaths = initialProduct ? catalogue.imagePaths[initialProduct.id] ?? [] : [];
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "");
  const [images, setImages] = useState<ImagePreview[]>(
    (initialProduct?.images ?? []).map((dataUrl, index) => ({
      id: `existing-${index}`,
      name: `Product image ${index + 1}`,
      dataUrl,
      storagePath: initialImagePaths[index],
    })),
  );
  const [colors, setColors] = useState<ProductColor[]>(
    initialProduct?.colors.map(({ name: color, hex }) => ({ name: color, hex })) ?? [],
  );
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#c9b89b");
  const [sizes, setSizes] = useState<string[]>([...new Set(initialVariants.map((variant) => variant.size))]);
  const [customSize, setCustomSize] = useState("");
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>(
    Object.fromEntries(initialVariants.map((variant) => [
      `${variant.color}::${variant.size}`,
      String(variant.stock),
    ])),
  );
  const [originalPrice, setOriginalPrice] = useState(initialProduct ? String(initialProduct.oldPrice) : "");
  const [discountPercent, setDiscountPercent] = useState(String(initialProduct?.discountPercent ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initialProduct?.lowStockThreshold ?? 5));
  const [status, setStatus] = useState<"draft" | "published">(initialProduct?.status ?? "draft");
  const [featured, setFeatured] = useState(Boolean(initialProduct?.featured));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const categories: Category[] = catalogue.categories;

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

  async function saveProduct(
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
      await saveAdminProduct({
        id: productId,
        sku: normalizedSku,
        name: name.trim(),
        description: description.trim(),
        categoryId: selectedCategory.id,
        originalPrice: price,
        discountPercent: discount,
        lowStockThreshold: parsedThreshold,
        status,
        featured,
        colors,
        variants,
        images: images.map((image) => ({
          name: image.name,
          dataUrl: image.storagePath ? undefined : image.dataUrl,
          storagePath: image.storagePath,
        })),
      });
      navigate("/admin/products");
    } catch (saveError) {
      setError(
        saveError instanceof Error
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

      {!catalogue.error && catalogue.imageError && (
        <p className="admin-add-product-error" role="alert">{catalogue.imageError}</p>
      )}

      <form className="admin-add-product-form" onSubmit={saveProduct}>
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
          {categoryOptions.length === 0 && (
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
            <small>Images are uploaded to the private Supabase product image bucket.</small>
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

        <div className="admin-add-product-footer">
          <Link to="/admin/products">Cancel</Link>
          <button type="submit" className="admin-add-product-action" disabled={saving}>
            <Upload size={16} />
            {saving ? "Saving..." : productId ? "Save Changes" : "Save Product"}
          </button>
        </div>
      </form>
    </main>
  );
}
