/**
 * Tests for remote Ollama reranker support
 *
 * Note: Since store.ts captures OLLAMA_EMBED_URL as a const at module load time,
 * we can't toggle it mid-test. These tests verify behavior that we CAN test.
 *
 * Full integration tests with OLLAMA_EMBED_URL set should be run in a separate process.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createStore, type Store } from "../src/store.js";
import { getOllamaRerankModel } from "../src/settings.js";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import YAML from "yaml";

describe("Ollama reranker settings", () => {
  let testStore: Store;
  let testDir: string;
  const originalRerankModel = process.env.OLLAMA_RERANK_MODEL;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), "qmd-test-"));
    const configPath = join(testDir, "index.yml");
    writeFileSync(configPath, YAML.stringify({ collections: {} }));
    process.env.QMD_CONFIG_DIR = testDir;
    testStore = createStore(join(testDir, "test.sqlite"));
  });

  afterEach(() => {
    testStore.close();
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.QMD_CONFIG_DIR;

    if (originalRerankModel) {
      process.env.OLLAMA_RERANK_MODEL = originalRerankModel;
    } else {
      delete process.env.OLLAMA_RERANK_MODEL;
    }

    vi.resetAllMocks();
  });

  test("getOllamaRerankModel returns env var when set", () => {
    process.env.OLLAMA_RERANK_MODEL = "test-model-from-env";
    const model = getOllamaRerankModel();
    expect(model).toBe("test-model-from-env");
  });

  test("getOllamaRerankModel returns DEFAULT_RERANK_MODEL when not configured", () => {
    delete process.env.OLLAMA_RERANK_MODEL;
    const model = getOllamaRerankModel();
    expect(model).toContain("qwen3-reranker");
  });
});
