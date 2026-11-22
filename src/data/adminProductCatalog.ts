import type { Product, ProductVariantStock } from "./products";

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
      id: typeof value.id === "string" ? value.id : current?.id,
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
