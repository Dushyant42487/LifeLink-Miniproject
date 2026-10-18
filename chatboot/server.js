const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { AtomicMcpClient } = require('./mcpClient');
const { OllamaClient } = require('./ollamaClient');

const app = express();
const PORT = process.env.CHATBOT_PORT || (process.env.PORT && process.env.PORT !== '5001' ? process.env.PORT : 3000);

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DOCUMENTS_DIR = path.join(__dirname, 'documents');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Initialize Clients
const mcpClient = new AtomicMcpClient({
  url: 'http://localhost:8080/mcp',
  token: 'at_9ZA8bjMC6owrQa_pIjIcoVRR0kPlQT9dyFVmoDc8i5Q'
});

const ollamaClient = new OllamaClient({
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b',
  numCtx: 8192
});

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Setup multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are supported'));
    }
  }
});

// Cache of uploaded document metadata
const uploadedDocsLog = [];

/**
 * Hardcoded Maharashtra State & District mapping for eRaktKosh
 */
const MAHARASHTRA_DATA = {
  stateCode: "27",
  stateName: "Maharashtra",
  districts: [
    { "name": "Ahilyanagar", "code": "522" },
    { "name": "Akola", "code": "501" },
    { "name": "Amravati", "code": "503" },
    { "name": "Chhatrapati Sambhajinagar", "code": "515" },
    { "name": "Beed", "code": "523" },
    { "name": "Bhandara", "code": "506" },
    { "name": "Buldhana", "code": "500" },
    { "name": "Chandrapur", "code": "509" },
    { "name": "Dhule", "code": "498" },
    { "name": "Gadchiroli", "code": "508" },
    { "name": "Gondia", "code": "507" },
    { "name": "Hingoli", "code": "512" },
    { "name": "Jalgaon", "code": "499" },
    { "name": "Jalna", "code": "514" },
    { "name": "Kolhapur", "code": "530" },
    { "name": "Latur", "code": "524" },
    { "name": "Mumbai", "code": "519" },
    { "name": "Mumbai Suburban", "code": "518" },
    { "name": "Nagpur", "code": "505" },
    { "name": "Nanded", "code": "511" },
    { "name": "Nandurbar", "code": "497" },
    { "name": "Nashik", "code": "516" },
    { "name": "Dharashiv", "code": "525" },
    { "name": "Parbhani", "code": "513" },
    { "name": "Pune", "code": "521" },
    { "name": "Raigad", "code": "520" },
    { "name": "Ratnagiri", "code": "528" },
    { "name": "Sangli", "code": "531" },
    { "name": "Satara", "code": "527" },
    { "name": "Sindhudurg", "code": "529" },
    { "name": "Solapur", "code": "526" },
    { "name": "Thane", "code": "517" },
    { "name": "Wardha", "code": "504" },
    { "name": "Washim", "code": "502" },
    { "name": "Yavatmal", "code": "510" }
  ]
};

/**
 * Fetch live blood donation camp details from eRaktKosh government API
 */
