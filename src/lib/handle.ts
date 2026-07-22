// Public profile handle: 3..30 chars, lowercase alnum + hyphens, no leading/trailing hyphen.
const RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export const normalizeHandle = (h: string): string => h.trim().toLowerCase();

export const isValidHandle = (h: string): boolean => RE.test(h);
