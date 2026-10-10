# Free web page trial deployment

Update time: 2026-10-03. Status: `planned / not deployed`.

This article is for trial use in recruitment and the first round of web page testing for overseas users. It does not mean that it will be officially produced. Currently, Cloudflare, Render, and Neon accounts have been registered, but no online resources have been created yet. The repository is [cuilongsheng/Slogan](https://github.com/cuilongsheng/Slogan), and the deployment branch has been determined to be `main`; `9da06b9` checked on 2026-10-03 already contains the latest front-end and browser certification. Each release still needs to record the actual commit at that time. The solution to be implemented must pass the applicable OpenSpec implementation and acceptance. This article does not replace the requirements or actual implementation authorization.

Existing Google OAuth and LiveKit Cloud are reused in the first round; email sending is disabled, AI configuration is suspended, and related functions remain closed. Do not purchase servers or independent domain names. This article only records the deployment steps and does not perform resource creation, migration, account initialization or deployment.

## Where to start now

After the account registration is completed, platform resources need to be created. It is recommended to proceed according to the table without operating all platforms at once.

| Sequence | Operation                                                                                                                                  | Current stage                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Locally implement and test the five-account solution, password and email switch splitting                                                  | **Waiting for code to complete**; Another chat is being implemented, no evidence of completion yet                                                                              |
| 2        | Select a region and create Neon Free Project/Postgres                                                                                      | **Now users can do**; create an empty database first, without migrating or importing local data                                                                                 |
| 3        | Create a Render free Key Value in the same region, select `noeviction`                                                                     | **Now users can do**                                                                                                                                                            |
| 4        | Completed the same-origin API forwarding, cold start/task recovery adaptation, and merged the release code into `main`                     | **Waiting for code adaptation**                                                                                                                                                 |
| 5        | Prepare the creation settings and online configuration of Render Web Service and Cloudflare Pages                                          | **Operation after code adaptation**; final creation/Save and Deploy will trigger build deployment                                                                               |
| 6        | Check the created Neon target, then migrate and independently initialize five online accounts                                              | **Executed after database creation**; use the running instructions that have been verified at that time, and do not wait for the API to be open to the public before migrating. |
| 7        | Completed API/Pages creation and deployment, verified login, three-person voice, public network webhook, reconnection and failure recovery | **Pending acceptance**                                                                                                                                                          |

You can prepare the project name and open the creation form first; when the API/Pages configuration is not complete, there is no need to repeatedly trigger failed deployments in order to obtain the address. The following resource names are only suggestions. The platform domain name shall be subject to the actual return.

## Resources and Entrance

| Platform   | Suggested name/resource              | Purpose                                                                 |
| ---------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Neon       | `slogan-preview` Project; a database | Persistent identities, rooms, permissions, auditing and other facts     |
| Render     | `slogan-preview-redis` Key Value     | Redis compatible with coordination, presence, rate limiting, BullMQ     |
| Render     | `slogan-preview-api` Web Service     | NestJS API and real-time/safe queue consumer within the current process |
| Cloudflare | `slogan-preview-mobile` Pages        | Mobile Web, platform HTTPS `pages.dev` address                          |
| Cloudflare | `slogan-preview-admin` Pages         | Desktop admin, independent platform HTTPS `pages.dev` address           |

The two Pages projects require the same source `/v1/*` API to be forwarded to Render. This forwarding is planned to be implemented using Pages Functions. There is no need to purchase a domain name or create an independent API server. There is currently no proxy file or final packaging command; this is a pending solution. Real audio connected directly from the browser to LiveKit Cloud.

## 1. Publish code and local account prefix

- [Five account proposal](../../openspec/changes/add-preview-experience-accounts/proposal.md), [Design](../../openspec/changes/add-preview-experience-accounts/design.md), [Mission](../../openspec/changes/add-preview-experience-accounts/tasks.md): one `PLATFORM_ADMIN` and one `SAFETY_OFFICER` in the background, moving three ordinary users. Room host is generated by normal room creation and is not a global account role.
- Create and test locally first, without waiting for Neon. Partial implementation, task checking, and local account existence cannot replace online initialization and acceptance evidence.
- Online reinitialization with independent environment identifier and independent secret input; does not copy local database, password hashes, session or role records. The existing test fixture is not an online seed, and reuse of the full table cleanup process is prohibited.
- Currently password login is still gated by the SMTP configuration; it cannot be enabled in a mailless environment until the switch split is completed. The proposed new `EMAIL_AUTH_MAIL_ENABLED` is subject to final implementation; the CLI of non-existing accounts does not make up commands in this article.
- `main` must contain verified account/proxy implementation, migration, unique OpenAPI and generated client. The build is generated from source code and does not upload local `dist` as the basis for release.
- At present, `dist-web` and `dist-ios` have been submitted. Git tracking should be lifted and ignore rules should be added in the subsequent code organization to retain the local required products. Keep `.env`, Prisma generation implementation, and native `ios/android` generation directory out of Git; design assets and acceptance screenshots are not mechanically deleted.

## 2. Neon: Create empty free PostgreSQL

1. Select Create Project in [Neon Console](https://console.neon.tech) and confirm that the account is still Free.
2. The project name can be `slogan-preview`; PostgreSQL recommends choosing **17**, which is consistent with the PostgreSQL 17 baseline of the repository isolation test. Do not import local development libraries directly.
3. First compare the Render optional regions, and then select the Neon region in the same city or nearby. For example, select Oregon or Frankfurt when both ends are available; the final choice will be determined by the console. Render API and Key Value must be in the same region, and Neon should be as close to them as possible. See [Neon region](https://neon.com/docs/introduction/regions).
4. Keep free calculation and automatic hibernation; first use the minimum calculation scale and check the automatic scaling limit. Database branch is Neon's resource concept and does not have to have the same name as Git `main`.
5. Select the actual branch/database/role in the connection panel and save the **pooled** and **direct** connection strings privately. Keep TLS parameters required by the platform, such as `sslmode=require`; do not turn off TLS or certificate verification to bypass connection failures.
6. At this time, only the project name, region, Postgres version and empty library status are recorded; the connection string contains the password and is not pasted into Git, screenshots, deployment records or ordinary logs.

`PrismaPg` reads `DATABASE_URL` during runtime; it is recommended to use pooled connection. Migration, backup and recovery using direct connections. The current [Prisma Configuration](../../apps/api/prisma.config.ts) also reads `DATABASE_URL`, **No independent direct URL configuration**: direct URL is injected into the dedicated process when performing migration, and the API process still uses the pooled URL and is not interchanged at will. Start verification requires that the URL starts with `postgresql://`. SSL, connection pooling, transactions and connection recovery must be verified in the target environment and cannot be deduced from candidate compatibility as successful connection. [Connection instructions](https://neon.com/docs/connect/connect-from-any-app)

## 3. Render: Create free Key Value first

1. Dashboard → **New → Key Value**。
2. The name is available `slogan-preview-redis`, the Region is the same as the future API service, and the compute plan explicitly selects **Free**.
3. Maxmemory Policy selects **`noeviction`**, not `allkeys-lru` for caching; when the memory is exhausted, an error will be reported when writing, which needs to be observed and processed, and the queue data cannot be evicted to make space.
4. Once created, privately save the internal URL from the Connect panel and later inject the API's `REDIS_URL`. When the API and Key Value are in the same workspace and region, internal connections will be given priority; external connections will only restrict the source when necessary and use the platform TLS URL.
5. Record resource name, region, plan and strategy. Do not output authentication information in the URL.

The new instance is a Redis compatible Valkey. Free instances have no persistence and will lose all coordination/queue data on restart; it is not a database backup. Reference [Key Value creation, connection and strategy](https://render.com/docs/key-value).

## 4. Render: Create the API after the code and configuration are complete

Dashboard → **New → Web Service**, connect to GitHub, grant only the required repository access scope, select `cuilongsheng/Slogan`. Google login platform account does not mean that you are connected to GitHub.

| Field          | Settings                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Branch         | `main`, check the commit again including the acceptance implementation of this round                                                   |
| Runtime        | Node                                                                                                                                   |
| Region         | Consistent with Key Value                                                                                                              |
| Root Directory | Warehouse root, leave blank; don’t just select `apps/api`, workspace/lockfile is required                                              |
| Instance Type  | Free                                                                                                                                   |
| Build Command  | `npm install --global pnpm@12.3.4 && pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/api build`                   |
| Start Command  | `pnpm --filter @slogan/api start`                                                                                                      |
| Auto-Deploy    | The first round of suggestions is Off, and it will be released manually after the migration and acceptance preparations are completed. |
| Health Check   | Currently use the default TCP; do not fill in the non-existent `/health`                                                               |

The above is the configuration to be verified by the platform, and this article has not been implemented. `--prod=false` retains the development dependencies required for the build; [API build](../../apps/api/package.json) has executed `prisma generate` first, and then executed Nest build. No need to install a terminal database or run Docker tests to start the service.

Set `NODE_VERSION=24.21.0`, `NODE_ENV=production`, and `APP_HOST=0.0.0.0` in the environment; make `APP_PORT` consistent with Render’s `PORT`, such as the default `10000`. The current application reads `APP_PORT` and will not automatically read `PORT`. See the table below for other configurations. Only click Create Web Service after filling in all the information and completing the target database migration in Section 7; creation will start the first build. Verify the actual process memory and three-person load after successful startup. Free's 512 MB/0.1 CPU is only a platform specification, not a proof of project capacity.

There is currently no anonymous HTTP readiness endpoint; background protected operations health cannot be used as a public probe. If HTTP readiness is required later, implement it first and then configure it. Reference [Web Service](https://render.com/docs/web-services), [Node version](https://render.com/docs/node-version), [Health check](https://render.com/docs/health-checks).

### API minimum configuration table (only lists key names, does not save credentials)

| key name                                                                                                        | Purpose/Time to fill in                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`, `NODE_ENV`, `APP_HOST`, `APP_PORT`                                                              | Build version, production mode and listening address; fill in when creating the service                                                                                                                                                                    |
| `APP_NAME`                                                                                                      | The existing start script has been set to `slogan-api`                                                                                                                                                                                                     |
| `DATABASE_URL`, `REDIS_URL`                                                                                     | Inject through the platform configuration after creating the resource; do not change the local `.env`                                                                                                                                                      |
| `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `ROOM_PASSWORD_PEPPER`                                             | Three separate 32+ character deployment secrets, securely generated and saved privately                                                                                                                                                                    |
| `ROOM_RULES_VERSION`, `ROOM_SHARE_BASE_URL`                                                                     | Approved rule version; actual HTTPS origin of mobile Pages, no query/fragment for root address                                                                                                                                                             |
| `CORS_ALLOWED_ORIGINS`                                                                                          | Explicit allowlist of two stable Pages HTTPS origins, comma separated, no `*`                                                                                                                                                                              |
| `GOOGLE_OAUTH_ENABLED`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URIS`    | Reuse existing Web OAuth client; enable Google, server secret only in API; allowlist contains two actual Pages origins                                                                                                                                     |
| `REALTIME_ENABLED`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`                                      | Enable voice, reuse existing LiveKit Cloud WSS project; manage credentials only in API                                                                                                                                                                     |
| `EMAIL_PASSWORD_AUTH_ENABLED` and final email/experience configuration                                          | Login without SMTP password needs to wait for the implementation of the five-account plan; according to this plan, the final runbook fills in the secret and environment identification, and the current switch cannot be used to bypass the verification. |
| `EMAIL_AUTH_TRUSTED_PROXIES`                                                                                    | If source IP rate limiting is enabled, confirm the trusted IP/CIDR according to the actual proxy chain; do not trust the forwarding header provided by any client, and wait for deployment adaptation confirmation if it is unknown.                       |
| `PHONE_AUTH_ENABLED`, `WECHAT_OAUTH_ENABLED`                                                                    | First round of closure                                                                                                                                                                                                                                     |
| `ASSISTANCE_ENABLED`, `ASSISTANCE_AUDIO_ENABLED`, `ROOM_SPEECH_DETECTION_ENABLED`, `POST_ROOM_KEYWORDS_ENABLED` | All are closed in the first round; no large model is configured/called, and the existing local AI fields are not moved.                                                                                                                                    |
| `OPERATIONS_GOVERNANCE_ENABLED`                                                                                 | Closed in the first round, no additional management tasks will be started; subsequent separate acceptance will be enabled                                                                                                                                  |

All `EXPO_PUBLIC_*` and `VITE_*` will enter the browser build and cannot save database, OAuth secret, LiveKit management key/secret or account password.

## 5. Cloudflare: Two Pages projects and same-origin API

### Complete the same-origin forwarding first

The current refresh cookies of [Browser authentication](../../apps/api/src/modules/auth/presentation/browser-auth.controller.ts) are `HttpOnly` and `SameSite=Lax`, and the production environment is `Secure`. Calling `onrender.com` directly from `pages.dev` is a cross-site request and cannot be resolved by CORS and `credentials: include` to refresh cookies. [Browser Credentials Rules](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials)

For forwarding to be implemented, the respective `/v1/*` requests of the two Pages websites need to be made to the fixed Render API, and the method, path, query, request body, original Origin, Authorization, Cookie and response Set-Cookie are retained. The authentication response is prohibited from being cached; the upstream is fixed and visitors cannot be allowed to specify any forwarding target. Trusted proxy and source throttling need to be verified together. Only the API path executes Function, static assets continue to go to Pages.

Available in Pages Functions, or packaged advanced-mode worker in build output; **The final path, environment key name and proxy packaging command have not been implemented yet**. Do not claim that the following static build contains a proxy, and do not treat `_redirects`'s external redirect as a reverse proxy. Reference [Functions](https://developers.cloudflare.com/pages/functions/get-started/), [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/).

### Creating and Static Build Settings

After the code is prepared, go to Workers & Pages → **Create application → Pages → Connect to Git** and authorize the Slogan repository. Create mobile and backend projects in the same repository respectively; select `main` for Production branch, use the repository root for Root Directory, and select None for preset. The official process of **Save and Deploy will actually deploy** does not only save the project name. [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

| Settings                            | Mobile Web                                                                                                                          | Desktop admin                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Build Command (current static part) | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/mobile exec expo export --platform web --output-dir dist-web` | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/admin build` |
| Build Output Directory              | `apps/mobile/dist-web`                                                                                                              | `apps/admin/dist`                                                                  |
| Public API base configuration       | `EXPO_PUBLIC_API_BASE_URL`                                                                                                          | `VITE_API_BASE_URL`                                                                |
| Google public client ID             | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`                                                                                                  | `VITE_GOOGLE_WEB_CLIENT_ID`                                                        |

Both projects are set to `NODE_VERSION=24.21.0`, `PNPM_VERSION=12.3.4`, and `SKIP_DEPENDENCY_INSTALL=1`, which are installed according to the lock file according to the command in the above table; mobile can be set to `EXPO_NO_DOTENV=1`, and only the public variables injected by the platform are read. [Build tool version](https://developers.cloudflare.com/pages/configuration/build-image/)

After the proxy is implemented, fill in the respective Pages **Full HTTPS origin** for each API base, without adding `/v1`; [Generate client](../../packages/api-client/src/index.ts) requires an absolute URL, and the interface path already contains `/v1`, so `/` cannot be filled in. The two front-end Google client IDs are consistent with the API's Web client ID. Currently mobile `build` script exports to iOS, do not use it instead of Web export. Official [Web export](https://docs.expo.dev/router/web/static-rendering/) supports specified Web platforms.

After completing the proxy packaging, update the above table to the final build. The check output includes `index.html`, JS/Assets and the actual proxy artifact. The current web export is based on a single page application; without the top-level `404.html`, Pages can be used as a SPA fallback, but `/v1/*` must be processed by the proxy and cannot be rolled back to HTML. Actual verification directly opens/refreshes `/sign-in`, `/rooms`, room details and `/r/...` sharing links, and background protected routing. [Pages routing rules](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## 6. Online address, Google and LiveKit

1. After obtaining three actual HTTPS origins, fill in the correct addresses in the two front-end build configurations, API CORS, Google redirect allowlist, room sharing origin and proxy fixed upstream respectively; change the public build variables and rebuild, and change the API configuration and redeploy.
2. Reuse the existing Google Web OAuth client and add two stable Pages origins to Authorized JavaScript origins. The current code popup is: `window.location.origin` is transmitted from the front end, not the fictitious `/auth/callback`; check the redirect/origin configuration according to Google code-model and the current adapter, and then do the real login. The Google login of the platform account and the OAuth of the Slogan are two different things and are not automatically associated. [Google code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model)
3. Configure the `/v1/webhooks/livekit` HTTPS URL of the actual Render API in the existing LiveKit Cloud project, using the corresponding signing certificate on the server side. The current raw webhook body and SDK signature verification need to be retained; do not parse or rewrite the body in advance in the proxy or middleware. LiveKit management credentials cannot be entered into the front end. Verifying legal, illegal signatures and duplicate events cannot just prove that the URL is accessible. [LiveKit webhook](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
4. Only stable Pages origin is authorized in the first round; the temporary preview subdomain is not an automatically trusted entrance. The desensitized URL and results are recorded in the public network acceptance, and the authorization code, cookie, token or signature value is not retained.

## 7. Migration, online accounts and rollback

The following commands are from existing scripts, **Use only when the goal is clear, backup/restore preparations are completed, and a separate release is performed.**, which this article did not run. First in the repository root `nvm use`; the dedicated execution process safely injects the target direct `DATABASE_URL`, first checks the environment and library identity, and does not echo the connection string. Prisma CLI will not automatically load Nest's `apps/api/.env`. When not injected, the configuration will fall back to the local library, so naked migration cannot be done directly.

```bash
DATABASE_URL="${DATABASE_URL:?Securely inject and confirm the target direct connection first}" pnpm --filter @slogan/api db:migrate:status
DATABASE_URL="${DATABASE_URL:?Securely inject and confirm the target direct connection first}" pnpm --filter @slogan/api db:migrate:deploy
DATABASE_URL="${DATABASE_URL:?Securely inject and confirm the target direct connection first}" pnpm --filter @slogan/api db:migrate:status
```

Free Render has no paid pre-deploy command, shell or one-off jobs. In the first round, a controlled local release process with clear goals is used to perform the migration. After successful recording, the API is manually deployed; subsequent automation paths will be determined separately. Do not secretly add migrations/seeds to front-end builds, API builds, or every startup. [Deployment command restrictions](https://render.com/docs/deploys)

Online five account initialization uses account change. Finally implemented dry-run/initialization/role separation command, **The non-existent CLI is not currently provided**. The existing `backoffice:bootstrap` only grants administrative roles to existing users, cannot create five accounts, and cannot guarantee that the administrator and safety officer are separated. The initial empty database must not be imported into local accounts; real usernames and passwords are entered and delivered through certain secret channels.

There are `backup:postgres`, `restore:postgres`, `recovery:check`, see [Restoration instructions](../operations-data-governance-runbook.md). Backup requires PostgreSQL client tools, explicit output, and a full backup strategy. The current backup script generates pg_dump and records the encryption key ID, **Does not encrypt files itself**: The actual encryption, private storage and retention period must be completed and verified, and the Render temporary file system is not used as a backup disk. Recovery only applies to newly created isolation libraries, external providers are disabled; active libraries cannot be overwritten.

Record recoverable points and old commits/configurations before migration; application rollback is separated from database rollback. Five account sources/nullable verifiedAt migration may not be compatible with old binaries, verify rollback boundaries as designed, and do not perform destructive down migration at will. Stop traffic or turn off related capabilities when publishing fails, restore the verified compatible version; recheck roles, sessions, rooms and audit invariants.

## 8. Free restrictions and task recovery

| Project          | Restrictions and first round actions                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render API       | Sleeps after 15 minutes of no inbound traffic, wakes up for about one minute; 750 free instance hours per workspace per month. Create an API without creating additional paid workers; service may be suspended if budget is exhausted/resources are exceeded |
| Render Key Value | Free is 25 MB, 50 connections, no persistence; writing fails when `noeviction` is full. PostgreSQL rebuilds the queue after data loss after verification disconnection and restart, and expired qualifications are not restored.                              |
| Neon             | 2026-10-02 New announcement has been upgraded to **1 GB** database capacity per project, still **100 CU-hours** per month; idle sleep, monitoring computing/capacity will be retained, and the old 0.5 GB snapshot will not be used                           |
| Pages Functions  | Shared with Workers Free 100,000 requests per day; static assets are free and unlimited requests. The proxy only covers API paths, observe quota failure and cold start errors                                                                                |
| LiveKit Cloud    | Reuse existing projects, the actual plan/minute/transmission and other quotas shall be subject to the project Dashboard; the account usage has not been checked in this round, and unlimited free audio is not promised.                                      |

Reference [Render Free](https://render.com/docs/free), [Render specifications](https://render.com/docs/compute-plans), [Neon 2026-10-02 updated](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Pages Functions quota](https://developers.cloudflare.com/pages/functions/pricing/). Do not upgrade the paid plan or activate additional paid services; if the creation page shows charges, stop checking first.

Accepting a cold start does not mean accepting the scheduled task failure. The current realtime/safety runner accesses the database every 15 seconds: Neon is prevented from idle sleep when the API is awake; room opening, room closing, and safety processing are suspended when the API is asleep, and needs to be restored after waking up. According to 0.25 CU resident for 30 days, it is estimated to be about 180 CU-hours, which exceeds 100 free quota; do not use unlimited keep-alive to avoid hibernation.

Deployment adaptation must be verified: it can sleep when idle, compensate for processing deadlines/persistent commands after waking up, rebuild Redis after loss, and do not release old members/old tokens. LiveKit's standalone audio connection itself does not guarantee that Render is always awake. If the timeliness of background tasks during the first round of unattended access is still not guaranteed, it will be clearly recorded as a trial limit and cannot be declared to meet the 24×7 official release requirements. Additional email, voice processing, and governance workers do not start in the first round; this does not mean that the built-in real-time/safe polling has been turned off.

## 9. Acceptance and release records

All items are still **Pending acceptance**. Use three independent browser contexts and two independent background accounts to record in order:

1. HTTPS, direct links, and refresh routes work; API returns correct JSON, proxy does not turn errors into HTML; cold start has understandable waits/retries, normal requests resume.
2. Normal password vs. real Google login; unknown/wrong password rejection; mail portal and direct mail routing do not generate false successes when disabled. Refreshing the page can restore the HttpOnly session, but it cannot be restored after exiting; the token will not be stored in ordinary browsers.
3. Administrator/safety officer responsibilities are separated, ordinary mobile users do not have backend permissions; direct calls bypassing the UI are also rejected by the backend.
4. Three ordinary mobile users: one user creates a room normally and two users join, real microphone publishing/listening; verify mute, exit, room host ends, and have another user create a new room after it ends.
5. Old tokens/old credentials cannot be re-entered after being kicked; all old credentials will become invalid after the room ends. Network disconnection, refresh and reconnection require re-confirmation of membership.
6. The legal webhook on the public network has been signed and processed. Illegal signatures are rejected and duplicate events are idempotent; confirm the final room and member status instead of just looking at HTTP 200.
7. Actively wait for idle sleep and wake up, verify reservation/expiry/safe recovery; verify Redis interruption/data loss recovery and resource quota failure in a controlled trial environment. Actual backup, quarantine recovery and application rollback are executable.

Create a new actual trial release record at [docs/releases](../releases/README.md), such as `free-preview-2026-10-03.md` (this file has not been created yet). Fill in the status, commit, non-sensitive resource name/region/HTTPS origin, related changes, migration results, independent online account initialization results, acceptance evidence, resource usage and restrictions, and rollback points according to the record specifications. The created resource cannot be marked as `deployed`; the actual release status will be recorded after completing the applicable acceptance. Web page evidence remains independent from native physical device, real SMTP, AI, and formal production acceptance.
