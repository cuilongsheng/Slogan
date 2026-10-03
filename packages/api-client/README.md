# API client

`openapi/openapi.yaml` 是唯一合同。本包的 `src/generated/schema.d.ts` 由以下命令生成，不能手动修改：

```bash
pnpm --filter @slogan/api-client generate
pnpm --filter @slogan/api-client generate:check
```

`generate:check` 在生成结果与当前 YAML 不同时失败。`createSloganApiClient` 接受显式的 API base URL 和可选的 `fetch` 实现；包内不保存会话，也不设置业务错误文案。移动端通过 `apps/mobile/src/api/client.ts` 消费它。

生成器暂时需要包内隔离的 TypeScript 5.9；移动端仍由项目固定的 TypeScript 6 检查生成类型。
