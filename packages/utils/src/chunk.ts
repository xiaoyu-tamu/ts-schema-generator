export function chunk<T>(input: T[], size: number): T[][] {
  return input.reduce<T[][]>((acc, curr, index) => {
    return index % size === 0
      ? [...acc, [curr]]
      : [...acc.slice(0, -1), [...acc.slice(-1)[0], curr]];
  }, []);
}
