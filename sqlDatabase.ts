
const API_BASE = "https://personal-mcp-database.me8468.workers.dev/TIPANDTOES_DB";
const API_URL = `${API_BASE}/execute`;
const UPLOAD_URL = `${API_BASE}/upload`;

/**
 * Core function to execute queries against the remote D1 database
 */
export const remoteExecute = async (sql: string, params: any[] = []): Promise<any[]> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DB Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Robustly handle different potential response formats from the worker
    // Some workers return the array directly, others wrap it in a 'results' or 'data' key
    let finalData: any[] = [];
    if (Array.isArray(data)) {
      finalData = data;
    } else if (data && typeof data === 'object') {
      finalData = data.results || data.data || (data.rows ? data.rows : []);
      // If it's an object but doesn't have a known array key, and isn't null, 
      // check if it's a single object result (uncommon for execute but possible)
      if (!Array.isArray(finalData) && Object.keys(data).length > 0) {
        finalData = [data];
      }
    }

    return finalData;
  } catch (err) {
    console.error("[REMOTE SQL ERROR]", err);
    throw err;
  }
};

export const initDatabase = async () => {
  // Test connectivity without creating default tables
  await remoteExecute("SELECT 1");
  return true;
};

// Aliases for compatibility with existing components
export const execQuery = remoteExecute;
export const runQuery = remoteExecute;

export interface ColumnMetadata {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export const getTableColumns = async (tableName: string): Promise<ColumnMetadata[]> => {
  const sql = `PRAGMA table_info("${tableName.replace(/"/g, '""')}")`;
  const result = await remoteExecute(sql);
  return result as ColumnMetadata[];
};

export const getTableNames = async (): Promise<string[]> => {
  const sql = `SELECT name FROM sqlite_master WHERE type="table" AND name NOT LIKE "sqlite_%" AND name NOT LIKE "_cf_%"`;
  const results = await remoteExecute(sql);
  // Guard against results not being an array if remoteExecute unwrap failed
  if (!Array.isArray(results)) {
    console.error("getTableNames: results is not an array", results);
    return [];
  }
  return results.map((t: any) => t.name);
};

export const dropTable = async (tableName: string) => {
  const sql = `DROP TABLE IF EXISTS "${tableName.replace(/"/g, '""')}"`;
  await remoteExecute(sql);
};

export const createTable = async (tableName: string, columns: { name: string, type: string }[]) => {
  const processedCols = columns.map(c => {
    const cleanName = c.name.trim().toLowerCase();
    if (cleanName === 'id') return { ...c, name: 'original_id' };
    return c;
  });
  
  const colDefs = processedCols.map(c => `"${c.name.replace(/"/g, '""')}" ${c.type}`).join(', ');
  const sql = `CREATE TABLE "${tableName.replace(/"/g, '""')}" (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`;
  await remoteExecute(sql);
};

export const createTableFromCSV = async (tableName: string, headers: string[], rows: any[]) => {
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;

  const processedHeaders = headers.map(h => {
    const clean = h.trim().toLowerCase();
    if (clean === 'id') return 'id_original';
    return h.trim();
  });

  const safeHeaderNames = processedHeaders.map(h => `"${h.replace(/"/g, '""')}"`);
  const colDefs = safeHeaderNames.map(h => `${h} TEXT`).join(', ');

  const createQuery = `CREATE TABLE ${safeTableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`;
  await remoteExecute(createQuery);

  for (const row of rows) {
    const placeholders = headers.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO ${safeTableName} (${safeHeaderNames.join(', ')}) VALUES (${placeholders})`;
    const vals = headers.map(h => row[h]);
    await remoteExecute(insertQuery, vals);
  }
};

export interface UploadCSVResponse {
  success: boolean;
  table: string;
  mode: string;
  columns: string[];
  rows_inserted: number;
}

/**
 * Upload CSV file to create or append to a table
 */
export const uploadCSV = async (
  file: File,
  tableName: string,
  mode: 'create' | 'append' = 'append'
): Promise<UploadCSVResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('table', tableName);
  formData.append('mode', mode);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  return response.json();
};
