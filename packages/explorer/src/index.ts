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

export class PostgresExplorer implements Explorer {
  private readonly schema: Schema = "public" as Schema;
  private readonly types: Record<string, string> = {};
  private readonly pool: DatabasePoolType;

  constructor(uri: string, options: ExplorerOptions = {}) {
    this.pool = createPool(uri, { interceptors: [...createInterceptors()] });
    if (options.schema) this.schema = options.schema;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async getEnumValues(
    table: Table,
    options: { key: string; value: string }
  ): Promise<Record<string, string | number>[]> {
    const tableName = sql.identifier([this.schema, table]);
    const key = sql.identifier([options.key]);
    const value = sql.identifier([options.value]);
    const query = sql`SELECT ${key}, ${value} FROM ${tableName}`;
    try {
      const values = await this.pool.many(query);
      return values;
    } catch (error) {
      // error instance of NotFoundError return false for some reason
      if (error.name === "NotFoundError") {
        return [];
      }
      throw error;
    }
  }
  public async getViewDefinitions(schema?: Schema, views?: View[]): Promise<ViewDefinition[]> {
    try {
      if (!schema) schema = this.schema;

      const viewsWithComment = await this.getViews(schema, views);

      return Promise.all(
        viewsWithComment.map(async view => ({
          type: "view" as const,
          name: view.name,
          comment: view.comment,
          columns: await this.getColumnDefinitions(schema || this.schema, view.name)
        }))
      );
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  public async getTableDefinitions(schema?: Schema, tables?: Table[]): Promise<TableDefinition[]> {
    try {
      if (!schema) schema = this.schema;

      const tablesWithComment = await this.getTables(schema, tables);

      return Promise.all(
        tablesWithComment.map(async table => ({
          type: "table" as const,
          name: table.name,
          comment: table.comment,
          columns: await this.getColumnDefinitions(schema || this.schema, table.name)
        }))
      );
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  protected async getColumnDefinitions(
    schema: Schema,
    tableOrView: Table | View
  ): Promise<ColumnDefinition[]> {
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
            AND tc.table_schema = ${schema}
            AND tc.table_name = ${tableOrView}
          ORDER BY
                kcu.table_schema,
                kcu.table_name,
                position
        )

        SELECT
          column_name                                                              AS name,
          udt_name                                                                 AS pg_type,
          col_description(
            (${`${schema}.${tableOrView}`})::regclass::oid, ordinal_position)      AS comment,
          is_nullable = 'YES'                                                      AS is_nullable,
          (SELECT key_column
            FROM primary_columns
            WHERE key_column = column_name
              AND primary_columns.table_name = columns.table_name) IS NOT NULL     AS is_primary,
          ordinal_position                                                         AS position,
          column_default IS NOT NULL                                               AS has_default
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = ${tableOrView}
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

  protected async getViews(
    schema: Schema,
    views?: View[]
  ): Promise<{ name: View; comment: string }[]> {
    const filter =
      views && views.length > 0 ? sql`AND table_name = ANY(${sql.array(views, `text`)})` : ``;

    const query = sql`
      SELECT
        table_name                                                                 AS name, 
        obj_description((table_schema || '.' || table_name)::REGCLASS, 'pg_class') AS comment
      FROM information_schema.tables
      WHERE table_type = 'VIEW' AND
            table_schema = ${schema}
            ${filter}
      ORDER BY lower(table_name);`;
    try {
      return await this.pool.many<{ name: View; comment: string }>(query);
    } catch (error) {
      return [];
    }
  }

  protected async getTables(
    schema: Schema,
    tables?: Table[]
  ): Promise<{ name: Table; comment: string }[]> {
    const filter =
      tables && tables.length > 0 ? sql`AND table_name = ANY(${sql.array(tables, "text")})` : ``;

    const query = sql`
      SELECT 
        table_name                                                                 AS name, 
        obj_description((table_schema || '.' || table_name)::REGCLASS, 'pg_class') AS comment
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE' AND
            table_schema = ${schema}
            ${filter}
      ORDER BY lower(table_name);`;

    try {
      return await this.pool.many<{ name: Table; comment: string }>(query);
    } catch (error) {
      return [];
    }
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