async function fetchCampDetails(stateCode = "27", districtCode, startDate, endDate) {
  const url = `https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/camps/details?stateCode=${encodeURIComponent(stateCode)}&districtCode=${encodeURIComponent(districtCode)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://eraktkosh.mohfw.gov.in/'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`eRaktKosh API responded with status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request to eRaktKosh timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Endpoint to get supported state & district lookup
 */
app.get('/api/districts', (req, res) => {
  res.json(MAHARASHTRA_DATA);
});

/**
 * Endpoint to proxy eRaktKosh camps request to prevent CORS issues
 */
app.get('/api/camps', async (req, res) => {
  const { stateCode = "27", districtCode, startDate, endDate } = req.query;

  if (!districtCode) {
    return res.status(400).json({ error: 'districtCode query parameter is required' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const start = startDate || todayStr;
  const end = endDate || start;

  try {
    const camps = await fetchCampDetails(stateCode, districtCode, start, end);
    const districtObj = MAHARASHTRA_DATA.districts.find(d => d.code === districtCode);

    res.json({
      success: true,
      stateCode,
      stateName: MAHARASHTRA_DATA.stateName,
      districtCode,
      districtName: districtObj ? districtObj.name : districtCode,
      startDate: start,
      endDate: end,
      count: camps.length,
      camps
    });
  } catch (err) {
    console.error('Error in /api/camps proxy:', err.message);
    res.status(502).json({
      success: false,
      error: err.message || 'Failed to fetch blood donation camps from eRaktKosh'
    });
  }
});

/**
 * Verified Blood Group mappings from eRaktKosh
 */
const BLOOD_GROUPS_DATA = [
  { label: "A+Ve", id: "11" },
  { label: "A-Ve", id: "12" },
  { label: "B+Ve", id: "13" },
  { label: "B-Ve", id: "14" },
  { label: "AB+Ve", id: "17" },
  { label: "AB-Ve", id: "18" },
  { label: "O+Ve", id: "15" },
  { label: "O-Ve", id: "16" },
  { label: "Oh+Ve (Bombay)", id: "22" },
  { label: "Oh-Ve (Bombay)", id: "23" }
];

/**
 * Fetch live blood availability from eRaktKosh government API
 * Component ID 12 = Packed Red Blood Cells (PRBC - default transfusion standard)
 * Component ID 11 = Whole Blood
 */
async function fetchBloodAvailability(stateCode = "27", districtId, componentId = "12", bloodGroupId = "11") {
  const url = `https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/blood-availability?stateCode=${encodeURIComponent(stateCode)}&districtId=${encodeURIComponent(districtId)}&componentId=${encodeURIComponent(componentId)}&bloodGroupId=${encodeURIComponent(bloodGroupId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://eraktkosh.mohfw.gov.in/'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`eRaktKosh API responded with status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request to eRaktKosh blood availability timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Endpoint to get blood group lookup
 */
app.get('/api/blood-groups', (req, res) => {
  res.json({ bloodGroups: BLOOD_GROUPS_DATA });
});

/**
 * Endpoint to proxy blood availability requests
 */
app.get('/api/blood-availability', async (req, res) => {
  const { stateCode = "27", districtId, componentId = "12", bloodGroupId = "11" } = req.query;

  if (!districtId) {
    return res.status(400).json({ error: 'districtId query parameter is required' });
  }

  try {
    const rawData = await fetchBloodAvailability(stateCode, districtId, componentId, bloodGroupId);
    const districtObj = MAHARASHTRA_DATA.districts.find(d => d.code === districtId);
    const bgObj = BLOOD_GROUPS_DATA.find(b => b.id === bloodGroupId);

    // Format and parse the blood bank stock records
    const banks = rawData.map(item => {
      let availableUnits = 0;
      let stockString = "0";
      let componentName = "Packed Red Blood Cells";

      if (item.components && typeof item.components === 'object') {
        const compKeys = Object.keys(item.components);
        if (compKeys.length > 0) {
          componentName = compKeys[0];
          const compData = item.components[componentName];
          if (compData.available_WithQty) {
            stockString = compData.available_WithQty;
            const match = stockString.match(/:\s*(\d+)/);
            if (match) availableUnits = parseInt(match[1], 10);
          } else if (compData.not_available_WithQty) {
            stockString = compData.not_available_WithQty;
            availableUnits = 0;
          }
        }
      }

      return {
        hospitalName: item.hospitalname || "Blood Centre",
        address: item.hospitaladd || "",
        contact: item.hospitalcontact || "",
        type: item.hospitalType || "Blood Bank",
        lastUpdated: item.entrydate || "",
        componentName,
        stockString,
        availableUnits,
        isAvailable: availableUnits > 0
      };
    });

    // Sort banks with available stock first, then by units descending
    banks.sort((a, b) => b.availableUnits - a.availableUnits);

    const totalAvailableUnits = banks.reduce((sum, b) => sum + b.availableUnits, 0);

    res.json({
      success: true,
      stateCode,
      stateName: MAHARASHTRA_DATA.stateName,
      districtId,
      districtName: districtObj ? districtObj.name : districtId,
      bloodGroupId,
      bloodGroupLabel: bgObj ? bgObj.label : bloodGroupId,
      componentId,
      totalBanksReported: banks.length,
      banksWithStock: banks.filter(b => b.isAvailable).length,
      totalAvailableUnits,
      banks
    });
  } catch (err) {
    console.error('Error in /api/blood-availability proxy:', err.message);
    res.status(502).json({
      success: false,
      error: err.message || 'Failed to fetch blood availability from eRaktKosh'
    });
  }
});

/**
 * Health check & status endpoint
 */
app.get('/api/status', async (req, res) => {
  let atomicConnected = false;
  let atomicAtomsCount = 0;
  let ollamaConnected = false;

  try {
    await mcpClient.ensureReady();
    const atoms = await mcpClient.listAtoms(5);
    atomicConnected = true;
    atomicAtomsCount = Array.isArray(atoms) ? atoms.length : 0;
  } catch (err) {
    console.warn('Atomic status check:', err.message);
  }

  try {
    const oRes = await fetch('http://localhost:11434/api/tags');
    if (oRes.ok) ollamaConnected = true;
  } catch (err) {
    console.warn('Ollama status check:', err.message);
  }

  res.json({
    atomic: { connected: atomicConnected, atomsPreviewCount: atomicAtomsCount },
    ollama: { connected: ollamaConnected, model: 'llama3.2:3b', contextWindow: '8k' },
    documentsUploaded: uploadedDocsLog.length
  });
});

/**
 * List uploaded documents & atoms
 */
app.get('/api/documents', async (req, res) => {
  try {
    const atoms = await mcpClient.listAtoms(20).catch(() => []);
    res.json({
      uploaded: uploadedDocsLog,
      atoms: atoms
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload PDF and append to Atomic Knowledge Graph
 * 1. Saves uploaded PDF
 * 2. Runs pdf_to_markdown.py (unstructured library with fallback)
 * 3. Ingests Markdown into Atomic MCP via create_atom
 */
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const pdfPath = req.file.path;
  const originalName = req.file.originalname;
  const baseName = path.parse(originalName).name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const mdFileName = `${Date.now()}_${baseName}.md`;
  const mdPath = path.join(DOCUMENTS_DIR, mdFileName);

  const pythonScript = path.join(__dirname, 'pdf_to_markdown.py');

  try {
    // Run python conversion
    const pyProcess = spawn('python', [pythonScript, pdfPath, mdPath]);
    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (d) => { stdout += d.toString(); });
    pyProcess.stderr.on('data', (d) => { stderr += d.toString(); });

    await new Promise((resolve, reject) => {
      pyProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python script exited with code ${code}: ${stderr || stdout}`));
      });
    });

    let convResult = {};
    try {
      convResult = JSON.parse(stdout.trim());
    } catch {
      convResult = { engine: 'pymupdf_structured' };
    }

    if (!fs.existsSync(mdPath)) {
      throw new Error('Markdown file was not produced.');
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');

    // Ingest into Atomic Knowledge Graph via MCP create_atom tool
    let atomResult = null;
    let atomId = null;
    try {
      const atomContentWithHeader = `# Document: ${originalName}\n\n${mdContent}`;
      atomResult = await mcpClient.createAtom(atomContentWithHeader, `upload://${originalName}`);
      atomId = atomResult?.id || atomResult?.atom?.id || null;
    } catch (atomErr) {
      console.warn('Error syncing atom to Atomic MCP:', atomErr.message);
    }

    const docMeta = {
      id: Date.now().toString(),
      filename: originalName,
      mdFileName,
      size: req.file.size,
      engine: convResult.engine || 'unstructured/pymupdf',
      charCount: mdContent.length,
      atomId,
      uploadedAt: new Date().toISOString(),
      preview: mdContent.substring(0, 300)
    };

    uploadedDocsLog.unshift(docMeta);

    res.json({
      success: true,
      document: docMeta
    });
  } catch (err) {
    console.error('PDF upload & processing failed:', err);
    res.status(500).json({
      error: 'Failed to process and append PDF: ' + err.message
    });
  }
});

/**
 * Chat Stream endpoint using Server-Sent Events (SSE)
 */
app.post('/api/chat/stream', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const lastUserMsg = messages[messages.length - 1]?.content || '';

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Search knowledge base context
  let contextDocs = [];
  try {
    contextDocs = await mcpClient.semanticSearch(lastUserMsg, 3);
  } catch (err) {
    console.warn('Context search warning:', err.message);
  }

  // Also include recent uploaded documents if relevant
  if (uploadedDocsLog.length > 0 && contextDocs.length === 0) {
    const recentDoc = uploadedDocsLog[0];
    const fullMdPath = path.join(DOCUMENTS_DIR, recentDoc.mdFileName);
    if (fs.existsSync(fullMdPath)) {
      const content = fs.readFileSync(fullMdPath, 'utf8');
      contextDocs.push({
        title: recentDoc.filename,
        content: content.substring(0, 3000),
        source_url: `upload://${recentDoc.filename}`
      });
    }
  }

  // Send context meta event to client
  res.write(`data: ${JSON.stringify({ type: 'context', contextCount: contextDocs.length, references: contextDocs.map(d => d.title || d.source_url || 'Knowledge Atom') })}\n\n`);

  try {
    await ollamaClient.streamChat({
      messages,
      contextDocs,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      onDone: (fullText) => {
        res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  Health & Wellness Assistant is live on http://localhost:${PORT}`);
  console.log(`  Atomic Knowledge Graph MCP: http://localhost:8080/mcp`);
  console.log(`  Local LLM: llama3.2:3b (8k context window on Ollama)`);
  console.log(`==================================================\n`);
});
