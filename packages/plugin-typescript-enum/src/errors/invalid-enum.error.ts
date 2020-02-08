export class InvalidEnumError extends Error {
  constructor(readonly table: string, numberOfColumns: number) {
    super(
      `${table} has ${numberOfColumns} primary keys, only table with single primary key is allowed`
    );
  }
}
