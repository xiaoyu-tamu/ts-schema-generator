export function withComment(
  value: string,
  options?: { comment?: string | null; style?: "line" | "block" }
): string {
  let comment = undefined;
  if (!options?.comment) return value;

  if (options.style === "block") {
    comment = `/**
         * ${options.comment}
         */`;
  } else comment = `/* ${options.comment} */`;

  return `${comment}
       ${value}`;
}
