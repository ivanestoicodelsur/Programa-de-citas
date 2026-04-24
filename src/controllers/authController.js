import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { createAuditLog } from "../services/auditService.js";
import { createUser, findUserByEmail, listUsersForRequester } from "../services/memoryStore.js";
import { ApiError } from "../utils/ApiError.js";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["admin", "manager", "technician", "viewer"]).default("viewer"),
    scopeKey: z.string().min(2).default("default"),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

export async function register(req, res, next) {
  try {
    const existing = await findUserByEmail(req.body.email, { includePassword: true });
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }

    const user = await createUser({
      name: req.body.name,
      email: req.body.email,
      passwordHash: req.body.password,
      role: req.body.role,
      scopeKey: req.body.scopeKey,
    });

    await createAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "create",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const user = await findUserByEmail(req.body.email, { includePassword: true });
    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid credentials");
    }

    const isValid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        scopeKey: user.scopeKey,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    await createAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "login",
      entityType: "auth",
      entityId: user.id,
      metadata: { role: user.role },
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        scopeKey: user.scopeKey,
      },
    });
  } catch (error) {
    next(error);
  }
}

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

/* Registro público — portal gofixlibros.
 * Crea User con role="viewer" y devuelve el JWT de una vez. */
export async function signup(req, res, next) {
  try {
    const existing = await findUserByEmail(req.body.email, { includePassword: true });
    if (existing) {
      throw new ApiError(409, "Ya existe una cuenta con ese correo.");
    }

    const user = await createUser({
      name: req.body.name,
      email: req.body.email,
      passwordHash: req.body.password,
      role: "viewer",
      scopeKey: "gofixlibros",
    });

    const token = jwt.sign(
      { sub: user.id, role: user.role, scopeKey: user.scopeKey },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    await createAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "signup",
      entityType: "user",
      entityId: user.id,
      metadata: { source: "gofixlibros-portal" },
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        scopeKey: user.scopeKey,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function listUsers(req, res, next) {
  try {
    const users = await listUsersForRequester(req.user);

    res.json({ users });
  } catch (error) {
    next(error);
  }
}
