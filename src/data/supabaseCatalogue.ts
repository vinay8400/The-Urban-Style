import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Product } from "./products";
import { normalizeVariantStock } from "./adminProductCatalog";

const PRODUCT_IMAGES_BUCKET = "product-images";
const CATALOGUE_CHANGED_EVENT = "urban-style-supabase-catalogue-changed";

export interface CatalogueCategory {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  createdAt: string;
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string;
  category_id: string | null;
  status: "published" | "draft";
  original_price: number;
  selling_price: number;
  discount_percent: number;
  featured: boolean;
  low_stock_threshold: number;
  created_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
  created_at: string;
}

interface ColorRow {
  id: string;
  product_id: string;
  name: string;
  hex_color: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  color_id: string;
  size: string;
  stock: number;
  reserved_stock: number;
}

interface ImageRow {
  id: string;
  product_id: string;
  storage_path: string;
  sort_order: number;
  alt_text: string | null;
}

export interface CatalogueResult {
  products: Product[];
  categories: CatalogueCategory[];
  imagePaths: Record<string, string[]>;
  error: string;
  imageError: string;
}

export interface AdminProductInput {
  id?: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  originalPrice: number;
  discountPercent: number;
  lowStockThreshold: number;
  status: "published" | "draft";
  featured: boolean;
  colors: { name: string; hex: string }[];
  variants: { size: string; color: string; stock: number }[];
  images: { name: string; dataUrl?: string; storagePath?: string }[];
}

function failureMessage(error: { message?: string } | null, operation: string) {
  return error?.message || `Unable to ${operation}. Check your Supabase configuration and permissions.`;
}

function buildCategoryPath(
  categoryId: string | null,
  categoryMap: Map<string, CategoryRow>,
) {
  const parts: string[] = [];
  const visited = new Set<string>();
  let currentId = categoryId;
  while (currentId) {
    if (visited.has(currentId)) return "";
    visited.add(currentId);
    const category = categoryMap.get(currentId);
    if (!category) return "";
    parts.unshift(category.name);
    currentId = category.parent_id;
  }
  return parts.join(" / ");
}

export async function fetchCatalogue(admin = false): Promise<CatalogueResult> {
  const [categoryResult, productResult] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
  ]);
  if (categoryResult.error) {
    throw new Error(failureMessage(categoryResult.error, "load categories"));
  }
  if (productResult.error) {
    throw new Error(failureMessage(productResult.error, "load products"));
  }

  const categoryRows = (categoryResult.data ?? []) as CategoryRow[];
  const allProducts = (productResult.data ?? []) as ProductRow[];
  const productRows = admin
    ? allProducts
    : allProducts.filter((product) => product.status === "published");
  const categories: CatalogueCategory[] = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    active: row.active,
    createdAt: row.created_at,
  }));
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
  const ids = productRows.map((product) => product.id);

  if (ids.length === 0) {
    return { products: [], categories, imagePaths: {}, error: "", imageError: "" };
  }

  const [colorResult, variantResult, imageResult] = await Promise.all([
    supabase.from("product_colors").select("*").in("product_id", ids),
    supabase.from("product_variants").select("*").in("product_id", ids),
    supabase.from("product_images").select("*").in("product_id", ids).order("sort_order"),
  ]);
  for (const [result, operation] of [
    [colorResult, "load product colours"],
    [variantResult, "load product inventory"],
    [imageResult, "load product images"],
  ] as const) {
    if (result.error) throw new Error(failureMessage(result.error, operation));
  }

  const colors = (colorResult.data ?? []) as ColorRow[];
  const variants = (variantResult.data ?? []) as VariantRow[];
  const images = (imageResult.data ?? []) as ImageRow[];
  const imagePaths: Record<string, string[]> = {};
  for (const image of images) {
    (imagePaths[image.product_id] ??= []).push(image.storage_path);
  }

  const allPaths = images.map((image) => image.storage_path);
  const signedByPath = new Map<string, string>();
  let imageError = "";
  if (allPaths.length > 0) {
    const { data: signedImages, error: signedError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrls(allPaths, 3600);
    if (signedError) {
      imageError = "Product records loaded, but private product images are unavailable. Check Storage read policies.";
    } else {
      signedImages?.forEach((image) => {
        if (image.path && image.signedUrl) signedByPath.set(image.path, image.signedUrl);
        else imageError = "Some private product images could not be signed. Check Storage read policies.";
      });
    }
  }

  const products = productRows.map((row): Product => {
    const productColors = colors.filter((color) => color.product_id === row.id);
    const productVariants = variants.filter((variant) => variant.product_id === row.id);
    const productImages = images
      .filter((image) => image.product_id === row.id)
      .map((image) => signedByPath.get(image.storage_path) ?? "")
      .filter(Boolean);
    const normalizedVariants = normalizeVariantStock(
      productVariants.map((variant) => ({
        size: variant.size,
        color:
          productColors.find((color) => color.id === variant.color_id)?.name ?? "",
        stock: admin ? variant.stock : Math.max(0, variant.stock - variant.reserved_stock),
      })),
      productColors,
    );
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: buildCategoryPath(row.category_id, categoryMap),
      categoryId: row.category_id ?? undefined,
      description: row.description,
      price: Number(row.selling_price),
      oldPrice: Number(row.original_price),
      discountPercent: Number(row.discount_percent),
      rating: 0,
      reviews: 0,
      sizes: [...new Set(normalizedVariants.map((variant) => variant.size))],
      colors: productColors.map((color) => ({
        name: color.name,
        hex: color.hex_color,
        image: productImages[0] ?? "",
      })),
      images: productImages,
      fabric: "",
      fit: "",
      care: "",
      stock: normalizedVariants.reduce((sum, variant) => sum + variant.stock, 0),
      variants: normalizedVariants,
      featured: row.featured,
      createdAt: row.created_at,
      status: row.status,
      lowStockThreshold: row.low_stock_threshold,
    };
  });
  return { products, categories, imagePaths, error: "", imageError };
}

