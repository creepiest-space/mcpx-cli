import type { FileSystem } from '@creepiest-space/mcpx-core';

import type { Output } from '../src/output/index.ts';

export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, string>();

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  read(path: string): Promise<string> {
    const content = this.files.get(path);
    return content === undefined
      ? Promise.reject(new Error(`ENOENT: ${path}`))
      : Promise.resolve(content);
  }

  write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    return Promise.resolve();
  }

  remove(path: string): Promise<boolean> {
    return Promise.resolve(this.files.delete(path));
  }
}

export class RecordingOutput implements Output {
  readonly messages: Array<{ level: string; message: string }> = [];
  success(message: string): void {
    this.messages.push({ level: 'success', message });
  }
  warning(message: string): void {
    this.messages.push({ level: 'warning', message });
  }
  error(message: string): void {
    this.messages.push({ level: 'error', message });
  }
  info(message: string): void {
    this.messages.push({ level: 'info', message });
  }
  debug(message: string): void {
    this.messages.push({ level: 'debug', message });
  }
}
