import type { ModelType } from "@src/api/types/keys";

import type { IconProvider } from "./iconProviders";
import { MODEL_TYPE_TO_ICON } from "./modelTypeIcons";

/**
 * Detect icon provider from model name.
 * @param modelName - The model name string (e.g. "gpt-4o", "composer-1", "auto")
 * @param agentType - Optional agent type hint for generic names like "auto"
 */
const CURSOR_MODEL_NAME_ICONS = new Set(["auto", "default", "premium"]);

export function getIconProviderFromModelName(
  modelName: string,
  agentType?: string
): IconProvider {
  const lower = modelName.toLowerCase();

  // Generic model names that depend on agent type context
  if (lower === "auto" && agentType) {
    return MODEL_TYPE_TO_ICON[agentType as ModelType] || "unknown";
  }

  // Cursor models (composer and Cursor plan/tier names)
  if (lower.includes("composer") || CURSOR_MODEL_NAME_ICONS.has(lower)) {
    return "cursor";
  }

  // GitHub Copilot models (copilot-chat, copilot-premium, etc.)
  if (lower.includes("copilot")) {
    return "copilot";
  }

  // OpenAI models (provider-prefixed OpenRouter IDs, GPT series, O-series,
  // Codex variants, etc.)
  if (
    lower.startsWith("openai/") ||
    lower.includes("gpt") ||
    lower.includes("codex") ||
    /^o\d/.test(lower)
  ) {
    return "openai";
  }

  // Anthropic/Claude models (including model family names + Cursor's
  // "op-*-relay" tier name, which is an Opus-class proxy and should
  // share the Claude brand mark — same shape of normalization as
  // OpenAI's `^o\d` rule above for o-series models like "o5.5-high").
  if (
    lower.includes("claude") ||
    lower.includes("fable") ||
    lower.includes("haiku") ||
    lower.includes("opus") ||
    lower.includes("sonnet") ||
    /^op[-_]/.test(lower)
  ) {
    return "claude";
  }

  // Google/Gemini/Gemma models
  if (
    lower.startsWith("google/") ||
    lower.includes("gemini") ||
    lower.includes("gemma")
  ) {
    return "gemini";
  }

  // xAI/Grok models
  if (lower.includes("grok")) {
    return "grok";
  }

  // DeepSeek models
  if (lower.includes("deepseek")) {
    return "deepseek";
  }

  // Cohere models
  if (lower.startsWith("cohere/") || lower.includes("command-r")) {
    return "cohere";
  }

  // Mistral models
  if (lower.includes("mistral") || lower.includes("mixtral")) {
    return "mistral";
  }

  // Alibaba/Qwen models
  if (lower.includes("qwen")) {
    return "qwen";
  }

  // NVIDIA/Nemotron models
  if (
    lower.includes("nvidia") ||
    lower.includes("nvdia") ||
    lower.includes("nemotron")
  ) {
    return "nvidia";
  }

  // Meta/Llama models
  if (lower.includes("llama") || lower.includes("meta")) {
    return "meta";
  }

  // Perplexity models
  if (lower.includes("perplexity") || lower.includes("pplx")) {
    return "perplexity";
  }

  // ZenMux provider/model slugs
  if (lower.includes("zenmux")) {
    return "zenmux";
  }

  // Moonshot/Kimi models
  if (lower.includes("kimi") || lower.includes("moonshot")) {
    return "kimi";
  }

  // Tencent Hunyuan models
  if (lower.includes("hunyuan") || /^hy(?:\d|[-_])/.test(lower)) {
    return "hunyuan";
  }

  // Local runtimes
  if (lower.includes("ollama")) {
    return "ollama";
  }
  if (lower.includes("lmstudio") || lower.includes("lm-studio")) {
    return "lm_studio";
  }
  if (lower.includes("llama.cpp") || lower.includes("llama-cpp")) {
    return "llamacpp";
  }

  // ByteDance/Doubao models
  if (lower.includes("bytedance")) {
    return "bytedance";
  }

  // Doubao (ByteDance's model name)
  if (lower.includes("doubao")) {
    return "doubao";
  }

  // Volcengine models
  if (lower.includes("volcengine") || lower.includes("volc")) {
    return "volcengine";
  }

  // Xiaomi/MiMo models
  if (lower.startsWith("xiaomi/") || lower.includes("mimo")) {
    return "xiaomi";
  }

  // 01.AI/Yi models
  if (lower.includes("yi-") || lower === "yi" || lower.includes("01.ai")) {
    return "yi";
  }

  // ZCode IDE / Z.ai coding workspace
  if (lower.includes("zcode")) {
    return "zcode";
  }

  // Qoder IDE (Alibaba's agentic IDE)
  if (lower.includes("qoder")) {
    return "qoder";
  }

  // Zhipu/GLM models
  if (
    lower.includes("zhipu") ||
    lower.includes("glm") ||
    lower.includes("chatglm")
  ) {
    return "zhipu";
  }

  // Baichuan models
  if (lower.includes("baichuan")) {
    return "baichuan";
  }

  // Minimax models
  if (lower.includes("minimax") || lower.includes("abab")) {
    return "minimax";
  }

  // LongCat models
  if (lower.includes("longcat") || lower.startsWith("meituan/")) {
    return "longcat";
  }

  return "unknown";
}
