import { findInventoryById, listInventoryForUser } from "./memoryStore.js";
import { isMemorySqlMode } from "../config/runtime.js";
import { Customer, Quote } from "../models/sqlModels.js";

// In-memory fallback (used only when SQL is unavailable)
const memState = {
  customers: [],
  quotes: [],
  nextCustomerId: 1,
  nextQuoteId: 1,
};

const SYSTEM_ADMIN = { id: "system", role: "admin", scopeKey: "*" };

export async function listDevices({ brand, search } = {}) {
  const items = await listInventoryForUser(SYSTEM_ADMIN, {});
  const devices = buildDevices(items);

  return devices.filter((device) => {
    if (brand && !device.brand.toLowerCase().includes(String(brand).toLowerCase())) {
      return false;
    }

    if (search) {
      const haystack = `${device.brand} ${device.model} ${device.series || ""}`.toLowerCase();
      return haystack.includes(String(search).toLowerCase());
    }

    return true;
  });
}

export async function listParts({ deviceId, device_id, partName, part_name, quality } = {}) {
  const items = await listInventoryForUser(SYSTEM_ADMIN, {});

  const selectedDeviceId = deviceId || device_id;
  const selectedPartName = partName || part_name;

  return items
    .filter((item) => {
      const id = buildDeviceId(item);
      if (!id) return false; // skip header artefacts
      return !selectedDeviceId || id === String(selectedDeviceId);
    })
    .filter((item) => !selectedPartName || item.repairType.toLowerCase().includes(String(selectedPartName).toLowerCase()))
    .filter((item) => !quality || String(item.metadata?.quality || "").toLowerCase() === String(quality).toLowerCase())
    .map((item) => ({
      id: item.id,
      device_id: buildDeviceId(item),
      part_name: item.repairType,
      part_type: item.metadata?.partType || "General",
      quality: item.metadata?.quality || "General",
      cost_price: Number(item.metadata?.costPrice || 0),
      sale_price: Number(item.price || 0),
      stock_quantity: Number(item.stock || 0),
      supplier: item.metadata?.supplier || "Importación",
      notes: item.description || "",
      brand: item.metadata?.brand || "",
      model: item.metadata?.model || "",
      series: item.metadata?.series || "",
    }));
}

