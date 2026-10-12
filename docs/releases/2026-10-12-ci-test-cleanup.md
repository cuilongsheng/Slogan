# CI test shutdown repair

The main verification run `38189750095` and PR run `38189618067` passed all 236 API unit tests but stalled before integration tests. The live Actions log ended with `Jest did not exit one second after the test run has completed`.

`ConfigService` reads process environment values for absent fixture keys. Both the auth rate-limit unit test and the explicitly no-Redis safety-runner unit test therefore inherited the CI service URL. They created Redis/BullMQ connections without invoking all owning cleanup hooks. Local reproduction with the CI Redis URL and `--detectOpenHandles` identified `TCPWRAP` handles at those two tests.

The fixtures now explicitly disable Redis for these no-infrastructure cases and close the guard, runner and queue in `finally`. Real shared Redis quotas/outage behavior remain covered by integration tests; production connection behavior is unchanged. No `--forceExit` or gate bypass is used.

Validation: the full API unit scope completed naturally with exit code 0, 43 suites and 236 tests passing in 16.155 seconds under the CI Redis environment with `--detectOpenHandles`; no open-handle warning remained. The two stalled obsolete CI runs were canceled before publishing the repair. Fresh GitHub CI and guarded production release remain separate gates.
