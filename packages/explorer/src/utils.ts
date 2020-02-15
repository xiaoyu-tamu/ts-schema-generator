import { Schema, Table, View } from "@ts-schema-generator/types";

export function splitTableOrViewName<T extends Table | View>(name: T): [Schema | undefined, T] {
  const [schema, tableOrView, ...rest] = name.split(".");

  if (rest.length > 0) {
    throw new Error(`Invalid name ${name}, expecting schema.table or schema.view`);
  }

  if (tableOrView === undefined) return [undefined, schema as T];
  return [schema as Schema, tableOrView as T];
}

export function isValidName(name: string): name is Table | View {
  return (name.match(/\./g) || []).length === 1;
}
