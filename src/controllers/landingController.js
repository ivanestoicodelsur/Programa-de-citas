import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import {
  createCustomer,
  createQuote,
  forceInventorySync,
  getCustomerDetails,
  getDashboardStats,
  listCustomers,
  listDevices,
  listParts,
  listQuotes,
} from "../services/landingService.js";

export const getDevicesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    brand: z.string().optional(),
    search: z.string().optional(),
  }).default({}),
});

export const getPartsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    device_id: z.string().optional(),
    part_name: z.string().optional(),
    quality: z.string().optional(),
  }).default({}),
});

export const createCustomerSchema = z.object({
  body: z.object({
    first_name: z.string().min(1),
    last_name: z.string().optional().default(""),
    email: z.string().email().optional().or(z.literal("")).transform((value) => value || undefined),
    phone: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    device_model: z.string().optional(),
    device_issue: z.string().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const getCustomersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    search: z.string().optional(),
    phone: z.string().optional(),
  }).default({}),
});

export const customerIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({ customerId: z.coerce.number().int().positive() }),
  query: z.object({}).default({}),
});

export const createQuoteSchema = z.object({
  body: z.object({
    customer_id: z.coerce.number().int().positive(),
    device_id: z.string().min(1),
    items: z.array(z.object({
      part_id: z.string().min(1),
      quantity: z.coerce.number().int().positive().default(1),
    })).min(1),
    notes: z.string().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const getQuotesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    status: z.string().optional(),
    customer_id: z.coerce.number().int().positive().optional(),
  }).default({}),
});

export async function getDevices(req, res, next) {
  try {
    const devices = await listDevices(req.query);
    res.json(devices);
  } catch (error) {
    next(error);
  }
}

export async function getParts(req, res, next) {
  try {
    const parts = await listParts(req.query);
    res.json(parts);
  } catch (error) {
    next(error);
  }
}

export async function postCustomer(req, res, next) {
  try {
    const customer = await createCustomer(req.body);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
}

export async function getCustomers(req, res, next) {
  try {
    res.json(await listCustomers(req.query));
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(req, res, next) {
  try {
    const details = getCustomerDetails(req.params.customerId);
    if (!details) {
      throw new ApiError(404, "Customer not found");
    }
    res.json(details);
  } catch (error) {
    next(error);
  }
}

export async function postQuote(req, res, next) {
  try {
    const result = await createQuote(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getQuotes(req, res, next) {
  try {
    res.json(listQuotes({ status: req.query.status, customerId: req.query.customer_id }));
  } catch (error) {
    next(error);
  }
}

export async function postSyncInventory(_req, res, next) {
  try {
    res.json(forceInventorySync());
  } catch (error) {
    next(error);
  }
}

export async function getStats(_req, res, next) {
  try {
    res.json(await getDashboardStats());
  } catch (error) {
    next(error);
  }
}
