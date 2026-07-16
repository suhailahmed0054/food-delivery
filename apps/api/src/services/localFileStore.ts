import { randomUUID } from "crypto";
import { mkdir, rename, rm, writeFile } from "fs/promises";
import path from "path";

const writeQueues = new Map<string, Promise<void>>();

export function writeTextFileAtomic(filePath: string, contents: string) {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, contents, "utf8");
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  });
  writeQueues.set(filePath, operation);
  return operation.finally(() => {
    if (writeQueues.get(filePath) === operation) writeQueues.delete(filePath);
  });
}

export function writeJsonFileAtomic(filePath: string, value: unknown) {
  return writeTextFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
