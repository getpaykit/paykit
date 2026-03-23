export type PriceInterval = "month" | "year";

export interface ProductPrice {
  amount: number;
  interval?: PriceInterval;
}

export interface ProductConfig {
  id: string;
  name: string;
  price: ProductPrice;
}

export type Product = Readonly<ProductConfig>;

export function product(config: ProductConfig): Product {
  return Object.freeze(config);
}
