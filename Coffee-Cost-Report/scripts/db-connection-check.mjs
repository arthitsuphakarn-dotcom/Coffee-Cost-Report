import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

function loadEnvFile(contents) {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let pool;

try {
  await loadEnvFile(await readFile(".env", "utf8"));

  const port = Number(process.env.DB_PORT ?? "3306");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535");
  }

  pool = mysql.createPool({
    host: requiredEnv("DB_HOST"),
    port,
    database: requiredEnv("DB_NAME"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    connectionLimit: 1,
    connectTimeout: 10000,
    ssl: process.env.DB_SSL === "true" ? {} : undefined,
  });

  const [rows] = await pool.query("SELECT 1 AS connection_ok");
  const connectionOk = rows[0]?.connection_ok === 1;

  console.log(`[DB] ${connectionOk ? "CONNECTED" : "FAILED"}`);
  console.log(`[DB] Host: ${process.env.DB_HOST}`);
  console.log(`[DB] Port: ${port}`);
  console.log(`[DB] Database: ${process.env.DB_NAME}`);
  console.log(`[DB] SELECT 1: ${connectionOk ? "OK" : "FAILED"}`);

  if (!connectionOk) process.exitCode = 1;
} catch (error) {
  console.error("[DB] FAILED");
  console.error(`[DB] ${error instanceof Error ? error.message : "Unknown connection error"}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
