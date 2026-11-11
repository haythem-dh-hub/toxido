export const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/fragrances", label: "Fragrances" },
  { href: "/accessories", label: "Accessories" },
  { href: "/new-arrivals", label: "New Arrivals" },
  { href: "/#philosophy", label: "About" },
] as const;

export const footerNavigation = {
  Shop: [
    { href: "/fragrances", label: "Fragrances" },
    { href: "/accessories", label: "Accessories" },
    { href: "/new-arrivals", label: "New Arrivals" },
    { href: "/best-sellers", label: "Best Sellers" },
  ],
  "Your Collection": [
    { href: "/search", label: "Search" },
    { href: "/cart", label: "Your Cart" },
    { href: "/wishlist", label: "Wishlist" },
  ],
  "About TOXIDO": [
    { href: "/#philosophy", label: "Our Philosophy" },
    { href: "/fragrances", label: "The Collection" },
    { href: "/best-sellers", label: "Best Sellers" },
  ],
} as const;
