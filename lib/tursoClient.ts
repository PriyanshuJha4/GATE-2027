import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.warn("Turso credentials missing in environment variables.");
}

export const turso = createClient({
  url: url || "",
  authToken: authToken || "",
});