import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { FileSystem } from '@creepiest-space/mcpx-core';

const DEFAULT_FILE_MODE = 0o600;

export class NodeFileSystem implements FileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return false;
      throw error;
    }
  }

  read(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  write(filePath: string, content: string): Promise<void> {
    return atomicWriteFile(filePath, content);
  }

  async remove(filePath: string): Promise<boolean> {
    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return false;
      throw error;
    }
  }
}

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const directory = dirname(filePath);
  const temporaryPath = join(directory, `.${randomUUID()}.mcpx-tmp`);
  await mkdir(directory, { recursive: true });

  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(temporaryPath, 'wx', DEFAULT_FILE_MODE);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
