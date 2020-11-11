import { Opaque } from "type-fest";

export interface Configuration {
  uri: string;
  plugins: { name: string; filepath: string }[];
  tables?: Table[];
  views?: View[];
  getEnumColumns: (table: TableDefinition) => { key: string; value: string };
}

export type Column = Opaque<string, "column">;

export interface ColumnDefinition {
  name: Column;
  tsType: DefaultTsType;
  pgType: string;
  position: number;
  isNullable: boolean;
  hasDefault: boolean;
  isPrimary: boolean;
  comment: string | null;
}

export type Table = Opaque<string, "table">;

export interface TableDefinition {
  type: "table";
  schema: Schema;
  name: Table;
  comment: string | null;
  columns: ColumnDefinition[];
}

export type View = Opaque<string, "view">;

export interface ViewDefinition {
  type: "view";
  schema: Schema;
  name: View;
  comment: string | null;
  columns: ColumnDefinition[];
}

export interface EnumOption {
  key: string;
  value: string;
}

export interface ExplorerOptions {
  types?: Record<string, string>;
  schema?: Schema;
}

export interface Explorer {
  getTableDefinitions(tables: Table[]): Promise<TableDefinition[]>;
  getViewDefinitions(views: View[]): Promise<ViewDefinition[]>;
  getEnumValues(
    schema: Schema,
    table: Table,
    options: EnumOption
  ): Promise<readonly Record<string, string | number>[]>;
}

export type StringCase = "camelCase" | "pascalCase" | "snakeCase";
export type Schema = Opaque<string, "schema">;
export type DefaultTsType =
  | "string"
  | "string[]"
  | "number"
  | "number[]"
  | "boolean"
  | "boolean[]"
  | "Date"
  | "Date[]"
  | "JsonValue"
  | "JsonArray"
  | "any";

export interface PluginResults {
  headers?: string[];
  outputs: string[];
}

export type PluginOptions = Record<string, any>;

export interface Plugin<Options extends PluginOptions = PluginOptions> {
  (
    explorer: Explorer,
    definitions: (TableDefinition | ViewDefinition)[],
    options: Options
  ): Promise<PluginResults>;
}
