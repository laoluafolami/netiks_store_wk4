#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const apiBaseUrl = process.env.NETIKS_API_BASE_URL ?? "http://localhost:8000/api/v1";
const dockerBin =
  process.env.DOCKER_BIN ?? "/Applications/Docker.app/Contents/Resources/bin/docker";

const demoVendors = [
  {
    email: "maya.brooks@demo-netiks.com",
    fullName: "Maya Brooks",
    password: "Password123!",
    store: {
      description:
        "Thoughtful travel accessories and everyday carry pieces for people who move between meetings, airports, and focused work blocks.",
      name: "Harbor & Pine Supply",
      slug: "harbor-and-pine-supply",
    },
    category: {
      description: "Travel-ready organizers, sleeves, and carry goods designed for everyday work.",
      name: "Carry Goods",
      slug: "carry-goods",
    },
    products: [
      {
        description:
          "Waxed canvas organizer with elastic loops, zipped mesh, and room for chargers, earbuds, and small notebooks.",
        image:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
        name: "Canvas Tech Organizer",
        price: "68.00",
        sku: "HPS-ORG-101",
        slug: "canvas-tech-organizer",
        stock: 20,
      },
      {
        description:
          "Structured laptop sleeve with a soft-lined interior, magnetic closure, and enough padding for everyday commuting.",
        image:
          "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
        name: "Metro Laptop Sleeve",
        price: "92.00",
        sku: "HPS-SLV-205",
        slug: "metro-laptop-sleeve",
        stock: 16,
      },
    ],
  },
  {
    email: "julian.mercer@demo-netiks.com",
    fullName: "Julian Mercer",
    password: "Password123!",
    store: {
      description:
        "Compact audio gear for desks, studios, and quiet work corners where clean sound matters as much as the setup.",
      name: "Northline Audio Co.",
      slug: "northline-audio-co",
    },
    category: {
      description: "Desktop speakers, headphones, and calm studio accessories.",
      name: "Workspace Audio",
      slug: "workspace-audio",
    },
    products: [
      {
        description:
          "Balanced over-ear headphones with a matte finish, wireless playback, and comfort tuned for long editing sessions.",
        image:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
        name: "Slate Wireless Headphones",
        price: "149.99",
        sku: "NAC-WH-001",
        slug: "slate-wireless-headphones",
        stock: 12,
      },
      {
        description:
          "Compact stereo desk speakers with a warm low end, clean vocal detail, and simple front-facing controls.",
        image:
          "https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&w=1200&q=80",
        name: "Northline Desk Speaker Pair",
        price: "219.00",
        sku: "NAC-SP-220",
        slug: "northline-desk-speaker-pair",
        stock: 8,
      },
    ],
  },
  {
    email: "elena.park@demo-netiks.com",
    fullName: "Elena Park",
    password: "Password123!",
    store: {
      description:
        "Desk objects that make a workspace calmer and more intentional, from risers to lighting and ceramic accents.",
      name: "Cedar & Circuit",
      slug: "cedar-and-circuit",
    },
    category: {
      description: "Desk setup tools, monitor accessories, and minimalist workspace pieces.",
      name: "Desk Setup",
      slug: "desk-setup",
    },
    products: [
      {
        description:
          "Tempered glass riser with brushed aluminum legs, sized for a monitor, keyboard storage, and a cleaner desktop profile.",
        image:
          "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80",
        name: "Glass Monitor Riser",
        price: "124.00",
        sku: "CAC-RIS-310",
        slug: "glass-monitor-riser",
        stock: 11,
      },
      {
        description:
          "Dimmable table lamp with a warm tone, compact footprint, and gentle light spread for late evening work sessions.",
        image:
          "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80",
        name: "Fjord Task Lamp",
        price: "89.50",
        sku: "CAC-LMP-118",
        slug: "fjord-task-lamp",
        stock: 14,
      },
    ],
  },
];

