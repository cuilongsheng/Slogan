# Email password authentication operation instructions

The back-end and mobile pages have been implemented locally; the acceptance and deployment of real sending has not yet been completed. The real SMTP/sending domain name/controlled mailbox is not configured, and the backend acceptance task 5.4 remains BLOCKED; do not open the real environment entrance or archive the backend change before completing the real delivery acceptance.

## Configuration and Startup

Execute `source ~/.nvm/nvm.sh && nvm use` first, keeping Node 24.21.0 and pnpm 12.3.4. Migrate to `20260923000000_email_password_auth`, only add five tables, indexes and mailbox credentials to User, and do not automatically create identities from OAuth mailboxes.

1. Close `EMAIL_PASSWORD_AUTH_ENABLED`, back up the target database, and then execute `pnpm --filter @slogan/api db:migrate:deploy` through `DATABASE_URL` in the target environment.
2. Configure `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_FROM` to the deployment secret environment. Password not written to Git. TLS mode uses `TLS` (commonly used 465) or `STARTTLS` (commonly used 587), mandatory certificate verification, minimum TLS 1.2; the total SMTP timeout is limited by `EMAIL_SMTP_TIMEOUT_MS`.
3. Configure `EMAIL_VERIFY_URL` and `EMAIL_RESET_URL` as fixed trusted HTTPS pages, pointing to mobile web routes `/email/verify` and `/email/reset` respectively, and do not allow userinfo, query or fragment. The development machine preview can use `http://localhost:8082/email/verify` and `http://localhost:8082/email/reset` respectively; the real environment must use a verified HTTPS domain name. The client reads a single token from the fragment, immediately clears the browser address bar, and then the user explicitly confirms with POST; GET does not consume credentials. The associated domain name/universal link of the native device still requires physical device acceptance.
4. Configure an independent HMAC/AES keyring: `EMAIL_AUTH_HMAC_KEYS`, `EMAIL_AUTH_AES_KEYS` are both JSON objects, the key is keyId, and the value is the standard base64 of an independent 32-byte random key; the active key is selected by `EMAIL_AUTH_HMAC_KEY_ID`, `EMAIL_AUTH_AES_KEY_ID`. Up to 4 keys reserved. Can be generated using `openssl rand -base64 32` in a secret management environment, and the key is not backed up with the database in clear text. Keep old keys during rotation and wait for existing applications, challenges and payloads to be cleaned before removing them; synchronize active HMAC keyIds across multiple instances to avoid quota splitting.
5. Configure `REDIS_URL`. The default source is 20 times/15 minutes, the login target is 10 times/15 minutes, the email target is 5 times/hour, and the global email is 100 times/hour; there is a hard upper limit for `EMAIL_AUTH_*_LIMIT`. Unknown identities are still counted; Redis fails and rejects new password attempts/email requests, and SMTP failures do not prevent password logins for existing accounts.
6. If it goes through a proxy, `EMAIL_AUTH_TRUSTED_PROXIES` only fills in the IP/CIDR of the controlled proxy; the forwarding source is not trusted by default. Broad trust in public network sources is prohibited. Reverse proxies must not log request bodies, full URL queries, or message fragments.
7. Start `EMAIL_PASSWORD_AUTH_ENABLED=true` only after the configuration is complete and the target environment acceptance is completed. API executes `pnpm --filter @slogan/api start`, independent worker executes `pnpm --filter @slogan/api start:auth-mail-worker`; build before publishing. Both use the same database, keys and switches. worker checks every second, up to 20 items in a single batch, no reentry; no delivery when closed.

Local SMTP capture only allows clear text on `NODE_ENV=test`, `EMAIL_SMTP_TLS_MODE=LOCAL_TEST` and host is loopback. Local runtime test uses smtp-server 3.19.13, actual SMTP client is nodemailer 10.0.10; captured emails are not treated as external delivery evidence.

## Sessions, retries and cleanup

