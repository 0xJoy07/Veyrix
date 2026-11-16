/** Schema identifiers are configuration, never customer/model input. */
export function databaseSchema(url: URL): string {
  const schema = url.searchParams.get('schema') ?? 'shopping_agent';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(schema)) {
    throw new Error('Database schema must be a simple PostgreSQL identifier (1–63 characters).');
  }
  return schema;
}
