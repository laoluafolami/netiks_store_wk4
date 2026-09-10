export type CoreService = {
  name: string;
  title: string;
  description: string;
};

export const coreServices: CoreService[] = [
  {
    name: "gateway",
    title: "API Gateway",
    description: "Single frontend entry point for authentication, routing, and response shaping.",
  },
  {
    name: "identity-service",
    title: "Identity Service",
    description: "Owns users, roles, password hashing, and JWT-based authentication.",
  },
  {
    name: "vendor-service",
    title: "Vendor Service",
    description: "Owns stores, vendor onboarding, and store profile management.",
  },
  {
    name: "catalog-service",
    title: "Catalog Service",
    description: "Owns products, categories, and public marketplace listing capabilities.",
  },
  {
    name: "media-service",
    title: "Media Service",
    description: "Owns upload handling and storage abstraction for local and S3-compatible media.",
  },
  {
    name: "admin-service",
    title: "Admin Service",
    description: "Owns moderation and admin-only marketplace management capabilities.",
  },
];

