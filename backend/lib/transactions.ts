import { PoolConnection } from 'mysql2/promise';
import { getConnection } from './db';

// Execute operations within a transaction
export async function executeTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  
  try {
    // Begin transaction
    await connection.beginTransaction();
    console.log('🔄 Transaction started');
    
    // Execute the callback with the connection
    const result = await callback(connection);
    
    // Commit transaction
    await connection.commit();
    console.log('✅ Transaction committed');
    
    return result;
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    console.error('❌ Transaction rolled back:', error);
    throw error;
  } finally {
    // Always release connection back to pool
    connection.release();
  }
}

// Helper for executing queries within a transaction connection
export async function transactionQuery<T = any>(
  connection: PoolConnection,
  sql: string,
  params?: any[]
): Promise<T> {
  const [results] = await connection.execute(sql, params);
  return results as T;
}

// Helper for executing single-row queries within a transaction
export async function transactionQueryOne<T = any>(
  connection: PoolConnection,
  sql: string,
  params?: any[]
): Promise<T | null> {
  const [results] = await connection.execute(sql, params);
  const rows = results as T[];
  return rows.length > 0 ? rows[0] : null;
}