import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set. Add it to .env.local.");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

  const sql = readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
  console.log("Migration applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
