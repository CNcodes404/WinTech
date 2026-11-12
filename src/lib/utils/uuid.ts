const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate route ids before querying, so malformed URLs never reach the database. */
export const isUuid = (value: string): boolean => UUID.test(value);
