# Test Credentials

## Primary Test Account
- Email: `test@soulprint.com`
- Password: `Admin123!`
- Auth method: Google OAuth (legacy) + password login
- Role: superadmin

## Secondary Test Account (email/password)
- Email: `testchat@example.com`
- Password: `Test123456`
- Role: user
- Accepted: true (auto-accepted)

## Support Agent Test Account
- Email: `support@soulprint.com`
- Password: `Support123!`
- Role: support
- Login URL: `/admin?role=support`
- Note: Created via `/api/admin/support-agents` endpoint. Can only access the Support tab.

## User's Account
- Email: `reggie+test@archeforge.com`
- Auth method: Firebase/Google OAuth
- Role: user
- Accepted: true (manually fixed)
