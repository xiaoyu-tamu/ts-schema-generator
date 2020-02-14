import {
  Column,
  ColumnDefinition,
  DefaultTsType,
  Explorer,
  ExplorerOptions,
  Schema,
  Table,
  TableDefinition,
  View,
  ViewDefinition
} from "@ts-schema-generator/types";
import { createPool, DatabasePoolType, NotFoundError, sql } from "slonik";
import { createInterceptors } from "slonik-interceptor-preset";
import { splitTableOrViewName } from "./utils";

export class PostgresExplorer implements Explorer {
  private readonly schema: Schema = "public" as Schema;
  private readonly types: Record<string, string> = {};
  public readonly pool: DatabasePoolType;

  constructor(uriOrPool: string, options: ExplorerOptions = {}) {
    this.pool = createPool(uriOrPool, { interceptors: [...createInterceptors()] });
    if (options.types) this.types = options.types;
    if (options.schema) this.schema = options.schema;
  }

  public async getEnumValues(
    schema: Schema,
    table: Table,
    options: { key: string; value: string }
  ): Promise<Record<string, string | number>[]> {
    const query = sql`
      SELECT ${sql.identifier([options.key])},
             ${sql.identifier([options.value])}
        FROM ${sql.identifier([schema, table])}`;
    try {
      const values = await this.pool.many(query);
      return values;
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  public async getViewDefinitions(views?: View[]): Promise<ViewDefinition[]> {
    try {
      const viewsWithComment = await this.getViewsOrTables("view", views);

      return Promise.all(
        viewsWithComment.map(async view => {
          return {
            type: "view" as const,
            schema: view.schema,
            name: view.name,
            comment: view.comment,
            columns: await this.getColumnDefinitions(`${view.schema}.${view.name}` as View)
          };
        })
      );
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  public async getTableDefinitions(tables?: Table[]): Promise<TableDefinition[]> {
    try {
      const tablesWithComment = await this.getViewsOrTables("table", tables);
      return Promise.all(
        tablesWithComment.map(async table => {
          return {
            type: "table" as const,
            schema: table.schema,
            name: table.name,
            comment: table.comment,
            columns: await this.getColumnDefinitions(`${table.schema}.${table.name}` as Table)
          };
        })
      );
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  protected async getColumnDefinitions(tableOrView: Table | View): Promise<ColumnDefinition[]> {
    const [schemaName = this.schema, tableOrViewName] = splitTableOrViewName(tableOrView);

    try {
      const query = sql`
        WITH primary_columns AS (
          SELECT 
                ordinal_position AS position,
                kcu.table_name,
                kcu.column_name  AS key_column
          FROM information_schema.table_constraints tc
              LEFT JOIN information_schema.key_column_usage kcu
                        ON kcu.constraint_name = tc.constraint_name AND
                            kcu.constraint_schema = tc.constraint_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = ${schemaName}
            AND tc.table_name = ${tableOrViewName}
          ORDER BY
                kcu.table_schema,
                kcu.table_name,
                position
        )

        SELECT
          column_name                                                              AS name,
          udt_name                                                                 AS pg_type,
          col_description(
            (${tableOrView})::regclass::oid, ordinal_position)      AS comment,
          is_nullable = 'YES'                                                      AS is_nullable,
          (SELECT key_column
            FROM primary_columns
            WHERE key_column = column_name
              AND primary_columns.table_name = columns.table_name) IS NOT NULL     AS is_primary,
          ordinal_position                                                         AS position,
          column_default IS NOT NULL                                               AS has_default
        FROM information_schema.columns
        WHERE table_schema = ${schemaName}
          AND table_name = ${tableOrViewName}
        ORDER BY position;`;

      const columns = await this.pool.many<{
        name: Column;
        comment: string;
        pgType: string;
        position: number;
        isNullable: boolean;
        isPrimary: boolean;
        hasDefault: boolean;
      }>(query);
      return columns.map(column => ({
        ...column,
        name: column.name,
        tsType: this.getTypescriptType(column.pgType)
      }));
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  protected async getViewsOrTables<T extends View | Table>(
    type: "table" | "view",
    viewOrTables?: T[]
  ): Promise<{ name: T; comment: string; schema: Schema }[]> {
    const obj: Record<string, T[]> = { public: [] };
    if (viewOrTables) {
      for (const viewOrTable of viewOrTables) {
        const [schemaName = this.schema, viewOrTableName] = splitTableOrViewName(viewOrTable);
        if (!obj[schemaName]) obj[schemaName] = [];
        if (!obj[schemaName].includes(viewOrTableName)) obj[schemaName].push(viewOrTableName);
      }
    }

    const data = await Promise.all(
      Object.entries(obj).map(([schemaName, viewOrTableNames]) => {
        const tableOrViewFilter =
          viewOrTables && viewOrTables.length > 0
            ? sql`AND table_name = ANY(${sql.array(viewOrTableNames, `text`)})`
            : sql``;

        const query = sql`
            SELECT
              table_name                                                                 AS name, 
              table_schema                                                               AS schema,
              obj_description((table_schema || '.' || table_name)::REGCLASS, 'pg_class') AS comment
            FROM information_schema.tables
            WHERE table_schema = ${schemaName}
              AND table_type = ${type === "table" ? "BASE TABLE" : "VIEW"}
                  ${tableOrViewFilter}
            ORDER BY lower(table_name);`;
        return this.pool.many<{ name: T; comment: string; schema: Schema }>(query).catch(error => {
          if (error instanceof NotFoundError) {
            return [];
          }
        });
      })
    );
    return data.flat();
  }

  protected getTypescriptType(udtName: string): DefaultTsType {
    if (this.types[udtName]) return this.types[udtName] as DefaultTsType;

    switch (udtName) {
      case "bpchar":
      case "char":
      case "varchar":
      case "text":
      case "citext":
      case "character varying":
      case "character":

      case "uuid":
      case "bytea":
      case "inet":
      case "citext":
      case "hstore":
      case "time":
      case "timetz":
      case "interval":
      case "name": {
        return "string";
      }

      case "_varchar":
      case "_text":
      case "_citext":
      case "_uuid":
      case "_bytea": {
        return "string[]";
      }

      case "integer":
      case "int2":
      case "int4":
      case "int8":
      case "float4":
      case "float8":
      case "double precision":
      case "decimal":
      case "numeric":
      case "real":
      case "money":
      case "oid": {
        return "number";
      }

      case "_int2":
      case "_int4":
      case "_int8":
      case "_float4":
      case "_float8":
      case "_numeric":
      case "_money": {
        return "number[]";
      }

      case "bool":
      case "boolean": {
        return "boolean";
      }

      case "_bool": {
        return "boolean[]";
      }

      case "json":
      case "jsonb": {
        return "JsonValue";
      }

      case "_json":
      case "_jsonb": {
        return "JsonArray";
      }

      case "date":
      case "timestamp":
      case "timestamptz": {
        return "Date";
      }

      case "_timestamptz": {
        return "Date[]";
      }

      default: {
        console.log(`No type match, ${udtName} cast to "any"`);
        return "any";
      }
    }
  }
}