const demoOrders = [
  {
    buyer_email: "naomi.cole@example.com",
    buyer_name: "Naomi Cole",
    buyer_phone: "+1 415 555 0198",
    payment_last4: "4242",
    product_slug: "slate-wireless-headphones",
    quantity: 2,
    shipping_address: "14 Mercer Lane, Brooklyn, NY 11201",
  },
  {
    buyer_email: "owen.hart@example.com",
    buyer_name: "Owen Hart",
    buyer_phone: "+1 646 555 0112",
    payment_last4: "1881",
    product_slug: "northline-desk-speaker-pair",
    quantity: 1,
    shipping_address: "62 Pine Street, Seattle, WA 98101",
  },
  {
    buyer_email: "sara.nguyen@example.com",
    buyer_name: "Sara Nguyen",
    buyer_phone: "+1 310 555 0174",
    payment_last4: "3005",
    product_slug: "canvas-tech-organizer",
    quantity: 3,
    shipping_address: "2214 Olive Avenue, Santa Monica, CA 90405",
  },
];

function compose(args) {
  return execFileSync(dockerBin, ["compose", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${raw}`);
  }
  return raw ? JSON.parse(raw) : null;
}

async function registerVendor(vendor) {
  const registration = await fetchJson(`${apiBaseUrl}/auth/register`, {
    body: JSON.stringify({
      email: vendor.email,
      full_name: vendor.fullName,
      password: vendor.password,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!registration?.access_token) {
    throw new Error(`Could not establish a vendor session for ${vendor.email}`);
  }

  return registration.access_token;
}

async function seedVendor(vendor) {
  const accessToken = await registerVendor(vendor);

  await fetchJson(`${apiBaseUrl}/stores`, {
    body: JSON.stringify({
      contact_email: vendor.email,
      description: vendor.store.description,
      name: vendor.store.name,
      slug: vendor.store.slug,
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  await fetchJson(`${apiBaseUrl}/categories`, {
    body: JSON.stringify({
      description: vendor.category.description,
      name: vendor.category.name,
      slug: vendor.category.slug,
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const store = await fetchJson(`${apiBaseUrl}/vendors/me/store`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const categories = await fetchJson(`${apiBaseUrl}/categories`);
  const category = categories.data.find((item) => item.slug === vendor.category.slug);

  if (!store?.data?.id || !category?.id) {
    throw new Error(`Could not resolve store/category IDs for ${vendor.fullName}`);
  }

  for (const product of vendor.products) {
    await fetchJson(`${apiBaseUrl}/products`, {
      body: JSON.stringify({
        category_id: category.id,
        currency: "USD",
        description: product.description,
        featured_image_url: product.image,
        name: product.name,
        price: product.price,
        sku: product.sku,
        slug: product.slug,
        status: "published",
        stock_quantity: product.stock,
        store_id: store.data.id,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  }
}

async function placeDemoOrders() {
  const products = await fetchJson(`${apiBaseUrl}/products`);
  const productIdBySlug = new Map(products.data.map((item) => [item.slug, item.id]));

  for (const order of demoOrders) {
    const productId = productIdBySlug.get(order.product_slug);
    if (!productId) {
      throw new Error(`Product slug ${order.product_slug} was not found while creating demo orders.`);
    }

    await fetchJson(`${apiBaseUrl}/checkout`, {
      body: JSON.stringify({
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        buyer_phone: order.buyer_phone,
        payment_last4: order.payment_last4,
        payment_method: "demo-card",
        product_id: productId,
        quantity: order.quantity,
        shipping_address: order.shipping_address,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }
}

function resetDatabase() {
  log("Resetting demo marketplace tables inside Postgres...");
  compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-d",
    "netiks_store",
    "-c",
    "TRUNCATE TABLE catalog.orders, catalog.products, catalog.categories, vendor.stores, identity.auth_sessions, identity.users RESTART IDENTITY CASCADE;",
  ]);
}

async function main() {
  resetDatabase();
  for (const vendor of demoVendors) {
    log(`Seeding vendor ${vendor.fullName}...`);
    await seedVendor(vendor);
  }
  log("Creating demo orders...");
  await placeDemoOrders();

  const products = await fetchJson(`${apiBaseUrl}/products`);
  log(`Demo marketplace ready with ${products.data.length} published products.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
