# Task 3 - Redesign Settings Page LLM Configuration

## Status: ✅ Complete

## Summary

Redesigned the "大模型" (LLM) tab in the settings page from a basic dropdown + single config form to a tab-per-provider design with per-provider configuration cards, connection testing, and database persistence via SystemConfig.

## Files Created

1. **`src/app/api/settings/llm/route.ts`** — LLM config CRUD API
   - `GET` — Returns all LLM provider configs from SystemConfig table, with defaults pre-filled for each provider
   - `POST` — Saves a provider config using `upsert` on SystemConfig key-value store
   - Key format: `llm_{provider}_{field}` (e.g., `llm_deepseek_apiKey`)
   - Category: `llm`
   - 7 providers with defaults: ZAI, DeepSeek, OpenAI, Anthropic, Qwen, GLM, Custom

2. **`src/app/api/settings/llm/test/route.ts`** — LLM connection test API
   - `POST` — Tests LLM connection for a given provider
   - For ZAI: uses z-ai-web-dev-sdk to make a minimal chat completion
   - For other providers: constructs OpenAI-compatible chat completion request
   - For Anthropic: uses Anthropic Messages API format
   - Returns `{ success, message, latencyMs? }`
   - 15s timeout on all connection tests

## Files Modified

3. **`src/components/dashboard/settings-view.tsx`** — Complete LLM tab redesign
   - Replaced dropdown provider selector with horizontal scrollable tab bar
   - 7 provider tabs: ZAI (内置免费), DeepSeek, OpenAI, Anthropic, Qwen (通义千问), GLM (智谱AI), 自定义
   - ZAI tab: prominently displays "✅ 内置免费大模型" badge, "无需API Key，开箱即用" message, model info, test connection
   - Other provider tabs: API Key (password with show/hide toggle), Base URL (pre-filled), Model Name (pre-filled), Temperature slider, Max Tokens, Connection Status with test button, Save Config button
   - Custom tab: all fields empty for manual configuration
   - Connection status displayed with badges (Connected/Disconnected) and error messages
   - Loads settings from API on page mount
   - Saves settings via API per-provider
   - All other tabs (数据/交易/提醒/系统) preserved exactly as before
   - Loading state with spinner while configs load from DB

4. **`src/lib/i18n.ts`** — Added 29 new i18n keys (en + zh) for LLM settings:
   - `settings.llmBaseUrl`, `settings.llmModelName`, `settings.llmConnStatus`
   - `settings.llmConnected`, `settings.llmDisconnected`, `settings.llmTestConn`
   - `settings.llmTesting`, `settings.llmSaveConfig`, `settings.llmFreeBadge`
   - `settings.llmZaiTitle`, `settings.llmZaiDesc`, `settings.llmZaiModel`
   - `settings.llmConfigSaved`, `settings.llmConfigSaveFailed`
   - `settings.llmConnSuccess`, `settings.llmConnFailed`, `settings.llmNoApiKey`
   - Provider name keys: `settings.llmProviderZai/Deepseek/Openai/Anthropic/Qwen/Glm/Custom`
   - Placeholder keys for inputs
   - `settings.llmLoading`

## Default Provider Configurations

| Provider | Base URL | Model |
|----------|----------|-------|
| ZAI | (internal) | z-ai-general |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| Anthropic | https://api.anthropic.com | claude-3.5-sonnet |
| Qwen | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| GLM | https://open.bigmodel.cn/api/paas/v4 | glm-4-flash |
| Custom | (empty) | (empty) |

## Test Results

- ✅ `GET /api/settings/llm` → Returns all 7 provider configs with defaults
- ✅ `POST /api/settings/llm` with DeepSeek config → Saved successfully, persists on reload
- ✅ `POST /api/settings/llm/test` with provider=zai → Connected (299ms latency)
- ✅ `bun run lint` passes with no errors
- ✅ Dev server running, no compilation errors

## Lint Status
✅ `bun run lint` passes with no errors