export async function createCustomer(data) {
  if (!isMemorySqlMode()) {
    const customer = await Customer.create({
      first_name: data.first_name,
      last_name: data.last_name || "",
      email: data.email || null,
      phone: data.phone || null,
      city: data.city || "Miami",
      device_issue: data.device_issue || null,
    });
    return customer.toJSON();
  }

  // Memory fallback
  const customer = {
    id: memState.nextCustomerId++,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email || null,
    phone: data.phone,
    city: data.city || null,
    device_issue: data.device_issue || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  memState.customers.unshift(customer);
  return customer;
}

export async function listCustomers({ search, phone } = {}) {
  if (!isMemorySqlMode()) {
    const { Op } = await import("sequelize");
    const where = {};
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (phone) {
      where.phone = { [Op.like]: `%${phone}%` };
    }
    const customers = await Customer.findAll({ where, order: [["createdAt", "DESC"]] });
    return customers.map((c) => c.toJSON());
  }

  return memState.customers.filter((customer) => {
    if (search) {
      const haystack = `${customer.first_name || ""} ${customer.last_name || ""} ${customer.email || ""}`.toLowerCase();
      if (!haystack.includes(String(search).toLowerCase())) return false;
    }
    if (phone && !(customer.phone || "").toLowerCase().includes(String(phone).toLowerCase())) return false;
    return true;
  });
}

export async function getCustomerDetails(customerId) {
  if (!isMemorySqlMode()) {
    const customer = await Customer.findByPk(customerId, {
      include: [{ model: Quote, as: "quotes" }],
    });
    if (!customer) return null;
    const data = customer.toJSON();
    return {
      customer: data,
      quotes: data.quotes || [],
      total_quotes: (data.quotes || []).length,
      total_spent: (data.quotes || [])
        .filter((q) => q.status === "completed")
        .reduce((sum, q) => sum + Number(q.price || 0), 0),
    };
  }

  const customer = memState.customers.find((item) => String(item.id) === String(customerId));
  if (!customer) return null;
  const quotes = memState.quotes.filter((quote) => String(quote.customer_id) === String(customer.id));
  return {
    customer,
    quotes,
    total_quotes: quotes.length,
    total_spent: quotes.filter((q) => q.status === "completed").reduce((sum, q) => sum + Number(q.total_amount || 0), 0),
  };
}

export async function createQuote(data) {
  const customer = await (async () => {
    if (!isMemorySqlMode()) return Customer.findByPk(data.customer_id);
    return memState.customers.find((c) => String(c.id) === String(data.customer_id));
  })();
  if (!customer) throw new Error("Customer not found");

  const devices = await listDevices({});
  const device = devices.find((item) => item.id === String(data.device_id));
  if (!device) throw new Error("Device not found");

  const items = [];
  let total = 0;
  for (const rawItem of data.items || []) {
    const part = await findInventoryById(rawItem.part_id);
    if (!part) throw new Error(`Part ${rawItem.part_id} not found`);
    const quantity = Number(rawItem.quantity || 1);
    const unitPrice = Number(part.price || 0);
    const subtotal = quantity * unitPrice;
    total += subtotal;
    items.push({ part_id: part.id, quantity, unit_price: unitPrice, subtotal, part_name: part.repairType });
  }

  if (!isMemorySqlMode()) {
    const quote = await Quote.create({
      customerId: customer.id,
      brand: device.brand,
      model: device.model,
      service: items.map((i) => i.part_name).join(", ") || "General",
      price: total,
      notes: data.notes || null,
      status: "pending",
    });
    return { quote_id: quote.id, total_amount: total, status: "pending", items, created_at: quote.createdAt };
  }

  const quote = {
    id: memState.nextQuoteId++,
    customer_id: customer.id,
    device_id: device.id,
    status: "pending",
    total_amount: total,
    notes: data.notes || null,
    items,
    created_at: new Date().toISOString(),
  };
  memState.quotes.unshift(quote);
  return { quote_id: quote.id, total_amount: total, status: "pending", items, created_at: quote.created_at };
}

export async function listQuotes({ status, customerId } = {}) {
  if (!isMemorySqlMode()) {
    const { Op } = await import("sequelize");
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    const quotes = await Quote.findAll({ where, order: [["createdAt", "DESC"]] });
    return quotes.map((q) => q.toJSON());
  }

  return memState.quotes.filter((quote) => {
    if (status && quote.status !== status) return false;
    if (customerId && String(quote.customer_id) !== String(customerId)) return false;
    return true;
  });
}

export async function getDashboardStats() {
  const parts = await listParts({});
  const totalInventoryValue = parts.reduce((sum, part) => sum + Number(part.cost_price || 0) * Number(part.stock_quantity || 0), 0);
  const expensiveParts = [...parts].sort((a, b) => Number(b.sale_price || 0) - Number(a.sale_price || 0)).slice(0, 10);

  let total_customers = 0;
  let pending_quotes = 0;
  if (!isMemorySqlMode()) {
    total_customers = await Customer.count();
    pending_quotes = await Quote.count({ where: { status: "pending" } });
  } else {
    total_customers = memState.customers.length;
    pending_quotes = memState.quotes.filter((q) => q.status === "pending").length;
  }

  return {
    total_parts: parts.length,
    total_customers,
    pending_quotes,
    inventory_value: totalInventoryValue,
    expensive_parts: expensiveParts,
    monthly_quotes: [],
  };
}

export function forceInventorySync() {
  return {
    success: 0,
    failed: 0,
    skipped: true,
    message: "La sincronización pública se deja en modo seguro. Usa el panel admin para la sync real con Google Sheets.",
  };
}

function buildDevices(items) {
  const devicesMap = new Map();

  items.forEach((item) => {
    // Skip header-row artefacts (parseDeviceName returns null for them)
    const info = resolveDeviceInfo(item);
    if (!info) return;

    const deviceId = buildDeviceId(item);
    if (!devicesMap.has(deviceId)) {
      devicesMap.set(deviceId, {
        id: deviceId,
        brand:        info.brand,
        model:        info.model,
        series:       info.series,
        type:         info.type,
        release_year: item.metadata?.releaseYear || null,
        parts_count:  0,
      });
    }

    devicesMap.get(deviceId).parts_count += 1;
  });

  return [...devicesMap.values()].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "es"));
}

function buildDeviceId(item) {
  // Google Sheets import: metadata.device is the source-of-truth device name
  if (item.metadata?.source === "google-sheets" && item.metadata?.device) {
    const parsed = parseDeviceName(item.metadata.device);
    if (!parsed) return null;
    return slugify(`${parsed.brand}-${parsed.model}`);
  }

  // Seed catalog items have explicit brand/model/series
  const brand = item.metadata?.brand || item.category || "general";
  const model = item.metadata?.model || item.category || "model";
  const series = item.metadata?.series || "";
  return slugify(`${brand}-${model}${series ? `-${series}` : ""}`);
}

function resolveDeviceInfo(item) {
  // Google Sheets import
  if (item.metadata?.source === "google-sheets" && item.metadata?.device) {
    return parseDeviceName(item.metadata.device); // may be null
  }

  // Seed catalog
  return {
    brand:  item.metadata?.brand      || item.category     || "Unknown",
    model:  item.metadata?.model      || item.name         || "Unknown",
    series: item.metadata?.series     || "",
    type:   item.metadata?.deviceType || "smartphone",
  };
}

