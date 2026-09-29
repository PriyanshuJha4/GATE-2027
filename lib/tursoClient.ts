import { createClient, Client } from "@libsql/client";

let tursoInstance: Client | null = null;

export function getTursoClient(): Client {
  if (!tursoInstance) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error("Turso credentials missing in environment variables.");
    }

    tursoInstance = createClient({
      url,
      authToken,
    });
  }
  return tursoInstance;
}