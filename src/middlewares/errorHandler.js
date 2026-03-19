import { ZodError } from "zod";

export function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: error.flatten(),
    });
  }

  return res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error",
    details: error.details,
  });
}
