# LifeLink — Health & Wellness Assistant

A calm, trustworthy, and human health companion built with **Node.js**, **Atomic's Knowledge Graph (via Model Context Protocol)**, local **Llama 3.2:3b (8k context)**, and PDF-to-Markdown document parsing using the **Unstructured** pipeline.

---

## Key Features

1. **Atomic Knowledge Graph MCP Integration**:
   - Directly connects to Atomic's MCP server at `http://localhost:8080/mcp`.
   - Uses Bearer Authentication (`at_9ZA8bjMC6owrQa_pIjIcoVRR0kPlQT9dyFVmoDc8i5Q`).
   - Executes semantic searches over your knowledge base notes and automatically creates memory atoms when health records are uploaded.

2. **Append Health PDFs via Unstructured**:
   - Simple, intuitive button to attach PDF medical records, lab tests, or wellness guidelines.
   - Automatically converts PDF documents into structured Markdown (`.md`) via `pdf_to_markdown.py`.
   - Ingests the markdown content into Atomic Knowledge Graph using the `create_atom` MCP tool.
   - Saves parsed documents in the `documents/` folder.

3. **Strict Health & Wellness Guardrails**:
   - Dedicated exclusively to health questions, symptom exploration, wellness habits, nutrition, sleep, and record analysis.
   - Non-health queries (e.g. programming, financial speculation, political debates) are gracefully and warmly refused.

4. **Optimized for Low-End PCs**:
   - Integrates with local Ollama (`http://localhost:11434`) running `llama3.2:3b`.
   - Configured with an 8,192 (8k) token context window with compact prompt templates.
   - Full Server-Sent Events (SSE) token streaming for responsive generation without lag.

5. **Calm, Human & Trustworthy UI Design**:
   - **Warm Neutrals Palette**: Off-white linen (`#F9F7F2`), soft sand (`#F2EDE4`), and warm charcoal text (`#272522`).
   - **Single Earthy Accent**: Calming sage green (`#4A6B5D`) used sparingly for actions and tags.
   - **Humanist Typography**: Generous line height (1.68) for relaxed reading.
   - **No Clichés**: Avoids purple glowing orbs, sparkle AI gimmicks, hospital cold blues, and alarming red/green status badges.
   - **Clear Hierarchy**: Separate blocks for *Facts/Observations* vs *Supportive Suggestions*.
   - **Calm Thinking State**: Subtle breathing opacity pulse instead of gamey bouncing dots.
   - **Steady Input Region**: Grounded bottom bar with distinct PDF attachment and send buttons.

6. **Live Blood Donation Camps Near Me (eRaktKosh Government API)**:
   - Dedicated "Camps Near Me" quick-action button and starter chip.
   - Built-in hardcoded district code lookup for all 35 Maharashtra districts (default `stateCode = "27"`).
   - Conversational, compact inline district & date range picker (Today, Tomorrow, Next 7 Days).
   - Backend proxy (`/api/camps`) to bypass CORS and reliably query MoHFW eRaktKosh.
   - Formatted, card-based display showing organizer, dates/times, venue, clickable contact phone numbers, and blood centre hospital affiliations with graceful empty and retry states.

7. **Live Blood Availability Checker (eRaktKosh Government API)**:
   - Dedicated "Check Blood Stock" quick-action button and starter chip.
   - Interactive Blood Group selector supporting all 10 blood groups, including clinically critical Bombay blood groups (`Oh+`/`Oh-`).
   - Reuses the 35 Maharashtra district lookup table (`stateCode: "27"`).
   - Component selection with smart defaults (`componentId: 12` for Packed Red Blood Cells / PRBC, with Whole Blood `11` option).
   - Calm, non-alarming status badges (soft sage green for available stock, warm muted gray for zero units — strictly avoiding alarming red/green indicators).
   - Clickable `tel:` contact phone links and last reported update timestamps.
   - Prominent clinical & travel disclaimer advising users to call the blood bank directly before traveling.
   - Graceful zero-stock messaging with state (104) and national (1910) blood helplines and retry mechanisms.

---

## Quick Start

### 1. Ensure Prerequisites Are Running
- **Atomic Server**: Running on `http://localhost:8080`.
- **Ollama**: Running locally with `llama3.2:3b` installed:
  ```bash
  ollama run llama3.2:3b
  ```

### 2. Start the Assistant
Inside the `chatboot` folder:
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## File Structure

```text
chatboot/
├── mcpClient.js          # Atomic Knowledge Graph MCP Streamable HTTP client
├── ollamaClient.js       # Local Llama 3.2 3B client with health guardrails & SSE streaming
├── pdf_to_markdown.py    # PDF to Markdown parser (Unstructured + PyMuPDF)
├── server.js             # Express application & API routes
├── package.json          # Node dependencies
├── uploads/              # Uploaded PDF documents
├── documents/            # Converted Markdown (.md) documents
└── public/
    ├── index.html        # Accessible humanist layout
    ├── style.css         # Warm neutral & sage green design system
    └── app.js            # Real-time streaming & PDF upload controller
```
