import * as p from '@clack/prompts';
import { ServerNameSchema } from '@creepiest-space/mcpx-core';
import pc from 'picocolors';

import type {
  ImportConflict,
  ImportConflictAction,
  ImportConflictResolver,
} from '../import-conflicts.ts';
import { BACK, handleCancel } from './step-runner.ts';

export type ImportConflictPolicy = 'ask' | 'skip' | 'overwrite' | 'rename';

export function createImportConflictResolver(policy: ImportConflictPolicy): ImportConflictResolver {
  return async (conflict) => {
    const action = policy === 'ask' ? await selectAction(conflict) : policy;
    if (action === 'skip' || action === 'overwrite') return { action };
    return selectRename(conflict);
  };
}

async function selectAction(conflict: ImportConflict): Promise<ImportConflictPolicy> {
  const selected = handleCancel(
    await p.select({
      message: `Server ${pc.cyan(`"${conflict.name}"`)} from ${pc.magenta(conflict.source)} conflicts with canonical configuration`,
      options: [
        { value: 'skip' as const, label: 'Keep canonical server', hint: 'skip import' },
        { value: 'overwrite' as const, label: 'Use imported server', hint: 'overwrite' },
        { value: 'rename' as const, label: 'Import under another name' },
      ],
    }),
  );
  return selected === BACK ? 'skip' : selected;
}

async function selectRename(conflict: ImportConflict): Promise<ImportConflictAction> {
  const renamed = handleCancel(
    await p.text({
      message: `New name for ${conflict.name}`,
      initialValue: `${conflict.name}-${conflict.source}`,
      validate(value) {
        const parsed = ServerNameSchema.safeParse(value?.trim());
        if (!parsed.success) return parsed.error.issues[0]?.message;
        if (conflict.occupiedNames.includes(parsed.data)) return `"${parsed.data}" already exists`;
        return undefined;
      },
    }),
  );
  return renamed === BACK ? { action: 'skip' } : { action: 'rename', name: renamed.trim() };
}
