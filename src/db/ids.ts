import { ulid } from "ulid";

export function createEntityId(prefix: string): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}
