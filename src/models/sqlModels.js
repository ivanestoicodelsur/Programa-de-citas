import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";

export let User;
export let InventoryItem;
export let Document;
export let Customer;
export let Quote;
export let Asset;
export let Purchase;
export let Lead;
export let LeadActivity;
export let Ebook;
export let DailyMessage;
export let UserDailyProgress;

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

  // --- Purchases: qué libro/pack compró cada usuario --------------------
  Purchase = sequelize.define(
    "Purchase",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      bookSlug:        { type: DataTypes.STRING,  allowNull: false },
      source:          { type: DataTypes.ENUM("stripe", "admin_grant", "promo", "gift"), allowNull: false, defaultValue: "stripe" },
      externalId:      { type: DataTypes.STRING,  allowNull: true },
      amountCents:     { type: DataTypes.INTEGER, allowNull: true },
      currency:        { type: DataTypes.STRING,  allowNull: true, defaultValue: "USD" },
      isActive:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      downloadCount:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastDownloadAt:  { type: DataTypes.DATE,    allowNull: true },
    },
    {
      tableName: "purchases",
      indexes: [
        { fields: ["userId", "bookSlug"] },
        { fields: ["bookSlug"] },
      ],
    }
  );

  User.hasMany(Purchase, { as: "purchases", foreignKey: "userId" });
  Purchase.belongsTo(User, { as: "user", foreignKey: "userId" });

  // =================================================================
  // LEADS — Tabla unificada de contactos con discriminador de origen
  // =================================================================
  Lead = sequelize.define(
    "Lead",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email:       { type: DataTypes.STRING, allowNull: true,  validate: { isEmail: true } },
      phone:       { type: DataTypes.STRING, allowNull: true },
      firstName:   { type: DataTypes.STRING, allowNull: true },
      lastName:    { type: DataTypes.STRING, allowNull: true },
      city:        { type: DataTypes.STRING, allowNull: true },
      source: {
        type: DataTypes.ENUM(
          "repair",
          "newsletter-mindset",
          "newsletter-perfil",
          "newsletter-cv",
          "newsletter-biblioteca",
          "newsletter-otro",
          "community-signup",
          "community-login",
          "book-purchase",
          "checkout-started",
          "livechat",
          "contact-form",
          "import-manual",
          "referral",
          "other"
        ),
        allowNull: false,
      },
      channel: {
        type: DataTypes.ENUM("gofix", "mindsetbuilder", "politicast", "biblioteca", "otro"),
        allowNull: false,
        defaultValue: "mindsetbuilder",
      },
      status: {
        type: DataTypes.ENUM("new", "contacted", "qualified", "customer", "lost", "unsubscribed"),
        allowNull: false,
        defaultValue: "new",
      },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      tags:     { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      notes:    { type: DataTypes.TEXT,  allowNull: true },
      utmSource:   { type: DataTypes.STRING, allowNull: true },
      utmMedium:   { type: DataTypes.STRING, allowNull: true },
      utmCampaign: { type: DataTypes.STRING, allowNull: true },
      utmContent:  { type: DataTypes.STRING, allowNull: true },
      referrer:    { type: DataTypes.STRING, allowNull: true },
      landingPath: { type: DataTypes.STRING, allowNull: true },
      hasPurchased:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      totalPurchaseCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      firstContactAt:     { type: DataTypes.DATE,    allowNull: true },
      lastContactAt:      { type: DataTypes.DATE,    allowNull: true },
    },
    {
      tableName: "leads",
      indexes: [
        { fields: ["email"] },
        { fields: ["phone"] },
        { fields: ["source"] },
        { fields: ["channel"] },
        { fields: ["status"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  LeadActivity = sequelize.define(
    "LeadActivity",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM(
          "captured", "newsletter_signup", "community_login",
          "purchase", "download", "contact", "note", "status_change",
          "email_sent", "unsubscribe"
        ),
        allowNull: false,
      },
      source:   { type: DataTypes.STRING, allowNull: true },
      metadata: { type: DataTypes.JSONB,  allowNull: false, defaultValue: {} },
      createdById: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "lead_activities",
      indexes: [{ fields: ["leadId"] }, { fields: ["type"] }],
    }
  );

  Lead.hasMany(LeadActivity, { as: "activities", foreignKey: "leadId", onDelete: "CASCADE" });
  LeadActivity.belongsTo(Lead, { as: "lead", foreignKey: "leadId" });

  // =================================================================
  // EBOOKS — PDFs como BLOB dentro de la DB. Sobreviven a rebuilds.
  // =================================================================
  Ebook = sequelize.define(
    "Ebook",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug:        { type: DataTypes.STRING, allowNull: false, unique: true },
      title:       { type: DataTypes.STRING, allowNull: false },
      mimeType:    { type: DataTypes.STRING, allowNull: false, defaultValue: "application/pdf" },
      fileName:    { type: DataTypes.STRING, allowNull: false },
      fileSize:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      fileData:    { type: DataTypes.BLOB("long"), allowNull: false },
      sha256:      { type: DataTypes.STRING, allowNull: true },
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata:    { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "ebooks",
      indexes: [{ fields: ["slug"] }],
      defaultScope: {
        attributes: { exclude: ["fileData"] },
      },
      scopes: {
        withFile: { attributes: { include: ["fileData"] } },
      },
    }
  );

  // =================================================================
  // DAILY MESSAGES — párrafos extraídos de los 7 libros, uno por día.
  // Orden = secuencia motivacional hacia la autonomía general, integral,
  // vivencial y existencial. `dayNumber` es la posición global.
  // =================================================================
  DailyMessage = sequelize.define(
    "DailyMessage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dayNumber: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      bookSlug:  { type: DataTypes.STRING,  allowNull: false },
      title:     { type: DataTypes.STRING,  allowNull: true },
      body:      { type: DataTypes.TEXT,    allowNull: false },
      wordCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      metadata:  { type: DataTypes.JSONB,   allowNull: false, defaultValue: {} },
    },
    {
      tableName: "daily_messages",
      indexes: [{ fields: ["dayNumber"] }, { fields: ["bookSlug"] }],
    }
  );

  UserDailyProgress = sequelize.define(
    "UserDailyProgress",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      currentDay:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      startedAt:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
      lastReadAt:     { type: DataTypes.DATE,    allowNull: true },
      lastReadDay:    { type: DataTypes.INTEGER, allowNull: true },
      streakDays:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      emailOptIn:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "user_daily_progress",
      indexes: [{ fields: ["userId"], unique: true }],
    }
  );

  User.hasOne(UserDailyProgress, { as: "dailyProgress", foreignKey: "userId" });
  UserDailyProgress.belongsTo(User, { as: "user", foreignKey: "userId" });
}
