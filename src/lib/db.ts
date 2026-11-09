import mysql, {
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

const globalDb = globalThis as unknown as { mysqlPool?: mysql.Pool };
export function database() {
  if (!globalDb.mysqlPool) {
    globalDb.mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "campus_app",
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || "campus_lost_found",
      connectionLimit: 5,
      dateStrings: true,
      multipleStatements: false,
    });
  }
  return globalDb.mysqlPool;
}

// Values are bound separately from SQL, preventing SQL injection.
type SqlValue = string | number | null | Buffer;
export async function rows<T>(
  sql: string,
  values: SqlValue[] = [],
): Promise<T[]> {
  const [result] = await database().execute<RowDataPacket[]>(sql, values);
  return result as T[];
}
export async function execute(sql: string, values: SqlValue[] = []) {
  const [result] = await database().execute<ResultSetHeader>(sql, values);
  return result;
}
