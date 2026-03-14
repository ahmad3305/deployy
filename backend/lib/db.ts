import mysql from 'mysql2/promise';

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'hellokitty',
  database: process.env.DB_NAME || 'Jahhaazz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

export default pool;

// Helper function to execute queries
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

// Helper function to execute queries that return a single row
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const [results] = await pool.execute(sql, params);
  const rows = results as T[];
  return rows.length > 0 ? rows[0] : null;
}

// Get connection for transactions
export async function getConnection() {
  return await pool.getConnection();
}


// Run queries safely inside a transaction
export async function withTransaction<T>(
  fn: (connection: import('mysql2/promise').PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors (rare, but possible)
    }
    throw err;
  } finally {
    connection.release();
  }
}