import { Router } from "express";
import {
  createCustomerSchema,
  createQuoteSchema,
  customerIdSchema,
  getCustomer,
  getCustomers,
  getCustomersSchema,
  getDevices,
  getDevicesSchema,
  getParts,
  getPartsSchema,
  getQuotes,
  getQuotesSchema,
  getStats,
  postCustomer,
  postQuote,
  postSyncInventory,
} from "../controllers/landingController.js";
import { validate } from "../middlewares/validate.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";

const router = Router();

router.get("/devices", validate(getDevicesSchema), getDevices);
router.get("/parts", validate(getPartsSchema), getParts);
router.post("/customers", validate(createCustomerSchema), postCustomer);
router.get("/customers", validate(getCustomersSchema), getCustomers);
router.get("/customers/:customerId", validate(customerIdSchema), getCustomer);
router.post("/quotes", validate(createQuoteSchema), postQuote);
router.get("/quotes", validate(getQuotesSchema), getQuotes);
router.post("/sync/inventory", requireAuth, requireRoles("admin", "manager"), postSyncInventory);
router.get("/stats/dashboard", getStats);

export default router;
