# Remote Ollama Reranker Support

QMD now supports using Ollama's `/api/rerank` endpoint for reranking search results, complementing the existing remote embedding support. This allows you to offload both embedding and reranking to a remote Ollama server.

## Configuration

### Environment Variables

```bash
# Required: Ollama server URL (enables remote mode for embeddings)
export OLLAMA_EMBED_URL=http://remote-server:11434

# Optional: Override reranker model (defaults to settings.yml or DEFAULT_RERANK_MODEL)
export OLLAMA_RERANK_MODEL=bge-reranker-v2-m3

# Optional: Override embedding model
export OLLAMA_EMBED_MODEL=nomic-embed-text
```

### Settings File (~/.config/qmd/settings.yml)

```yaml
ollama:
  url: http://remote-server:11434
  embed_model: nomic-embed-text
  rerank_model: bge-reranker-v2-m3
  generate_model: qwen3:1.7b
```

## Priority Order

The rerank model is resolved in this order:
1. `OLLAMA_RERANK_MODEL` environment variable
2. `ollama.rerank_model` in settings.yml
3. Falls back to `DEFAULT_RERANK_MODEL` (local GGUF model)

## Behavior

When `OLLAMA_EMBED_URL` is set:
- **Embeddings**: Always use Ollama's `/api/embed` endpoint
- **Reranking**: Uses Ollama's `/api/rerank` endpoint if configured
  - Falls back to local LlamaCpp if Ollama rerank fails
  - Falls back to RRF-only scores if `skipRerank=true`

## Supported Reranker Models

Ollama supports various reranker models. Common choices:

- `bge-reranker-v2-m3` (recommended - multilingual, strong performance)
- `bge-reranker-base` (lighterweight)
- `qwen3-reranker:0.6b` (matches QMD's default GGUF model)
- `qwen3-reranker:4b` (larger model, better quality)
- `gte-rerank` (alternative option)

Pull models in Ollama:
```bash
ollama pull bge-reranker-v2-m3
ollama pull qwen3-reranker:0.6b
```

## Error Handling

If the Ollama rerank API fails:
- Error is caught and logged: `⚠ Ollama rerank failed (error message), skipping reranking`
- Search continues with uncached documents getting score 0
- Does NOT break the entire search pipeline
- Falls back gracefully to local reranker if `llmOverride` is provided

## Caching

Rerank results are cached in SQLite with keys that include:
- Query text (with intent prepended if present)
- Model name
- Chunk text (file path excluded to avoid duplicate scoring)

Cache prevents redundant API calls for identical chunks across different files.

## Example Usage

```bash
# Configure remote Ollama
export OLLAMA_EMBED_URL=http://192.168.1.100:11434
export OLLAMA_RERANK_MODEL=bge-reranker-v2-m3

# Search will now use remote embeddings and reranking
qmd query "authentication best practices"

# Skip reranking entirely (use RRF scores only)
qmd query "authentication best practices" --skip-rerank
```

## Performance Considerations

- **Network latency**: ~50-200ms per API call (depends on network)
- **Batch processing**: Multiple documents sent in single API call
- **Parallelism**: Ollama handles internal parallelization
- **Caching**: Significant speedup for repeated queries

## Troubleshooting

### "Ollama rerank failed" Error
- Check Ollama server is running: `curl http://server:11434/api/tags`
- Verify model is pulled: `ollama list | grep reranker`
- Check firewall/network connectivity

### Reranking Not Happening
- Verify `OLLAMA_EMBED_URL` is set (remote mode must be active)
- Check `qmd status` for configuration details
- Review logs for warning messages

### Slow Performance
- Consider using a lighter reranker model
- Check network latency to Ollama server
- Ensure Ollama server isn't overloaded

## Implementation Details

The implementation follows the same pattern as remote Ollama embeddings:
1. Detect `OLLAMA_EMBED_URL` (remote mode active)
2. Call `ollamaRerank()` with query and documents
3. Cache results by chunk text
4. Graceful degradation on errors

See `src/store.ts:ollamaRerank()` and `src/store.ts:rerank()` for implementation.
