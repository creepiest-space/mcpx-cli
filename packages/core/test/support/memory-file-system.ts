import type { FileSystem } from "../../src/sync";

export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, string>();

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) return Promise.reject(nodeError("ENOENT", path));
    return Promise.resolve(content);
  }

  write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    return Promise.resolve();
  }

  remove(path: string): Promise<boolean> {
    return Promise.resolve(this.files.delete(path));
  }
}

function nodeError(code: string, path: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: ${path}`), { code, path });
}
