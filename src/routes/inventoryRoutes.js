import { Router } from "express";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItem,
  idParamSchema,
  inventoryCreateSchema,
  inventoryListSchema,
  inventoryUpdateSchema,
  listInventory,
  updateInventoryItem,
} from "../controllers/inventoryController.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.use(requireAuth);
router.get("/", validate(inventoryListSchema), listInventory);
router.get("/:id", validate(idParamSchema), getInventoryItem);
router.post("/", requireRoles("admin", "manager"), validate(inventoryCreateSchema), createInventoryItem);
router.put("/:id", requireRoles("admin", "manager"), validate(inventoryUpdateSchema), updateInventoryItem);
router.delete("/:id", requireRoles("admin", "manager"), validate(idParamSchema), deleteInventoryItem);

export default router;
