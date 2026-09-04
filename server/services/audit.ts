import type { Pool } from 'pg';

export async function writeAuditLog(
  client: { query: Pool['query'] },
  actorUserId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: object = {},
) {
  await client.query("SELECT set_config('app.user_role', 'admin', true)");
  await client.query(
    'INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [actorUserId, action, resourceType, resourceId, JSON.stringify(metadata)],
  );
}
