import { Types } from 'mongoose';

export function isObjectIdString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value) &&
    Types.ObjectId.isValid(value)
  );
}
