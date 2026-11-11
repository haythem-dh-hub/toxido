import Link from "next/link";
import { ProductCardBase } from "@/components/ui/product-card-base";
import { CampaignImage } from "@/components/home/campaign-image";
import type { Product } from "@/types/product";
import { formatMoney } from "@/lib/format-money";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const firstVariant = product.variants[0];
        return (
          <Link key={product.id} href={`/products/${product.slug}`} className="group">
            <ProductCardBase
              brand={product.brand}
              name={product.name}
              meta={product.category}
              price={firstVariant ? formatMoney(firstVariant.price) : "—"}
              image={<CampaignImage src={product.images[0]?.url ?? "/images/campaign/toxic-parfume.png"} alt={product.images[0]?.alt ?? product.name} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />}
            />
          </Link>
        );
      })}
    </div>
  );
}
