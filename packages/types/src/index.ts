import { Opaque } from "type-fest";

export interface Configuration {
  uri: string;
  plugins: { name: string; filepath: string }[];
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
  name: Table;
  comment: string | null;
  columns: ColumnDefinition[];
}

export type View = Opaque<string, "view">;

export interface ViewDefinition {
  type: "view";
  name: View;
  comment: string | null;
  columns: ColumnDefinition[];
}

export interface EnumOption {
  key: string;
  value: string;
}

export interface ExplorerOptions {
  schema?: Schema;
  types?: Record<string, string>;
  tableNaming?: StringCase;
  columnNaming?: StringCase;
  viewNaming?: StringCase;
}

export interface Explorer {
  getTableDefinitions(): Promise<TableDefinition[]>;
  getViewDefinitions(): Promise<ViewDefinition[]>;
  getEnumValues(table: Table, options: EnumOption): Promise<Array<Record<string, string | number>>>;
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

export interface Plugin<Options extends object = object> {
  (
    explorer: Explorer,
    definitions: (TableDefinition | ViewDefinition)[],
    options: Options
  ): Promise<PluginResults>;
}
