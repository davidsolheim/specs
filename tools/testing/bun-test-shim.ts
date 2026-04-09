import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

type AnyFn = (...args: any[]) => any;

type MockFactory = (<T extends AnyFn>(implementation?: T) => ReturnType<typeof vi.fn<T>>) & {
  restore: () => void;
};

export const mock: MockFactory = Object.assign(
  <T extends AnyFn>(implementation?: T) => vi.fn(implementation),
  {
    restore: () => vi.restoreAllMocks(),
  },
);

export { afterEach, beforeEach, describe, expect, test, vi };