export function notifySupabaseCatalogueChanged() {
  window.dispatchEvent(new Event(CATALOGUE_CHANGED_EVENT));
}

export function useSupabaseCatalogue(admin = false) {
  const [result, setResult] = useState<CatalogueResult>({
    products: [],
    categories: [],
    imagePaths: {},
    error: "",
    imageError: "",
  });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CATALOGUE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CATALOGUE_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCatalogue(admin)
      .then((catalogue) => {
        if (active) setResult({ ...catalogue, error: "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult((current) => ({
          ...current,
          products: [],
          error: error instanceof Error ? error.message : "Unable to load the catalogue.",
        }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin, revision]);

  return { ...result, loading };
}

export async function saveAdminProduct(input: AdminProductInput) {
  const productId = input.id ?? `product-${crypto.randomUUID()}`;
  const { data: existingProduct, error: existingError } = await supabase
    .from("products")
    .select("id, created_at")
    .eq("id", productId)
    .maybeSingle();
  if (existingError) throw new Error(failureMessage(existingError, "load the product"));

  const { error: productError } = await supabase.from("products").upsert({
    id: productId,
    sku: input.sku.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    category_id: input.categoryId,
    status: "draft",
    original_price: input.originalPrice,
    discount_percent: input.discountPercent,
    featured: input.featured,
    low_stock_threshold: input.lowStockThreshold,
  });
  if (productError) throw new Error(failureMessage(productError, "save product details"));

  const { data: oldColors, error: colorsError } = await supabase
    .from("product_colors")
    .select("*")
    .eq("product_id", productId);
  if (colorsError) throw new Error(failureMessage(colorsError, "load product colours"));
  const colorIds = new Map<string, string>();
  for (const color of input.colors) {
    const existing = (oldColors as ColorRow[]).find(
      (row) => row.name.toLowerCase() === color.name.toLowerCase(),
    );
    if (existing) {
      const { error } = await supabase.from("product_colors").update({
        name: color.name,
        hex_color: color.hex,
      }).eq("id", existing.id);
      if (error) throw new Error(failureMessage(error, "update product colours"));
      colorIds.set(color.name, existing.id);
    } else {
      const { data, error } = await supabase.from("product_colors").insert({
        product_id: productId,
        name: color.name,
        hex_color: color.hex,
      }).select("id").single();
      if (error || !data) throw new Error(failureMessage(error, "add product colours"));
      colorIds.set(color.name, data.id);
    }
  }

  const desiredVariants = input.variants.map((variant) => {
    const colorId = colorIds.get(variant.color);
    if (!colorId) throw new Error(`Missing database colour for ${variant.color}.`);
    return {
      product_id: productId,
      color_id: colorId,
      size: variant.size,
      stock: variant.stock,
    };
  });
  const { error: variantSaveError } = await supabase
    .from("product_variants")
    .upsert(desiredVariants, { onConflict: "product_id,color_id,size" });
  if (variantSaveError) throw new Error(failureMessage(variantSaveError, "save product inventory"));

  const retainedColorIds = [...colorIds.values()];
  for (const color of oldColors as ColorRow[]) {
    if (!retainedColorIds.includes(color.id)) {
      const { error } = await supabase.from("product_colors").delete().eq("id", color.id);
      if (error) throw new Error(failureMessage(error, "remove product colours"));
    }
  }

  const { data: oldImages, error: oldImagesError } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId);
  if (oldImagesError) throw new Error(failureMessage(oldImagesError, "load product images"));

  const desiredPaths: string[] = [];
  for (const image of input.images) {
    if (image.storagePath) {
      desiredPaths.push(image.storagePath);
      continue;
    }
    if (!image.dataUrl) throw new Error(`Image ${image.name} has no upload data.`);
    const blob = await (await fetch(image.dataUrl)).blob();
    const safeName = image.name.replace(/[^\w.-]+/g, "-");
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: false,
    });
    if (error) throw new Error(failureMessage(error, `upload ${image.name}`));
    desiredPaths.push(path);
  }

  const existingImages = oldImages as ImageRow[];
  for (const [sortOrder, storagePath] of desiredPaths.entries()) {
    const existing = existingImages.find((image) => image.storage_path === storagePath);
    const imageWrite = existing
      ? supabase.from("product_images").update({ sort_order: sortOrder }).eq("id", existing.id)
      : supabase.from("product_images").insert({
          product_id: productId,
          storage_path: storagePath,
          sort_order: sortOrder,
          alt_text: input.name.trim(),
        });
    const { error } = await imageWrite;
    if (error) throw new Error(failureMessage(error, "save product image details"));
  }
  const removedImages = existingImages.filter((image) => !desiredPaths.includes(image.storage_path));
  for (const image of removedImages) {
    const { error } = await supabase.from("product_images").delete().eq("id", image.id);
    if (error) throw new Error(failureMessage(error, "remove product image details"));
    const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
    if (storageError) throw new Error(failureMessage(storageError, "remove product image file"));
  }

  if (existingProduct) {
    const { data: oldVariants, error } = await supabase
      .from("product_variants")
      .select("id, color_id, size")
      .eq("product_id", productId);
    if (error) throw new Error(failureMessage(error, "verify product variants"));
    for (const variant of oldVariants ?? []) {
      const stillPresent = desiredVariants.some(
        (desired) => desired.color_id === variant.color_id && desired.size === variant.size,
      );
      if (!stillPresent) {
        const { error: deleteError } = await supabase.from("product_variants").delete().eq("id", variant.id);
        if (deleteError) throw new Error(failureMessage(deleteError, "remove product variant"));
      }
    }
  }

  const { error: publishError } = await supabase.from("products").update({
    status: input.status,
  }).eq("id", productId);
  if (publishError) throw new Error(failureMessage(publishError, "publish product"));
  notifySupabaseCatalogueChanged();
  return productId;
}

