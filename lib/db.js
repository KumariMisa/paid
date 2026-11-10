import postgres from 'postgres';

const globalForDb = globalThis;
export const sql =
  globalForDb.__paidSql ||
  postgres(process.env.DATABASE_URL, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
if (process.env.NODE_ENV !== 'production') globalForDb.__paidSql = sql;
