import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String },
    actorEmail: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
