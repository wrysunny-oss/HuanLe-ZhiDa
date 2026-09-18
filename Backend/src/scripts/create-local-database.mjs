import "dotenv/config";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const connection = new URL(databaseUrl);
const databaseName = decodeURIComponent(connection.pathname.slice(1));
if (databaseName !== "huanle_zhida") {
  throw new Error(`Refusing to create unexpected database: ${databaseName}`);
}

const mysqlExecutable =
  process.platform === "win32"
    ? "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"
    : "mysql";
const sql =
  "CREATE DATABASE IF NOT EXISTS `huanle_zhida` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
const result = spawnSync(
  mysqlExecutable,
  [
    "--host",
    connection.hostname,
    "--port",
    connection.port || "3306",
    "--user",
    decodeURIComponent(connection.username),
    "--execute",
    sql,
  ],
  {
    env: {
      ...process.env,
      MYSQL_PWD: decodeURIComponent(connection.password),
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
