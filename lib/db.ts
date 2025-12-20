import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from "pg";

let pool: Pool | null = null;
let initialized = false;

const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured.");
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
    });
  }

  return pool;
};

const initSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions
  ALTER COLUMN expires_at DROP NOT NULL;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  date DATE NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  payment_source TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  unit_price DOUBLE PRECISION NOT NULL,
  regular_price DOUBLE PRECISION,
  total DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT
);

ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE receipts
SET updated_at = COALESCE(updated_at, created_at);
`;

export const initDb = async () => {
  if (initialized) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(initSql);
    initialized = true;
  } finally {
    client.release();
  }
};

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  await initDb();
  return getPool().query<T>(text, params);
};

export const withTransaction = async <T>(
  handler: (client: PoolClient) => Promise<T>
): Promise<T> => {
  await initDb();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
