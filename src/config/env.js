import dotenv from "dotenv";
import { fileURLToPath } from "url";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
dotenv.config({ path: envPath });
