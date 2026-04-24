const inventoryCatalog = [
  // ─── APPLE IPHONE 16 SERIES ───
  {
    brand: "Apple", model: "iPhone 16 Pro Max", series: "iPhone 16", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla OLED (OEM)", type: "OLED", quality: "Original", cost: 320, sale: 499, stock: 5 },
      { name: "Pantalla OLED (Copy)", type: "OLED", quality: "Aftermarket", cost: 180, sale: 299, stock: 3 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 45, sale: 119, stock: 10 },
      { name: "Vidrio Trasero", type: "Glass", quality: "Aftermarket", cost: 60, sale: 149, stock: 5 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 16 Pro", series: "iPhone 16", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla OLED (OEM)", type: "OLED", quality: "Original", cost: 290, sale: 449, stock: 5 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 40, sale: 109, stock: 8 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 16 Plus", series: "iPhone 16", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 250, sale: 399, stock: 4 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 35, sale: 99, stock: 7 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 16", series: "iPhone 16", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 220, sale: 349, stock: 6 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 35, sale: 99, stock: 10 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 16e", series: "iPhone 16", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 150, sale: 249, stock: 5 },
      { name: "Batería", type: "Li-Ion", quality: "OEM", cost: 30, sale: 89, stock: 10 },
    ],
  },

  // ─── APPLE IPHONE 17 SERIES (PROYECTADO) ───
  {
    brand: "Apple", model: "iPhone 17 Pro Max", series: "iPhone 17", deviceType: "smartphone", releaseYear: 2025,
    parts: [
      { name: "Pantalla OLED (OEM)", type: "OLED", quality: "Original", cost: 350, sale: 549, stock: 2 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 50, sale: 129, stock: 5 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 17 Air", series: "iPhone 17", deviceType: "smartphone", releaseYear: 2025,
    parts: [
      { name: "Pantalla OLED Ultra Slim", type: "OLED", quality: "Original", cost: 300, sale: 479, stock: 2 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 45, sale: 119, stock: 5 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 17e", series: "iPhone 17", deviceType: "smartphone", releaseYear: 2025,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 160, sale: 269, stock: 3 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 35, sale: 95, stock: 5 },
    ],
  },

  // ─── APPLE IPHONE 15 SERIES ───
  {
    brand: "Apple", model: "iPhone 15 Pro Max", series: "iPhone 15", deviceType: "smartphone", releaseYear: 2023,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 260, sale: 399, stock: 6 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 35, sale: 99, stock: 12 },
      { name: "Puerto de Carga USB-C", type: "USB-C", quality: "Original", cost: 30, sale: 119, stock: 8 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 15", series: "iPhone 15", deviceType: "smartphone", releaseYear: 2023,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 180, sale: 299, stock: 8 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 30, sale: 89, stock: 15 },
    ],
  },

  // ─── APPLE IPHONE 14 SERIES ───
  {
    brand: "Apple", model: "iPhone 14 Pro Max", series: "iPhone 14", deviceType: "smartphone", releaseYear: 2022,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 220, sale: 349, stock: 7 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 25, sale: 85, stock: 20 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 14", series: "iPhone 14", deviceType: "smartphone", releaseYear: 2022,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 140, sale: 249, stock: 10 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 22, sale: 79, stock: 25 },
    ],
  },

  // ─── APPLE IPHONE 13 SERIES ───
  {
    brand: "Apple", model: "iPhone 13 Pro Max", series: "iPhone 13", deviceType: "smartphone", releaseYear: 2021,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 190, sale: 299, stock: 5 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 20, sale: 79, stock: 30 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 13", series: "iPhone 13", deviceType: "smartphone", releaseYear: 2021,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Original", cost: 110, sale: 199, stock: 15 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 18, sale: 69, stock: 40 },
    ],
  },

  // ─── APPLE IPHONE 12 SERIES ───
  {
    brand: "Apple", model: "iPhone 12 Pro Max", series: "iPhone 12", deviceType: "smartphone", releaseYear: 2020,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 95, sale: 179, stock: 10 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 18, sale: 69, stock: 35 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 12", series: "iPhone 12", deviceType: "smartphone", releaseYear: 2020,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 75, sale: 149, stock: 20 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 15, sale: 65, stock: 50 },
    ],
  },

  // ─── APPLE IPHONE 11 SERIES ───
  {
    brand: "Apple", model: "iPhone 11 Pro Max", series: "iPhone 11", deviceType: "smartphone", releaseYear: 2019,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 70, sale: 139, stock: 12 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 15, sale: 65, stock: 40 },
    ],
  },
  {
    brand: "Apple", model: "iPhone 11", series: "iPhone 11", deviceType: "smartphone", releaseYear: 2019,
    parts: [
      { name: "Pantalla LCD Premium", type: "LCD", quality: "Aftermarket", cost: 45, sale: 99, stock: 30 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 12, sale: 59, stock: 60 },
    ],
  },

  // ─── OTROS DISPOSITIVOS ───
  {
    brand: "Samsung", model: "Galaxy S24 Ultra", series: "Galaxy S", deviceType: "smartphone", releaseYear: 2024,
    parts: [
      { name: "Pantalla Dynamic AMOLED 2X", type: "AMOLED", quality: "Original", cost: 240, sale: 389, stock: 4 },
      { name: "Batería", type: "Li-Ion", quality: "Original", cost: 25, sale: 89, stock: 10 },
    ],
  },
  {
    brand: "Samsung", model: "Galaxy S23 Ultra", series: "Galaxy S", deviceType: "smartphone", releaseYear: 2023,
    parts: [
      { name: "Pantalla Dynamic AMOLED 2X", type: "AMOLED", quality: "Original", cost: 210, sale: 329, stock: 6 },
    ],
  },
  {
    brand: "Apple", model: "iPad Pro 12.9 M2", series: "iPad Pro", deviceType: "tablet", releaseYear: 2022,
    parts: [
      { name: "Pantalla Mini-LED", type: "Mini-LED", quality: "Original", cost: 380, sale: 549, stock: 2 },
    ],
  },
];

export function buildSeedInventoryItems({ adminId, scopeKey }) {
  return inventoryCatalog.flatMap((device) =>
    device.parts.map((part, index) => ({
      name: `${device.brand} ${device.model} · ${part.name}`,
      code: buildSku(device, part, index),
      description: `${device.brand} ${device.model} (${device.series}) · ${part.type || "General"} · ${part.quality}`,
      category: `${device.brand} ${device.series || device.model}`,
      repairType: part.name,
      price: part.sale,
      estimatedHours: inferEstimatedHours(part.name, device.deviceType),
      stock: part.stock ?? 10,
      status: "active",
      visibilityScope: scopeKey,
      assignedUserId: adminId,
      createdById: adminId,
      metadata: {
        seed: true,
        brand: device.brand,
        model: device.model,
        series: device.series,
        deviceType: device.deviceType,
        releaseYear: device.releaseYear,
        partType: part.type || null,
        quality: part.quality,
        costPrice: part.cost,
        salePrice: part.sale,
        supplier: "Importación",
      },
    }))
  );
}

function buildSku(device, part, index) {
  const raw = `${device.brand}-${device.model}-${part.name}-${index + 1}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return raw.slice(0, 80);
}

function inferEstimatedHours(partName, deviceType) {
  const lower = partName.toLowerCase();
  if (lower.includes("pantalla")) return deviceType === "laptop" ? 4 : 2;
  if (lower.includes("bater")) return deviceType === "laptop" ? 3 : 1;
  return 1;
}
