export interface ProductVariantStock {
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  sku?: string;
  name: string;
  category: string;
  categoryId?: string;
  description: string;
  price: number;
  oldPrice: number;
  discountPercent: number;
  rating: number;
  reviews: number;
  sizes: string[];
  colors: {
    name: string;
    hex: string;
    image: string;
  }[];
  images: string[];
  fabric: string;
  fit: string;
  care: string;
  stock: number;
  variants: ProductVariantStock[];
  featured: boolean;
  createdAt: string;
  status?: "published" | "draft";
  lowStockThreshold?: number;
}
