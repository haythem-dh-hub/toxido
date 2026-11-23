export function CatalogDataNotice({ isDemo = true }: { isDemo?: boolean }) {
  if (!isDemo) return null;
  return (
    <p className="mt-5 border-l border-gold-muted pl-4 text-xs leading-5 text-muted">
      Demonstration catalogue: product details, prices, and stock are sample records until the live inventory is loaded.
    </p>
  );
}