export async function setProductStatus(id: string, status: "published" | "draft") {
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) throw new Error(failureMessage(error, "update product publication"));
  notifySupabaseCatalogueChanged();
}

export async function deleteAdminProduct(id: string) {
  const { data: images, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", id);
  if (imageError) throw new Error(failureMessage(imageError, "load product images"));
  const paths = (images ?? []).map((image) => image.storage_path);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(failureMessage(error, "delete product"));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    if (storageError) throw new Error(failureMessage(storageError, "delete product images"));
  }
  notifySupabaseCatalogueChanged();
}

export async function saveCategory(input: {
  id?: string;
  name: string;
  parentId: string | null;
  active: boolean;
}) {
  const { error } = await supabase.from("categories").upsert({
    id: input.id ?? `cat-${crypto.randomUUID()}`,
    name: input.name.trim(),
    parent_id: input.parentId,
    active: input.active,
  });
  if (error) throw new Error(failureMessage(error, "save category"));
  notifySupabaseCatalogueChanged();
}

export async function deleteCategories(ids: string[]) {
  const { data: references, error: referenceError } = await supabase
    .from("products")
    .select("category_id")
    .in("category_id", ids);
  if (referenceError) throw new Error(failureMessage(referenceError, "check category usage"));
  if ((references ?? []).length > 0) {
    throw new Error("Move or reassign products using these categories before deleting them.");
  }
  for (const id of [...ids].reverse()) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(failureMessage(error, "delete category"));
  }
  notifySupabaseCatalogueChanged();
}

export async function updateCategory(input: {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
}) {
  const { error } = await supabase.from("categories").update({
    name: input.name.trim(),
    parent_id: input.parentId,
    active: input.active,
  }).eq("id", input.id);
  if (error) throw new Error(failureMessage(error, "update category"));
  notifySupabaseCatalogueChanged();
}