/**
 * Parses a device name like "iPhone 14 Pro Max" or "Samsung Galaxy S23"
 * into { brand, model, series, type }.
 * Returns null for header-row artefacts.
 */
function parseDeviceName(device) {
  // Strip leading/trailing noise characters (bold markers, asterisks, etc.)
  const d = String(device || "").trim().replace(/^[\*\#\s]+/, "").trim();

  // Skip obvious header-row artefacts
  if (!d || /^(device|dispositivo|marca|brand|model|parte)$/i.test(d)) return null;

  // ── Apple ──
  if (/^iphone/i.test(d))    return { brand: "Apple", model: d, series: extractSeries(d, "iPhone"),  type: "smartphone" };
  if (/^ipad mini/i.test(d)) return { brand: "Apple", model: d, series: "iPad mini",                 type: "tablet" };
  if (/^ipad air/i.test(d))  return { brand: "Apple", model: d, series: "iPad Air",                  type: "tablet" };
  if (/^ipad pro/i.test(d))  return { brand: "Apple", model: d, series: "iPad Pro",                  type: "tablet" };
  if (/^ipad/i.test(d))      return { brand: "Apple", model: d, series: "iPad",                      type: "tablet" };
  if (/^macbook/i.test(d))   return { brand: "Apple", model: d, series: "MacBook",                   type: "laptop" };
  if (/^imac/i.test(d))      return { brand: "Apple", model: d, series: "iMac",                      type: "desktop" };
  if (/^apple\s/i.test(d))   return { brand: "Apple", model: d.replace(/^apple\s*/i, ""), series: "", type: "smartphone" };

  // ── Samsung ──
  if (/^samsung/i.test(d)) {
    const modelPart = d.replace(/^samsung\s*/i, "");
    const isTablet  = /tab/i.test(d);
    const series    = extractSeries(modelPart, "Galaxy");
    return { brand: "Samsung", model: modelPart || d, series, type: isTablet ? "tablet" : "smartphone" };
  }
  if (/^galaxy/i.test(d)) {
    const isTablet = /tab/i.test(d);
    return { brand: "Samsung", model: d, series: extractSeries(d, "Galaxy"), type: isTablet ? "tablet" : "smartphone" };
  }

  // ── Motorola ──
  if (/^motorola|^moto\b/i.test(d)) return { brand: "Motorola", model: d, series: "Moto", type: "smartphone" };

  // ── Google Pixel / Nexus ──
  if (/^google pixel/i.test(d)) return { brand: "Google Pixel", model: d.replace(/^google\s*/i, ""), series: "Pixel", type: "smartphone" };
  if (/^pixel/i.test(d))        return { brand: "Google Pixel", model: d, series: "Pixel", type: "smartphone" };
  if (/^nexus/i.test(d))        return { brand: "Google Pixel", model: d, series: "Nexus", type: "smartphone" };
  if (/^google/i.test(d))       return { brand: "Google Pixel", model: d.replace(/^google\s*/i, ""), series: "Pixel", type: "smartphone" };

  // ── LG ──
  if (/^lg\b/i.test(d)) return { brand: "LG", model: d.replace(/^lg\s*/i, ""), series: "", type: "smartphone" };

  // ── Huawei ──
  if (/^huawei/i.test(d)) return { brand: "Huawei", model: d.replace(/^huawei\s*/i, ""), series: extractSeries(d.replace(/^huawei\s*/i,""), ""), type: "smartphone" };
  if (/^honor/i.test(d))  return { brand: "Huawei", model: d, series: "Honor", type: "smartphone" };

  // ── Xiaomi ──
  if (/^xiaomi/i.test(d))  return { brand: "Xiaomi", model: d.replace(/^xiaomi\s*/i, ""), series: "", type: "smartphone" };
  if (/^redmi/i.test(d))   return { brand: "Xiaomi", model: d, series: "Redmi",  type: "smartphone" };
  if (/^poco\b/i.test(d))  return { brand: "Xiaomi", model: d, series: "Poco",   type: "smartphone" };
  if (/^mi\s/i.test(d))    return { brand: "Xiaomi", model: d, series: "Mi",     type: "smartphone" };

  // ── Generic: first word = brand ──
  const words = d.split(/\s+/);
  return { brand: words[0] || "Other", model: words.slice(1).join(" ") || d, series: "", type: "smartphone" };
}

function extractSeries(name, prefix) {
  // e.g. "iPhone 14 Pro Max" → "iPhone 14"  |  "Galaxy S23 Ultra" → "Galaxy S23"
  const words = String(name).split(/\s+/);
  const match = words.slice(0, 3).join(" ");
  return match || prefix;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function aggregateMonthlyQuotes(quotes) {
  const map = new Map();

  quotes.forEach((quote) => {
    const month = String(quote.created_at).slice(0, 7);
    const current = map.get(month) || { month, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(quote.total_amount || 0);
    map.set(month, current);
  });

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}
