import { Plugin } from "@ts-schema-generator/types";
import { withComment } from "@ts-schema-generator/utils";
import { camelCase, pascalCase } from "change-case";

interface Options {
  postfix?: { insert?: string; select?: string; update?: string };
  prefix?: { insert?: string; select?: string; update?: string };
}

const plugin: Plugin<Options> = async (explorer, definitions, options) => {
  const outputs = definitions.map(definition => {
    const tableName = pascalCase(definition.name);

    const selectPrefix = options.prefix?.select || "";
    const selectPostfix = options.postfix?.select || "Select";
    const selectName = [selectPrefix, tableName, selectPostfix].join("");

    const insertPrefix = options.prefix?.insert || "";
    const insertPostfix = options.postfix?.insert || "Insert";
    const insertName = [insertPrefix, tableName, insertPostfix].join("");

    const updatePrefix = options.prefix?.update || "";
    const updatePostfix = options.postfix?.update || "Update";
    const updateName = [updatePrefix, tableName, updatePostfix].join("");

    const columns = definition.columns
      .map(column => {
        const maybeNull = column.isNullable ? " | null" : "";
        const maybeOptional = column.isNullable || column.hasDefault ? "?" : "";

        const value = `${camelCase(column.name)}${maybeOptional}: ${column.tsType}${maybeNull};`;
        return withComment(value, { comment: column.comment });
      })
      .join("");

    return withComment(
      [
        `interface ${tableName} { ${columns} }`,
        `export interface ${selectName} extends SetRequired<${tableName}> {};`,

        definition.type === "table"
          ? `export interface ${insertName} extends ${tableName} {};`
          : undefined,

        definition.type === "table"
          ? `export interface ${updateName} extends Partial<${tableName}> {};`
          : undefined
      ].join("\n"),
      { comment: definition.comment, style: "block" }
    );
  });

  return { headers: [`import { JsonValue, SetRequired } from 'type-fest';`], outputs };
};

export default plugin;
