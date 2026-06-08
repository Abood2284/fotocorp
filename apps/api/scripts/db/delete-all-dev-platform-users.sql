-- One-time: remove all platform customers from the current DATABASE_URL branch.
-- Deletes related auth, fotobox, download logs, entitlements, and access inquiries.
-- Does NOT remove catalog assets, staff, or contributors.

BEGIN;

DELETE FROM asset_fotobox_items
WHERE user_id IN (SELECT id FROM users);

DELETE FROM fotobox_boards
WHERE user_id IN (SELECT id FROM users);

DELETE FROM image_download_logs
WHERE user_id IN (SELECT id FROM users);

DELETE FROM asset_download_logs
WHERE user_id IN (SELECT id FROM users);

DELETE FROM admin_user_audit_logs
WHERE target_auth_user_id IN (SELECT id::text FROM users)
   OR actor_auth_user_id IN (SELECT id::text FROM users);

DELETE FROM email_delivery_logs
WHERE related_entity_type = 'USER'
  AND related_entity_id IN (SELECT id::text FROM users);

DELETE FROM auth_sessions
WHERE owner_type = 'USER'
  AND owner_id IN (SELECT id FROM users);

DELETE FROM auth_credentials
WHERE owner_type = 'USER'
  AND owner_id IN (SELECT id FROM users);

DELETE FROM auth_identity_claims
WHERE owner_type = 'USER'
  AND owner_id IN (SELECT id FROM users);

-- Cascades: subscriber_entitlements, customer_access_inquiries, password_reset_tokens
DELETE FROM users;

COMMIT;
