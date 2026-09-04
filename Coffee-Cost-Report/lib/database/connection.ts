import "server-only";

import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | undefined;

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required database environment variable: ${name}`);
    }
    return value;
}

function createPool(): Pool {
    const port = Number(process.env.DB_PORT ?? "3306");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("DB_PORT must be an integer between 1 and 65535");
    }

    return mysql.createPool({
        host: requiredEnv("DB_HOST"),
        port,
        database: requiredEnv("DB_NAME"),
        user: requiredEnv("DB_USER"),
        password: requiredEnv("DB_PASSWORD"),
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? "10"),
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: process.env.DB_SSL === "true" ? {} : undefined,
    });
}

export function getDbPool(): Pool {
    if (!pool) {
        pool = createPool();
    }
    return pool;
}

export async function closeDbPool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = undefined;
    }
}
