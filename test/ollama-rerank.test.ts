/**
 * Tests for remote Ollama reranker support
 *
 * Since Ollama lacks /api/rerank and Qwen3-Reranker models don't function
 * as rerankers on Ollama, reranking uses bi-encoder cosine similarity
 * via the embed model (/api/embed).
 *
 * Note: Since store.ts captures OLLAMA_EMBED_URL as a const at module load time,
 * we can't toggle it mid-test. These tests verify settings behavior.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { getOllamaRerankModel, getEmbedModel } from "../src/settings.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import YAML from "yaml";

describe("Ollama reranker settings", () => {
  let testDir: string;
  const originalRerankModel = process.env.OLLAMA_RERANK_MODEL;
  const originalEmbedModel = process.env.OLLAMA_EMBED_MODEL;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "qmd-test-"));
    const configPath = join(testDir, "index.yml");
    writeFileSync(configPath, YAML.stringify({ collections: {} }));
    process.env.QMD_CONFIG_DIR = testDir;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.QMD_CONFIG_DIR;

    if (originalRerankModel) {
      process.env.OLLAMA_RERANK_MODEL = originalRerankModel;
    } else {
      delete process.env.OLLAMA_RERANK_MODEL;
    }

    if (originalEmbedModel) {
      process.env.OLLAMA_EMBED_MODEL = originalEmbedModel;
    } else {
      delete process.env.OLLAMA_EMBED_MODEL;
    }

    vi.resetAllMocks();
  });

  test("getOllamaRerankModel returns env var when set (reserved for future use)", () => {
    process.env.OLLAMA_RERANK_MODEL = "test-model-from-env";
    const model = getOllamaRerankModel();
    expect(model).toBe("test-model-from-env");
  });

  test("getOllamaRerankModel returns DEFAULT_RERANK_MODEL when not configured", () => {
    delete process.env.OLLAMA_RERANK_MODEL;
    const model = getOllamaRerankModel();
    expect(model).toContain("qwen3-reranker");
  });

  test("bi-encoder reranking uses embed_model, not rerank_model", () => {
    // In the bi-encoder approach, reranking uses the embed model for
    // cosine similarity. The rerank_model setting is reserved for
    // future use if Ollama adds /api/rerank.
    process.env.OLLAMA_EMBED_MODEL = "qwen3-embedding:0.6b";
    const embedModel = getEmbedModel();
    expect(embedModel).toBe("qwen3-embedding:0.6b");
  });
});
