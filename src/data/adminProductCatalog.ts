import { useEffect, useState } from "react";
import type { Product, ProductVariantStock } from "./products";

const PRODUCT_STORAGE_KEY = "urban-style-products";
const CATEGORY_STORAGE_KEY = "urban-style-categories";
const PRODUCTS_CHANGED_EVENT = "urban-style-products-changed";

interface StoredColor {
  name: string;
  hex: string;
  image?: string;
}

interface StoredVariant {
  size: string;
  color?: string;
  stock: number;
}

export interface StoredAdminProduct {
  id: string;
  sku?: string;
  name: string;
  categoryId?: string;
  description?: string;
  categoryPath?: string;
  image?: string;
  images?: string[];
  colors?: StoredColor[];
  originalPrice?: number;
  sellingPrice?: number;
  discountPercent?: number;
  sizes?: StoredVariant[];
  lowStockThreshold?: number;
  featured?: boolean;
  createdAt?: string;
  status?: string;
}

interface StoredCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export function categoryPathSegments(path: string): string[] {
  return path
    .split(/\s*(?:→|\/|>)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function categorySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeVariantStock(
  sizes: unknown,
  colors: readonly { name: string }[] = [],
): ProductVariantStock[] {
  if (!Array.isArray(sizes)) return [];

  const defaultColor =
    colors.find((color) => typeof color.name === "string" && color.name.trim())
      ?.name ?? "Default";
  const stockByVariant = new Map<string, ProductVariantStock>();

  sizes.forEach((value) => {
    if (
      !isRecord(value) ||
      typeof value.size !== "string" ||
      !value.size.trim()
    ) {
      return;
    }

    const color =
      typeof value.color === "string" && value.color.trim()
        ? value.color
        : defaultColor;
    const stock = Number(value.stock);
    if (!Number.isInteger(stock) || stock < 0) return;

    const key = JSON.stringify([value.size, color]);
    const current = stockByVariant.get(key);
    stockByVariant.set(key, {
      size: value.size,
      color,
      stock: (current?.stock ?? 0) + stock,
    });
  });

  return [...stockByVariant.values()];
}

export function getVariantStock(
  product: Pick<Product, "variants">,
  size: string,
  color: string,
): number {
  return (
    product.variants.find(
      (variant) => variant.size === size && variant.color === color,
    )?.stock ?? 0
  );
}

const SEARCH_SYNONYMS: Record<string, string> = {
  trousers: "pants",
  trouser: "pants",
  pant: "pants",
  jeans: "denim",
  tee: "t-shirt",
  tees: "t-shirt",
  shirt: "top",
  shirts: "tops",
};

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits += 1;
  return edits <= 1;
}

function searchText(product: Product): string {
  return [
    product.name,
    product.description,
    product.sku ?? "",
    product.category,
    ...product.colors.map((color) => color.name),
    ...product.sizes,
  ]
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function productSearchScore(product: Product, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;

  const text = searchText(product);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const expandedTokens = tokens.map((token) => SEARCH_SYNONYMS[token] ?? token);
  const expandedQuery = expandedTokens.join(" ");
  if (text.includes(normalizedQuery) || text.includes(expandedQuery)) return 100;

  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  for (const token of expandedTokens) {
    if (words.some((word) => word.includes(token) || token.includes(word))) {
      score += 10;
    } else if (
      token.length >= 4 &&
      words.some((word) => editDistanceAtMostOne(word, token))
    ) {
      score += 5;
    } else {
      return 0;
    }
  }
  return score;
}

export function searchPublishedProducts(
  products: Product[],
  query: string,
): Product[] {
  return products
    .map((product) => ({ product, score: productSearchScore(product, query) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((match) => match.product);
}

function readCategories(): StoredCategory[] {
  try {
    const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is StoredCategory =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        (typeof item.parentId === "string" || item.parentId === null),
    );
  } catch (error) {
    console.error("Unable to read stored product categories.", error);
    return [];
  }
}

function categoryPathFor(
  categoryId: string | undefined,
  categories: StoredCategory[],
): string {
  if (!categoryId) return "";
  const parts: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = categoryId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categories.find((item) => item.id === currentId);
    if (!category) return "";
    parts.unshift(category.name);
    currentId = category.parentId;
  }

  return currentId ? "" : parts.join(" / ");
}

function isStoredProduct(value: unknown): value is StoredAdminProduct {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.status === "published"
  );
}

function toProduct(
  stored: StoredAdminProduct,
  categories: StoredCategory[],
): Product {
  const images = Array.isArray(stored.images)
    ? stored.images.filter((image): image is string => typeof image === "string" && image.length > 0)
    : [];
  if (images.length === 0 && typeof stored.image === "string" && stored.image) {
    images.push(stored.image);
  }

  const variants = normalizeVariantStock(stored.sizes, stored.colors);
  const sizes = [...new Set(variants.map((variant) => variant.size))];
  const primaryImage = images[0] ?? "";
  const colors = Array.isArray(stored.colors)
    ? stored.colors.flatMap((color) => {
        if (
          !isRecord(color) ||
          typeof color.name !== "string" ||
          !color.name.trim() ||
          typeof color.hex !== "string"
        ) {
          return [];
        }
        return [{
          name: color.name,
          hex: color.hex,
          image:
            typeof color.image === "string" && color.image
              ? color.image
              : primaryImage,
        }];
      })
    : [];
  const productColors = colors.length > 0
    ? colors
    : [{ name: "Default", hex: "#c9b89b", image: primaryImage }];
  const originalPrice =
    typeof stored.originalPrice === "number" &&
    Number.isFinite(stored.originalPrice)
      ? stored.originalPrice
    : 0;
  const calculatedPrice =
    typeof stored.sellingPrice === "number" &&
    Number.isFinite(stored.sellingPrice)
      ? stored.sellingPrice
    : Math.round(
        originalPrice * (1 - (Number(stored.discountPercent) || 0) / 100),
      );
  const discountPercent =
    typeof stored.discountPercent === "number" &&
    Number.isFinite(stored.discountPercent)
      ? stored.discountPercent
      : originalPrice > 0
        ? Math.round((1 - calculatedPrice / originalPrice) * 100)
        : 0;

  return {
    id: stored.id,
    sku: typeof stored.sku === "string" ? stored.sku : "",
    name: stored.name.trim(),
    category:
      categoryPathFor(stored.categoryId, categories) ||
      (typeof stored.categoryPath === "string" ? stored.categoryPath : "") ||
      "Uncategorised",
    categoryId: stored.categoryId,
    description:
      typeof stored.description === "string" ? stored.description : "",
    price: calculatedPrice,
    oldPrice: originalPrice,
    discountPercent,
    rating: 0,
    reviews: 0,
    sizes,
    colors: productColors,
    images,
    fabric: "",
    fit: "",
    care: "",
    stock: variants.reduce((total, variant) => total + variant.stock, 0),
    variants,
    featured: Boolean(stored.featured),
    createdAt:
      typeof stored.createdAt === "string" ? stored.createdAt : "",
  };
}

export function getPublishedAdminProducts(): Product[] {
  try {
    const saved = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!saved) return [];

    const records: unknown = JSON.parse(saved);
    if (!Array.isArray(records)) return [];

    const categories = readCategories();
    return records
      .filter(isStoredProduct)
      .map((product) => toProduct(product, categories));
  } catch (error) {
    console.error("Unable to read published admin products.", error);
    return [];
  }
}

export function notifyAdminProductsChanged(): void {
  window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT));
}

export function usePublishedAdminProducts(): Product[] {
  const [products, setProducts] = useState<Product[]>(getPublishedAdminProducts);

  useEffect(() => {
    const refresh = () => setProducts(getPublishedAdminProducts());
    window.addEventListener("storage", refresh);
    window.addEventListener(PRODUCTS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PRODUCTS_CHANGED_EVENT, refresh);
    };
  }, []);

  return products;
}
