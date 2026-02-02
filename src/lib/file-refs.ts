import { promises as fs } from "fs";
import { FileRefType, type FileRef } from "../types/config/file-refs";

async function resolveValue(value: unknown): Promise<unknown> {
  const parsed = FileRefType.safeParse(value);
  if (parsed.success) {
    const fileRef: FileRef = parsed.data;
    try {
      const contents: string = await fs.readFile(fileRef._file, "utf8");
      return contents.trim();
    } catch (err) {
      throw new Error(
        `Failed to read file referenced by _file: ${fileRef._file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(resolveValue));
  }

  if (typeof value === "object" && value !== null) {
    return resolveFileReferences(value as Record<string, unknown>);
  }

  return value;
}

async function resolveEntry(
  [key, value]: [string, unknown],
): Promise<[string, unknown]> {
  return [key, await resolveValue(value)];
}

export async function resolveFileReferences(
  obj: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resolved: [string, unknown][] = await Promise.all(
    Object.entries(obj).map(resolveEntry),
  );
  return Object.fromEntries(resolved);
}
