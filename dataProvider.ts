
import { DataProvider, LogicalFilter } from "@refinedev/core";
import { execQuery, getTableColumns } from "./sqlDatabase";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

export const sqlDataProvider: DataProvider = {
  getList: async ({ resource, filters, sorters, pagination }) => {
    let baseWhere = "";
    const params: any[] = [];
    const safeResource = quote(resource);

    if (filters && filters.length > 0) {
      const whereClauses: string[] = [];
      for (const filter of filters) {
        if ("field" in filter && "operator" in filter) {
          const { field, value } = filter as LogicalFilter;

          if (field === "q" && value) {
            const tableCols = await getTableColumns(resource);
            const searchableCols = tableCols
              .filter(col => {
                const type = col.type.toUpperCase();
                return type.includes('TEXT') || type.includes('CHAR') || type.includes('CLOB');
              })
              .map(col => col.name);
            
            if (searchableCols.length > 0) {
              const searchClauses = searchableCols.map(col => `${quote(col)} LIKE ?`).join(" OR ");
              whereClauses.push(`(${searchClauses})`);
              searchableCols.forEach(() => params.push(`%${value}%`));
            }
          }
        }
      }
      if (whereClauses.length > 0) {
        baseWhere = ` WHERE ${whereClauses.join(" AND ")}`;
      }
    }

    const countQuery = `SELECT COUNT(*) as total FROM ${safeResource}${baseWhere}`;
    const countResult = await execQuery(countQuery, params);
    // The worker might return {count: X} or total: X depending on naming
    const total = countResult[0]?.total || countResult[0]?.count || countResult[0]?.['COUNT(*)'] || 0;

    let orderClause = "";
    if (sorters && sorters.length > 0) {
      const sortParts = sorters.map(s => `${quote(s.field)} ${s.order.toUpperCase()}`);
      orderClause = ` ORDER BY ${sortParts.join(", ")}`;
    } else {
      orderClause = ` ORDER BY id DESC`;
    }

    let limitClause = "";
    if (pagination) {
      const currentPage = (pagination as any).currentPage || 1;
      const pageSize = pagination.pageSize || 10;
      const offset = (currentPage - 1) * pageSize;
      limitClause = ` LIMIT ${pageSize} OFFSET ${offset}`;
    }

    const finalQuery = `SELECT * FROM ${safeResource}${baseWhere}${orderClause}${limitClause}`;
    const data = await execQuery(finalQuery, params);
    
    return {
      data,
      total,
    };
  },

  getOne: async ({ resource, id }) => {
    const safeResource = quote(resource);
    const data = await execQuery(`SELECT * FROM ${safeResource} WHERE id = ?`, [id]);
    if (data.length === 0) {
      throw new Error(`Record with id ${id} not found in ${resource}`);
    }
    return {
      data: data[0],
    };
  },

  create: async ({ resource, variables }) => {
    const safeResource = quote(resource);
    const keys = Object.keys(variables);
    const cols = keys.map(c => quote(c)).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const vals = Object.values(variables);

    await execQuery(`INSERT INTO ${safeResource} (${cols}) VALUES (${placeholders})`, vals);
    const result = await execQuery(`SELECT * FROM ${safeResource} ORDER BY id DESC LIMIT 1`);
    return { data: result[0] };
  },

  update: async ({ resource, id, variables }) => {
    const safeResource = quote(resource);
    const keys = Object.keys(variables);
    const setClause = keys.map((key) => `${quote(key)} = ?`).join(", ");
    const vals = [...Object.values(variables), id];

    await execQuery(`UPDATE ${safeResource} SET ${setClause} WHERE id = ?`, vals);
    const result = await execQuery(`SELECT * FROM ${safeResource} WHERE id = ?`, [id]);
    return { data: result[0] };
  },

  deleteOne: async ({ resource, id }) => {
    const safeResource = quote(resource);
    await execQuery(`DELETE FROM ${safeResource} WHERE id = ?`, [id]);
    return { data: { id } as any };
  },

  deleteMany: async ({ resource, ids }) => {
    const safeResource = quote(resource);
    const placeholders = ids.map(() => "?").join(", ");
    await execQuery(`DELETE FROM ${safeResource} WHERE id IN (${placeholders})`, ids);
    return { data: ids.map(id => ({ id })) as any };
  },

  getApiUrl: () => "",
};
