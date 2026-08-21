import { ServerNameSchema } from '../types/canonical.ts';

export { ServerNameSchema };

export function isValidServerName(name: string): boolean {
  return ServerNameSchema.safeParse(name).success;
}
