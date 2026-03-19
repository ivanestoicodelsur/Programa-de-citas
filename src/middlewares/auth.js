import jwt from "jsonwebtoken";
import { findUserById } from "../services/memoryStore.js";
import { ApiError } from "../utils/ApiError.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(401, "Authentication token missing");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(payload.sub);

    if (!user || !user.isActive) {
      throw new ApiError(401, "User is not authorized");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You are not allowed to access this resource"));
    }

    next();
  };
}
