import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";

export let User;
export let InventoryItem;
export let Document;
export let Customer;
export let Quote;
export let Asset;

export function initSqlModels(sequelize) {
  User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("admin", "manager", "technician", "viewer"),
        allowNull: false,
        defaultValue: "viewer",
      },
      scopeKey: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "default",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "users",
      hooks: {
        beforeCreate: async (user) => {
          if (user.passwordHash && !user.passwordHash.startsWith("$2")) {
            user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("passwordHash") && user.passwordHash && !user.passwordHash.startsWith("$2")) {
            user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
          }
        },
      },
      defaultScope: {
        attributes: { exclude: ["passwordHash"] },
      },
      scopes: {
        withPassword: {
          attributes: { include: ["passwordHash"] },
        },
      },
    }
  );

  InventoryItem = sequelize.define(
    "InventoryItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      repairType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      estimatedHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      visibilityScope: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "default",
      },
      googleSheetRowId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "inventory_items",
    }
  );

  Document = sequelize.define(
    "Document",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      summary: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      imageUrls: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      visibility: {
        type: DataTypes.ENUM("public", "private"),
        allowNull: false,
        defaultValue: "private",
      },
    },
    {
      tableName: "documents",
    }
  );

  User.hasMany(InventoryItem, { as: "createdItems", foreignKey: "createdById" });
  User.hasMany(InventoryItem, { as: "assignedItems", foreignKey: "assignedUserId" });
  User.hasMany(Document, { as: "documents", foreignKey: "createdById" });
  InventoryItem.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });
  InventoryItem.belongsTo(User, { as: "assignedUser", foreignKey: "assignedUserId" });
  Document.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });

  Customer = sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      first_name: { type: DataTypes.STRING, allowNull: false },
      last_name: { type: DataTypes.STRING, allowNull: true, defaultValue: "" },
      email: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true, defaultValue: "Miami" },
      device_issue: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "customers" }
  );

  Quote = sequelize.define(
    "Quote",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      brand: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      service: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("pending", "confirmed", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "quotes" }
  );

  Customer.hasMany(Quote, { as: "quotes", foreignKey: "customerId" });
  Quote.belongsTo(Customer, { as: "customer", foreignKey: "customerId" });

  Asset = sequelize.define(
    "Asset",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title:       { type: DataTypes.STRING,  allowNull: false },
      type:        { type: DataTypes.ENUM("image", "video", "text", "script", "landing", "other"), allowNull: false, defaultValue: "other" },
      url:         { type: DataTypes.STRING,  allowNull: true },
      content:     { type: DataTypes.TEXT,    allowNull: true },
      mimeType:    { type: DataTypes.STRING,  allowNull: true },
      fileSize:    { type: DataTypes.INTEGER, allowNull: true },
      tags:        { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] },
      landingPage: { type: DataTypes.STRING,  allowNull: true },
      isPublic:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "assets" }
  );

  User.hasMany(Asset, { as: "assets", foreignKey: "createdById" });
  Asset.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });
}
