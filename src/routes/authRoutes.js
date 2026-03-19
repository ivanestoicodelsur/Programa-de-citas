import { Router } from "express";
import { listUsers, login, loginSchema, me, register, registerSchema } from "../controllers/authController.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, me);
router.get("/users", requireAuth, requireRoles("admin", "manager"), listUsers);
router.post("/register", requireAuth, requireRoles("admin"), validate(registerSchema), register);

export default router;
