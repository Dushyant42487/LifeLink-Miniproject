/**
 * Atomic MCP Client
 * Connects to Atomic's Knowledge Graph via Model Context Protocol (Streamable HTTP)
 */

class AtomicMcpClient {
  constructor(config = {}) {
    this.url = config.url || 'http://localhost:8080/mcp';
    this.token = config.token || 'at_9ZA8bjMC6owrQa_pIjIcoVRR0kPlQT9dyFVmoDc8i5Q';
    this.sessionId = null;
    this.messageId = 1;
    this.initialized = false;
  }

  /**
   * Helper to execute JSON-RPC call over Streamable HTTP SSE
   */
  async _postJsonRpc(payload) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${this.token}`,
    };

    if (this.sessionId && payload.method !== 'initialize') {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (payload.method === 'initialize') {
      const sid = response.headers.get('mcp-session-id');
      if (sid) {
        this.sessionId = sid;
      }
    }

    if (response.status === 202) {
      return { success: true };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`MCP HTTP ${response.status}: ${errText}`);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultObj = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr && jsonStr !== '[DONE]') {
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.result !== undefined || parsed.error !== undefined) {
                    resultObj = parsed;
                    break;
                  }
                } catch {
                  // Wait for complete json
                }
              }
            }
          }
        }
        if (resultObj || done) break;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    if (!resultObj && buffer.trim()) {
      try {
        resultObj = JSON.parse(buffer.trim());
      } catch {}
    }

    if (resultObj?.error) {
      throw new Error(`MCP Error: ${resultObj.error.message || JSON.stringify(resultObj.error)}`);
    }

    return resultObj?.result;
  }

  async initialize() {
    try {
      const result = await this._postJsonRpc({
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'health-assistant-client', version: '1.0.0' }
        }
      });

      // Send initialized notification
      if (this.sessionId) {
        await this._postJsonRpc({
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        });
      }

      this.initialized = true;
      return result;
    } catch (err) {
      this.initialized = false;
      throw err;
    }
  }

  async ensureReady() {
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }
  }

  /**
   * Search Atomic's knowledge graph using vector similarity and keywords
   */
  async semanticSearch(query, limit = 5) {
    await this.ensureReady();
    try {
      const res = await this._postJsonRpc({
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'tools/call',
        params: {
          name: 'semantic_search',
          arguments: { query, limit }
        }
      });

      if (!res?.content || !Array.isArray(res.content)) {
        return [];
      }

      // The content array usually has text item containing JSON
      const textItem = res.content.find(c => c.type === 'text');
      if (textItem && textItem.text) {
        try {
          const parsed = JSON.parse(textItem.text);
          return Array.isArray(parsed) ? parsed : (parsed.atoms || parsed.results || [parsed]);
        } catch {
          return [{ content: textItem.text }];
        }
      }
      return [];
    } catch (err) {
      console.warn('Semantic search warning:', err.message);
      // Attempt re-init once if session expired
      if (err.message.includes('404') || err.message.includes('Session not found')) {
        this.initialized = false;
        this.sessionId = null;
        await this.ensureReady();
        return this.semanticSearch(query, limit);
      }
      return [];
    }
  }

  /**
   * Store new markdown note/memory into Atomic Knowledge Graph
   */
  async createAtom(content, sourceUrl = null) {
    await this.ensureReady();
    try {
      const args = { content };
      if (sourceUrl) args.source_url = sourceUrl;

      const res = await this._postJsonRpc({
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'tools/call',
        params: {
          name: 'create_atom',
          arguments: args
        }
      });

      const textItem = res?.content?.find(c => c.type === 'text');
      if (textItem?.text) {
        try {
          return JSON.parse(textItem.text);
        } catch {
          return { text: textItem.text };
        }
      }
      return res;
    } catch (err) {
      console.warn('Create atom warning:', err.message);
      if (err.message.includes('404') || err.message.includes('Session not found')) {
        this.initialized = false;
        this.sessionId = null;
        await this.ensureReady();
        return this.createAtom(content, sourceUrl);
      }
      throw err;
    }
  }

  /**
   * List recent atoms from knowledge graph
   */
  async listAtoms(limit = 10) {
    await this.ensureReady();
    try {
      const res = await this._postJsonRpc({
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'tools/call',
        params: {
          name: 'list_atoms',
          arguments: { limit }
        }
      });

      const textItem = res?.content?.find(c => c.type === 'text');
      if (textItem?.text) {
        try {
          const parsed = JSON.parse(textItem.text);
          return parsed.atoms || parsed;
        } catch {
          return [];
        }
      }
      return [];
    } catch (err) {
      console.warn('List atoms warning:', err.message);
      return [];
    }
  }
}

module.exports = { AtomicMcpClient };
