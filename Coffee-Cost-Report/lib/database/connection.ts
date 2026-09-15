import "server-only";

import mysql, { type Pool } from "mysql2/promise";

/** "DB" = ฐาน MB51 ของแอป, "CPR_ONE_DB" = ฐาน cpr_one (ตรวจ session ของผู้ใช้) */
type EnvPrefix = "DB" | "CPR_ONE_DB";

const pools: Partial<Record<EnvPrefix, Pool>> = {};

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required database environment variable: ${name}`);
    }
    return value;
}

function createPool(prefix: EnvPrefix): Pool {
    const port = Number(process.env[`${prefix}_PORT`] ?? "3306");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${prefix}_PORT must be an integer between 1 and 65535`);
    }

    return mysql.createPool({
        host: requiredEnv(`${prefix}_HOST`),
        port,
        database: requiredEnv(`${prefix}_NAME`),
        user: requiredEnv(`${prefix}_USER`),
        password: requiredEnv(`${prefix}_PASSWORD`),
        waitForConnections: true,
        connectionLimit: Number(process.env[`${prefix}_CONNECTION_LIMIT`] ?? "10"),
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: process.env[`${prefix}_SSL`] === "true" ? {} : undefined,
    });
}

function getPool(prefix: EnvPrefix): Pool {
    return (pools[prefix] ??= createPool(prefix));
}

export function getDbPool(): Pool {
    return getPool("DB");
}

export function getCprOneDbPool(): Pool {
    return getPool("CPR_ONE_DB");
}

export async function closeDbPool(): Promise<void> {
    for (const prefix of Object.keys(pools) as EnvPrefix[]) {
        await pools[prefix]?.end();
        delete pools[prefix];
    }
}
