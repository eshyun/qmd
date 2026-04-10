/**
 * Global settings management for QMD
 *
 * Reads/writes global settings from ~/.config/qmd/settings.yml.
 * Covers embedding, reranking, and query model configuration.
 *
 * Priority: environment variables > settings.yml > hardcoded defaults
 *
 * Example settings.yml:
 * ```yaml
 * ollama:
 *   url: http://localhost:11434
 *   embed_model: qwen3-embedding:0.6b
 *   rerank_model: qwen3-reranker:0.6b
 *   generate_model: qwen3:1.7b
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import YAML from "yaml";

// ============================================================================
// Types
// ============================================================================

export interface OllamaSettings {
  url?: string;              // Ollama server URL (e.g., http://localhost:11434)
  embed_model?: string;      // Embedding model name (default: nomic-embed-text)
  rerank_model?: string;     // Reserved: not used (Ollama lacks /api/rerank, bi-encoder uses embed_model)
  generate_model?: string;   // Text generation model for query expansion
}

export interface Settings {
  ollama?: OllamaSettings;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_EMBED_MODEL = "embeddinggemma";
export const DEFAULT_RERANK_MODEL = "ExpedientFalcon/qwen3-reranker:0.6b-q8_0";
export const DEFAULT_QUERY_MODEL = "Qwen/Qwen3-1.7B";
export const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text";

// Ollama does NOT support a /api/rerank endpoint, and Qwen3-Reranker models on Ollama
// do not function as rerankers (loaded as CausalLM without the sequence-classification
// head needed for yes/no logit scoring). In remote Ollama mode, reranking uses the
// bi-encoder approach: /api/embed for query + docs → cosine similarity.
// The `ollama.rerank_model` setting is reserved for future use if Ollama adds /api/rerank.
// Configure via `ollama.embed_model` in settings.yml or OLLAMA_EMBED_MODEL env var.

// ============================================================================
// Config paths
// ============================================================================

function getConfigDir(): string {
  if (process.env.QMD_CONFIG_DIR) {
    return process.env.QMD_CONFIG_DIR;
  }
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, "qmd");
  }
  return join(homedir(), ".config", "qmd");
}

function getSettingsPath(): string {
  return join(getConfigDir(), "settings.yml");
}

// ============================================================================
// Core
// ============================================================================

/**
 * Load settings from ~/.config/qmd/settings.yml.
 * Returns empty object if file doesn't exist.
 */
export function loadSettings(): Settings {
  const path = getSettingsPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    const content = readFileSync(path, "utf-8");
    return YAML.parse(content) as Settings;
  } catch {
    return {};
  }
}

/**
 * Save settings to ~/.config/qmd/settings.yml.
 * Merges with existing settings.
 */
export function saveSettings(settings: Settings): void {
  const configDir = getConfigDir();
  const path = getSettingsPath();

  // Load existing settings to merge
  const existing = loadSettings();
  const merged: Settings = { ...existing, ...settings };

  // Deep merge ollama section
  if (settings.ollama && existing.ollama) {
    merged.ollama = { ...existing.ollama, ...settings.ollama };
  }

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(path, YAML.stringify(merged), "utf-8");
}

// ============================================================================
// Resolved getters (env > settings > defaults)
// ============================================================================

/**
 * Get the effective Ollama URL.
 * Priority: OLLAMA_EMBED_URL env > settings.yml > undefined
 */
export function getOllamaUrl(): string | undefined {
  if (process.env.OLLAMA_EMBED_URL) return process.env.OLLAMA_EMBED_URL;
  return loadSettings().ollama?.url;
}

/**
 * Get the effective embedding model name.
 * Priority: OLLAMA_EMBED_MODEL env > settings.yml > DEFAULT_OLLAMA_EMBED_MODEL
 */
export function getEmbedModel(): string {
  if (process.env.OLLAMA_EMBED_MODEL) return process.env.OLLAMA_EMBED_MODEL;
  return loadSettings().ollama?.embed_model ?? DEFAULT_OLLAMA_EMBED_MODEL;
}

/**
 * Get the effective local embed model (when NOT using Ollama).
 * Falls back to DEFAULT_EMBED_MODEL.
 */
export function getLocalEmbedModel(): string {
  return DEFAULT_EMBED_MODEL;
}

/**
 * Get the effective query generation model.
 * Priority: OLLAMA_GENERATE_MODEL env > settings.yml.ollama.generate_model > DEFAULT_QUERY_MODEL
 */
export function getGenerateModel(): string {
  if (process.env.OLLAMA_GENERATE_MODEL) return process.env.OLLAMA_GENERATE_MODEL;
  return loadSettings().ollama?.generate_model ?? DEFAULT_QUERY_MODEL;
}

/**
 * Get the effective Ollama rerank model name (only used when OLLAMA_EMBED_URL is set).
 * Priority: OLLAMA_RERANK_MODEL env > settings.yml.ollama.rerank_model > DEFAULT_RERANK_MODEL
 */
export function getOllamaRerankModel(): string {
  if (process.env.OLLAMA_RERANK_MODEL) return process.env.OLLAMA_RERANK_MODEL;
  return loadSettings().ollama?.rerank_model ?? DEFAULT_RERANK_MODEL;
}

/**
 * Check if remote Ollama mode is active (embedding via HTTP API).
 */
export function isOllamaRemoteMode(): boolean {
  return getOllamaUrl() !== undefined;
}
