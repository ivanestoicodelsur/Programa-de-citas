import { Router } from "express";
import {
  createDocument,
  createDocumentSchema,
  deleteDocument,
  documentIdSchema,
  getDocument,
  listDocuments,
  listDocumentsSchema,
  updateDocument,
  updateDocumentSchema,
} from "../controllers/documentController.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.use(requireAuth);
router.get("/", validate(listDocumentsSchema), listDocuments);
router.get("/:id", validate(documentIdSchema), getDocument);
router.post("/", validate(createDocumentSchema), createDocument);
router.put("/:id", validate(updateDocumentSchema), updateDocument);
router.delete("/:id", validate(documentIdSchema), deleteDocument);

export default router;
