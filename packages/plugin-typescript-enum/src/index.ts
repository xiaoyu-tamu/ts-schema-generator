import { EnumOption, Plugin, TableDefinition } from "@ts-schema-generator/types";
import { chunk, withComment } from "@ts-schema-generator/utils";
import { pascalCase } from "change-case";
import { isString } from "util";
import { InvalidEnumError } from "./errors";

interface Options {
  getEnumColumns: (table: TableDefinition) => EnumOption;
}

const plugin: Plugin<Options> = async (explorer, definitions, options) => {
  const tables = definitions.filter(definition => definition.type === "table") as TableDefinition[];
  const outputs: (string | undefined)[] = [];

  for (const eventFiveTables of chunk(tables, 5)) {
    outputs.push(...(await Promise.all(eventFiveTables.map(generator))));
  }

  return { outputs: outputs.filter(isString) };

  async function generator(table: TableDefinition): Promise<string | undefined> {
    const enumColumns = options.getEnumColumns(table);
    if (!enumColumns) return;

    const primaryColumns = table.columns.filter(column => column.isPrimary);
    if (primaryColumns.length > 1) {
      throw new InvalidEnumError(table.name, table.columns.length);
    }

    const enumValues = await explorer.getEnumValues(table.schema, table.name, enumColumns);

    const enums = enumValues
      .map(x => {
        const key = x[enumColumns.key];
        if (typeof key !== "string" && typeof key !== "number") {
          throw new Error("Invalid Enum key type, expecting string | number ");
        }

        const value = x[enumColumns.value];

        return typeof value === "string"
          ? `${pascalCase(String(key))}='${value}',`
          : `${pascalCase(String(key))}=${value},`;
      })
      .join("\n");
    const name = pascalCase(table.name);

    const output = withComment(`export enum ${name}Enum { ${enums} }`, {
      comment: table.comment,
      style: "block"
    });
    return output;
  }
};

export default plugin;