- Successful registration only returns 32 random bytes of management credentials, expiration and cooling time, no User/session; if the management credentials are lost, the original application cannot be modified with the email address. Each goal can have up to 3 valid applications at the same time, and it will expire in 24 hours.
- 30 minutes to register/bind the verification token, 15 minutes to reset the token, and 5 minutes to re-authenticate the proof; resend for at least 60 seconds, replace the generation, and the application period will not be extended. Only HMAC digests of token, administrative credentials and proof are saved in the database.
- SMTP outbox only saves the minimum delivery parameters encrypted by AES-256-GCM, and AAD is bound to the delivery ID/keyId. Each claim has a 60-second lease and generation fencing, with up to 5 exponential backoffs. The Message-ID is fixed, but the same link may still be sent repeatedly due to SMTP timeout/submission loss; the link is consumed in a single time and does not provide exactly-once commitment.
- The payload is cleared immediately after delivery is completed; the payload is also cleared immediately after final failure. The worker cleans up the undelivered payload of expired/consumed challenges. Expired applications immediately clear their temporary identities and passwords; no later than 24 hours. Temporary metadata deletion after 7 days of expiration. Long-term worker downtime will delay cleaning. You should monitor the process and the age of the oldest record to be cleaned. After recovery, clean up first and then collect. Official identities and security audits will not be removed by this cleanup.
- Consumed or repeated commands will not replace the original credentials; submitting the same binding command again will return `EMAIL_COMMAND_CONFLICT`. Do not automatically generate new commands to bypass re-authentication. Failed transaction rollback proof consumption. When the key is lost and the payload to be sent cannot be recovered, the marking fails and the plain text is not leaked; when the old HMAC key is retained, the management credentials can be maintained for controlled resend, otherwise the original application will be re-applied after it expires.
- The password is calculated outside the transaction. When submitting, lock User and then Lock EmailCredential and check the version again. Reset incremental version, revoke all platform sessions, invalidate old proof/challenge; log in with new password after lost response. LiveKit media token not claimed to have been issued will expire immediately.
- Destroy password hashes and invalid temporary credentials after deleting the account, leaving the username/email uniquely occupied. Restricted records only expose the EMAIL_PASSWORD type; ordinary login methods only return a fixed desensitization mask and do not return email addresses.

## Rollback

Turn off the API and worker mailbox switches and roll back the application version, retaining the new tables and existing identities. During the shutdown period, unique users with mailboxes cannot log in with passwords. The impact should be explained before publishing. Do not delete tables, restore old passwords, restore revoked sessions, and do not revive deleted identities through old database snapshots. The existing OAuth/mobile phone number entry and original session revocation mechanism continue to operate.

## Local verification environment isolation

Native PostgreSQL 17.6 with Redis 7.4.11 provided by `apps/api/docker-compose.test.yml`, ports 54329/56379. Use Redis DB 8 for mailbox quota testing and DB 9 for HTTP testing, and clean these test libraries; only perform tests on isolated test containers.

An existing blank optional STT/backup value of `apps/api/.env` will be rejected by Zod, and the default Redis address may also leave the old realtime runner waiting for a connection. The credential file has not been changed this time. When reproducing the verification, explicitly set the following no-secret configuration in the test shell; when the test turns on Redis by itself, the null value will be overwritten:

```sh
export REDIS_URL=
export AI_EXPRESSION_DATA_USE=REQUEST_PROCESSING_ONLY
export STT_DATA_USE=REQUEST_PROCESSING_ONLY
export STT_DELETION_MODE=NO_RETENTION
export STT_STREAMING_MODE=SHORT_WINDOW
export BACKUP_ENVIRONMENT_ID=local-test
export BACKUP_ENCRYPTION_KEY_ID=local-test-key
export BACKUP_RETENTION_COUNT=1
export BACKUP_RPO_SECONDS=60
export BACKUP_RTO_SECONDS=60
```

These values are only used for isolation testing and contract generation, and cannot be used as proof of real STT, backup or email providers. See the acceptance record for the final command and results.

## Prototype and Contract

The only contract is `openapi/openapi.yaml` generated by NestJS decorators. The existing `packages/api-client` is still a directory skeleton without a generation script. This time there is no new client type or second contract; in the future, the client will be generated according to a unique contract. After the email verification returns successfully, a password is required to log in, and the business session is not automatically sent with an email link. The visual acceptance of prototype `add-email-password-auth` is still independent; future synchronization of its delta must handle this process difference and does not directly cover the backend specifications.
