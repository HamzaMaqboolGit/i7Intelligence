import mysql from "mysql2/promise";
const globalDB = globalThis as unknown as { royalPool?: mysql.Pool };
export function getPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (globalDB.royalPool ??= mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 20,
    connectTimeout: 5000,
  }));
}
