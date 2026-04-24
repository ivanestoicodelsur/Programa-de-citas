import { Router } from "express";
import { listUsers, login, loginSchema, me, register, registerSchema, signup, signupSchema } from "../controllers/authController.js";
import { requireAuth, requireRoles } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/register-public", validate(signupSchema), signup);   // alias usado por el Frontend React
router.post("/login", validate(loginSchema), login);
router.post("/login-public", validate(loginSchema), login);        // alias usado por el Frontend React
router.get("/me", requireAuth, me);
router.get("/users", requireAuth, requireRoles("admin", "manager"), listUsers);
router.post("/register", requireAuth, requireRoles("admin"), validate(registerSchema), register);

export default router;
