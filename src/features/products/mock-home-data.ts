export const homeHero = {
  image: "/images/campaign/heroBackground.png",
  alt: "A dark fragrance bottle on black marble with warm gold light.",
};

export const featuredCollections = [
  { title: "Fragrances", eyebrow: "The collection", href: "/fragrances", image: "/images/campaign/fragrance-placeholder.png", alt: "Abstract fragrance collection placeholder" },
  { title: "Accessories", eyebrow: "The essentials", href: "/accessories", image: "/images/campaign/accessories-placeholder2.jpg", alt: "Abstract accessories collection placeholder" },
  { title: "New Arrivals", eyebrow: "Just landed", href: "/new-arrivals", image: "/images/campaign/accessories-placeholder1.png", alt: "Abstract new collection placeholder" },
  { title: "Best Sellers", eyebrow: "Most desired", href: "/best-sellers", image: "/images/campaign/watch-placeholder.svg", alt: "Abstract best sellers placeholder" },
] as const;

export const accessoriesShowcase = [
  { title: "Time, considered.", description: "Precision pieces for the moments that require no introduction.", href: "/accessories?category=watches", image: "/images/campaign/watch-placeholder.svg", alt: "Abstract luxury watch placeholder" },
  { title: "The finishing touch.", description: "Quietly assured accessories, selected for the everyday ritual.", href: "/accessories", image: "/images/campaign/accessories-placeholder.svg", alt: "Abstract gentleman accessories placeholder" },
] as const;

export const toxidoPrinciples = [
  { title: "Curated Selection", description: "A decisive edit of fragrance and essentials with enduring character." },
  { title: "Premium Experience", description: "Every detail, from discovery to delivery, is considered." },
  { title: "Authentic Products", description: "Sourced with care, presented with complete confidence." },
  { title: "Reliable Delivery", description: "Your order handled with discretion, clarity, and care." },
] as const;
