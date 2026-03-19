import mongoose from "mongoose";

export async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
  console.log("MongoDB connected");
}
