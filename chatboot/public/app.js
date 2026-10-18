/**
 * LifeLink Health Assistant Client Application
 * Smooth SSE streaming, PDF attachment via Unstructured/PyMuPDF, Atomic MCP integration,
 * and live eRaktKosh Blood Donation Camps Near Me integration.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // Iframe / Embedded Panel Detection
  // When the chatbot is rendered inside FloatingChatbot.tsx (iframe at port 3000)
  // we apply compact CSS and route API calls to the correct origin.
  // =========================================================================
  const isEmbedded = window.self !== window.top || window.location.search.includes('embed=1');
  if (isEmbedded) {
    document.documentElement.classList.add('embedded');
  }

  // Dynamic API base: when embedded directly at localhost:3000, use '' (same-origin).
  // When accessed via the gateway at localhost:8090, also use '' (same-origin proxy handles it).
  const API_BASE = '';

  // Elements
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');
  const campBtn = document.getElementById('campBtn');
  const bloodStockBtn = document.getElementById('bloodStockBtn');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const messagesContainer = document.getElementById('messagesContainer');
  const emptyState = document.getElementById('emptyState');
  const uploadStatusBar = document.getElementById('uploadStatusBar');
  const uploadStatusText = document.getElementById('uploadStatusText');
  const clearUploadBtn = document.getElementById('clearUploadBtn');
  const starterSuggestions = document.getElementById('starterSuggestions');
  const docsDrawerBtn = document.getElementById('docsDrawerBtn');
  const docsDrawer = document.getElementById('docsDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerContent = document.getElementById('drawerContent');
  const docBadgeCount = document.getElementById('docBadgeCount');
  const atomicStatusPill = document.getElementById('atomicStatusPill');
  const ollamaStatusPill = document.getElementById('ollamaStatusPill');

  // State
  let conversationHistory = [];
  let isStreaming = false;
  let attachedDocuments = [];


  // =========================================================================
  // Maharashtra State & District Lookup (stateCode = 27 default)
  // =========================================================================
  const MAHARASHTRA_DISTRICTS = [
    { name: "Ahilyanagar", code: "522" },
    { name: "Akola", code: "501" },
    { name: "Amravati", code: "503" },
    { name: "Chhatrapati Sambhajinagar", code: "515" },
    { name: "Beed", code: "523" },
    { name: "Bhandara", code: "506" },
    { name: "Buldhana", code: "500" },
    { name: "Chandrapur", code: "509" },
    { name: "Dhule", code: "498" },
    { name: "Gadchiroli", code: "508" },
    { name: "Gondia", code: "507" },
    { name: "Hingoli", code: "512" },
    { name: "Jalgaon", code: "499" },
    { name: "Jalna", code: "514" },
    { name: "Kolhapur", code: "530" },
    { name: "Latur", code: "524" },
    { name: "Mumbai", code: "519" },
    { name: "Mumbai Suburban", code: "518" },
    { name: "Nagpur", code: "505" },
    { name: "Nanded", code: "511" },
    { name: "Nandurbar", code: "497" },
    { name: "Nashik", code: "516" },
    { name: "Dharashiv", code: "525" },
    { name: "Parbhani", code: "513" },
    { name: "Pune", code: "521" },
    { name: "Raigad", code: "520" },
    { name: "Ratnagiri", code: "528" },
    { name: "Sangli", code: "531" },
    { name: "Satara", code: "527" },
    { name: "Sindhudurg", code: "529" },
    { name: "Solapur", code: "526" },
    { name: "Thane", code: "517" },
    { name: "Wardha", code: "504" },
    { name: "Washim", code: "502" },
    { name: "Yavatmal", code: "510" }
  ];

  // Quick district shortcuts for prominent areas
  const POPULAR_DISTRICT_CODES = ["521", "519", "518", "517", "505", "516", "515"];

  // =========================================================================
  // Blood Groups Lookup (including Bombay Blood Groups Oh+ / Oh-)
  // =========================================================================
  const BLOOD_GROUPS = [
    { label: "A+Ve", id: "11" },
    { label: "A-Ve", id: "12" },
    { label: "B+Ve", id: "13" },
    { label: "B-Ve", id: "14" },
    { label: "AB+Ve", id: "17" },
    { label: "AB-Ve", id: "18" },
    { label: "O+Ve", id: "15" },
    { label: "O-Ve", id: "16" },
    { label: "Oh+VE (Bombay)", id: "22" },
    { label: "Oh-VE (Bombay)", id: "23" }
  ];

  // =========================================================================
  // Initial Status Check
  // =========================================================================
  async function checkSystemStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.atomic?.connected) {
          atomicStatusPill.querySelector('.status-dot').style.backgroundColor = '#4A6B5D';
          atomicStatusPill.querySelector('.status-text').textContent = 'Atomic Knowledge Graph (Ready)';
        } else {
          atomicStatusPill.querySelector('.status-dot').style.backgroundColor = '#B09B8B';
          atomicStatusPill.querySelector('.status-text').textContent = 'Atomic (Connecting...)';
        }

        if (data.ollama?.connected) {
          ollamaStatusPill.querySelector('.status-dot').style.backgroundColor = '#4A6B5D';
          ollamaStatusPill.querySelector('.status-text').textContent = 'Llama 3.2 (Ready)';
        } else {
          ollamaStatusPill.querySelector('.status-dot').style.backgroundColor = '#B09B8B';
          ollamaStatusPill.querySelector('.status-text').textContent = 'Llama (Connecting...)';
        }
      }
    } catch (e) {
      console.warn('System status check failed:', e);
    }
  }

  checkSystemStatus();
  setInterval(checkSystemStatus, 25000);

  // Load existing documents
  async function loadExistingDocs() {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        attachedDocuments = data.uploaded || [];
        updateDocsDrawer();
      }
    } catch (e) {
      console.warn('Load documents failed:', e);
    }
  }
  loadExistingDocs();

  // =========================================================================
  // Input Auto-Resize & Event Listeners
  // =========================================================================
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
    sendBtn.disabled = !chatInput.value.trim() || isStreaming;
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        sendMessage();
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) sendMessage();
  });

  // Suggestion chips handler
  if (starterSuggestions) {
    starterSuggestions.addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip && !isStreaming) {
        if (chip.getAttribute('data-action') === 'blood_availability') {
          openBloodAvailabilityFlow();
          return;
        }
        if (chip.getAttribute('data-action') === 'camps_near_me') {
          openCampsFlow();
          return;
        }
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          chatInput.value = prompt;
          chatInput.dispatchEvent(new Event('input'));
          sendMessage();
        }
      }
    });
  }

  // Camps Near Me Button in Input Bar
  if (campBtn) {
    campBtn.addEventListener('click', () => {
      if (!isStreaming) openCampsFlow();
    });
  }

  // Check Blood Stock Button in Input Bar
  if (bloodStockBtn) {
    bloodStockBtn.addEventListener('click', () => {
      if (!isStreaming) openBloodAvailabilityFlow();
    });
  }

  // =========================================================================
  // PDF Attachment & Upload Flow
  // =========================================================================
  attachBtn.addEventListener('click', () => {
    if (!isStreaming) pdfFileInput.click();
  });

  pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF document.');
      return;
    }

    uploadStatusBar.style.display = 'flex';
    uploadStatusText.textContent = `Converting "${file.name}" with Unstructured & indexing into Atomic...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        uploadStatusText.textContent = `Attached "${file.name}" — Synced to Atomic Knowledge Graph (${data.document.charCount} characters).`;
        attachedDocuments.unshift(data.document);
        updateDocsDrawer();

        if (emptyState) emptyState.remove();
        appendAssistantMessage(
          `I have received your document **"${file.name}"**.\n\n` +
          `It has been parsed using the Unstructured conversion pipeline and stored in Atomic's knowledge graph. ` +
          `You can now ask questions about the findings, metrics, or guidelines contained within it.`,
          null,
          'Document Appended'
        );
      } else {
        uploadStatusText.textContent = `Error: ${data.error || 'Failed to process PDF'}`;
      }
    } catch (err) {
      uploadStatusText.textContent = `Upload failed: ${err.message}`;
    } finally {
      pdfFileInput.value = '';
    }
  });

  clearUploadBtn.addEventListener('click', () => {
    uploadStatusBar.style.display = 'none';
  });

  // Drawer open/close
  docsDrawerBtn.addEventListener('click', () => {
    docsDrawer.classList.toggle('open');
    docsDrawer.setAttribute('aria-hidden', !docsDrawer.classList.contains('open'));
  });

  closeDrawerBtn.addEventListener('click', () => {
    docsDrawer.classList.remove('open');
    docsDrawer.setAttribute('aria-hidden', 'true');
  });

  function updateDocsDrawer() {
    if (attachedDocuments.length > 0) {
      docBadgeCount.textContent = attachedDocuments.length;
      docBadgeCount.style.display = 'inline-block';

      drawerContent.innerHTML = attachedDocuments.map(doc => `
        <div class="doc-item">
          <div class="doc-name">${escapeHtml(doc.filename)}</div>
          <div class="doc-meta">Engine: ${escapeHtml(doc.engine || 'unstructured')} &bull; ${doc.charCount || 0} chars</div>
          <span class="doc-tag">Indexed in Atomic</span>
        </div>
      `).join('');
    } else {
      docBadgeCount.style.display = 'none';
      drawerContent.innerHTML = `<p class="drawer-empty-text">No PDF records attached yet. Click the paperclip icon below to append medical tests, lab results, or health guidelines.</p>`;
    }
  }

  // =========================================================================
  // eRaktKosh "Camps Near Me" Reusable Client Functions
  // =========================================================================

  /**
   * Reusable function to fetch camp details from backend proxy / eRaktKosh
   */
  async function fetchCampDetails(stateCode = "27", districtCode, startDate, endDate) {
    const todayStr = getTodayDateStr();
    const start = startDate || todayStr;
    const end = endDate || start;
    const url = `/api/camps?stateCode=${encodeURIComponent(stateCode)}&districtCode=${encodeURIComponent(districtCode)}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `eRaktKosh service responded with status ${res.status}`);
    }
    return await res.json();
  }

  function getTodayDateStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getTomorrowDateStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function getNext7DaysDateStr() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Start the conversational Camps Near Me flow
   */
  function openCampsFlow(preselectedDistrictCode = "521") {
    if (emptyState) emptyState.remove();

    // User message representation
    const userTimestamp = formatTime(new Date());
    appendUserMessage("Check blood donation camps near me in Maharashtra", userTimestamp);

    // Assistant response with inline district & date picker
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const introText = document.createElement('p');
    introText.innerHTML = `I can help you locate live, verified blood donation camps across <strong>Maharashtra</strong> registered on the government's <strong>eRaktKosh</strong> portal. Select a district and date range to view active camps:`;
    bubble.appendChild(introText);

    // Build the interactive Picker Widget
    const widget = buildCampPickerWidget(preselectedDistrictCode, bubble);
    bubble.appendChild(widget);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = formatTime(new Date());

    assistantRow.appendChild(bubble);
    assistantRow.appendChild(meta);
    messagesContainer.appendChild(assistantRow);
    scrollToBottom();
  }

  /**
   * Build the District & Date Range Picker Component
   */
  function buildCampPickerWidget(defaultCode = "521", parentBubble) {
    const widget = document.createElement('div');
    widget.className = 'camp-picker-widget';

    let currentDistrictCode = defaultCode;
    let currentDateMode = 'today'; // 'today', 'tomorrow', 'week'

    // Header
    const header = document.createElement('div');
    header.className = 'camp-picker-header';
    header.innerHTML = `
      <div class="camp-picker-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2c-4 5-8 9-8 13a8 8 0 0 0 16 0c0-4-4-8-8-13z"/>
          <path d="M12 9v6m-3-3h6"/>
        </svg>
        <span>Select District & Date</span>
      </div>
      <span class="camp-source-tag">Maharashtra (stateCode: 27)</span>
    `;
    widget.appendChild(header);

    // Quick District Chips
    const districtGroup = document.createElement('div');
    districtGroup.className = 'camp-field-group';
    districtGroup.innerHTML = `<span class="camp-field-label">Quick Select District</span>`;

    const pillsRow = document.createElement('div');
    pillsRow.className = 'camp-pills-row';

    POPULAR_DISTRICT_CODES.forEach(code => {
      const dist = MAHARASHTRA_DISTRICTS.find(d => d.code === code);
      if (!dist) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `camp-chip ${code === currentDistrictCode ? 'active' : ''}`;
      chip.textContent = dist.name;
      chip.dataset.code = code;
      chip.addEventListener('click', () => {
        pillsRow.querySelectorAll('.camp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentDistrictCode = code;
        dropdownSelect.value = code;
      });
      pillsRow.appendChild(chip);
    });
    districtGroup.appendChild(pillsRow);
    widget.appendChild(districtGroup);

    // Dropdown for all 35 districts
    const dropdownGroup = document.createElement('div');
    dropdownGroup.className = 'camp-field-group';
    dropdownGroup.innerHTML = `<span class="camp-field-label">Or Choose From All 35 Districts</span>`;

    const dropdownSelect = document.createElement('select');
    dropdownSelect.className = 'camp-district-select';

    MAHARASHTRA_DISTRICTS.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist.code;
      opt.textContent = `${dist.name} (Code: ${dist.code})`;
      if (dist.code === currentDistrictCode) opt.selected = true;
      dropdownSelect.appendChild(opt);
    });

    dropdownSelect.addEventListener('change', (e) => {
      currentDistrictCode = e.target.value;
      pillsRow.querySelectorAll('.camp-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.code === currentDistrictCode);
      });
    });

    dropdownGroup.appendChild(dropdownSelect);
    widget.appendChild(dropdownGroup);

    // Date Range Selection
    const dateGroup = document.createElement('div');
    dateGroup.className = 'camp-field-group';
    dateGroup.innerHTML = `<span class="camp-field-label">Date Range</span>`;

    const dateRow = document.createElement('div');
    dateRow.className = 'camp-pills-row';

    const dateOptions = [
      { id: 'today', label: 'Today' },
      { id: 'tomorrow', label: 'Tomorrow' },
      { id: 'week', label: 'Next 7 Days' }
    ];

    dateOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `camp-chip ${opt.id === currentDateMode ? 'active' : ''}`;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        dateRow.querySelectorAll('.camp-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDateMode = opt.id;
      });
      dateRow.appendChild(btn);
    });

    dateGroup.appendChild(dateRow);
    widget.appendChild(dateGroup);

    // Action Search Button
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'camp-submit-btn';
    searchBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Find Live Camps</span>
    `;

    searchBtn.addEventListener('click', () => {
      executeCampSearch(currentDistrictCode, currentDateMode, widget, parentBubble);
    });

    widget.appendChild(searchBtn);
    return widget;
  }

  /**
   * Execute Search, display loading state, and render results or edge cases
   */
  async function executeCampSearch(districtCode, dateMode, widgetElement, parentBubble) {
    let startDate = getTodayDateStr();
    let endDate = startDate;
    let dateLabel = "Today";

    if (dateMode === 'tomorrow') {
      startDate = getTomorrowDateStr();
      endDate = startDate;
      dateLabel = "Tomorrow";
    } else if (dateMode === 'week') {
      startDate = getTodayDateStr();
      endDate = getNext7DaysDateStr();
      dateLabel = "Next 7 Days";
    }

    const districtObj = MAHARASHTRA_DISTRICTS.find(d => d.code === districtCode);
    const districtName = districtObj ? districtObj.name : districtCode;

    // Show calm loading state inside the widget
    widgetElement.innerHTML = `
      <div class="camp-loading-box">
        <span class="thinking-pulse-dot"></span>
        <span class="camp-loading-text">Looking for blood donation camps in <strong>${escapeHtml(districtName)}</strong> for ${dateLabel} on eRaktKosh...</span>
      </div>
    `;
    scrollToBottom();

    try {
      const data = await fetchCampDetails("27", districtCode, startDate, endDate);
      const camps = data.camps || [];

      if (camps.length > 0) {
        renderCampResults(camps, districtName, dateLabel, startDate, endDate, widgetElement);
      } else {
        renderCampEmpty(districtName, dateLabel, districtCode, widgetElement, parentBubble);
      }
    } catch (err) {
      renderCampError(err.message, districtCode, dateMode, widgetElement, parentBubble);
    }
    scrollToBottom();
  }

  /**
   * Render structured CampCards
   */
  function renderCampResults(camps, districtName, dateLabel, startDate, endDate, container) {
    const banner = `
      <div class="camp-results-banner">
        <span>Showing <strong>${camps.length}</strong> active camp${camps.length > 1 ? 's' : ''} in <strong>${escapeHtml(districtName)}</strong> (${escapeHtml(dateLabel)})</span>
        <span class="camp-results-badge">Live eRaktKosh</span>
      </div>
    `;

    const cardsHtml = camps.map(camp => renderSingleCampCard(camp)).join('');

    container.innerHTML = `
      ${banner}
      <div class="camp-list">
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * Render a single CampCard with strict handling for partial/missing fields
   */
  function renderSingleCampCard(camp) {
    const campName = camp.campName && camp.campName.trim() ? camp.campName.trim() : "Blood Donation Camp";
    const date = camp.campDate || "";
    const time = camp.campTime && camp.campTime.trim() !== "-" ? camp.campTime.trim() : "";
    const dateTimeStr = [date, time].filter(Boolean).join(" &bull; ");

    const venue = camp.campVenue && camp.campVenue.trim() && camp.campVenue.trim() !== "-" ? camp.campVenue.trim() : "";
    const contact = camp.contact && camp.contact.trim() && camp.contact.trim() !== "-" && camp.contact.trim() !== "0" ? camp.contact.trim() : "";
    const conductedBy = camp.conductedBy && camp.conductedBy.trim() && camp.conductedBy.trim() !== "-" ? camp.conductedBy.trim() : "";
    const hospName = camp.hospName && camp.hospName.trim() && camp.hospName.trim() !== "-" ? camp.hospName.trim() : "";
    const reqNo = camp.campReqNo ? `#${camp.campReqNo}` : "";

    return `
      <article class="camp-card">
        <div class="camp-card-top">
          <h4 class="camp-card-title">${escapeHtml(campName)}</h4>
          <span class="camp-verified-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2c-4 5-8 9-8 13a8 8 0 0 0 16 0c0-4-4-8-8-13z"/>
            </svg>
            <span>${reqNo ? escapeHtml(reqNo) : 'Verified Camp'}</span>
          </span>
        </div>

        <div class="camp-meta-grid">
          ${dateTimeStr ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <div class="camp-detail-text"><strong>Date & Time:</strong> ${escapeHtml(dateTimeStr)}</div>
            </div>
          ` : ''}

          ${venue ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div class="camp-detail-text"><strong>Venue:</strong> ${escapeHtml(venue)}</div>
            </div>
          ` : ''}

          ${conductedBy ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <div class="camp-detail-text"><strong>Organized By:</strong> ${escapeHtml(conductedBy)}</div>
            </div>
          ` : ''}

          ${hospName ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18"/>
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
                <line x1="12" y1="6" x2="12" y2="12"/>
              </svg>
              <div class="camp-detail-text"><strong>Blood Centre:</strong> ${escapeHtml(hospName)}</div>
            </div>
          ` : ''}

          ${contact ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <div class="camp-detail-text">
                <strong>Contact:</strong> 
                <a href="tel:${escapeHtml(contact)}" class="camp-phone-link">${escapeHtml(contact)}</a>
              </div>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Render Graceful Empty State
   */
  function renderCampEmpty(districtName, dateLabel, districtCode, container, parentBubble) {
    container.innerHTML = `
      <div class="camp-empty-box">
        <svg class="camp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <h4 class="camp-empty-title">No camps found nearby for ${escapeHtml(dateLabel)}</h4>
        <p class="camp-empty-desc">
          There are currently no registered blood donation camps in <strong>${escapeHtml(districtName)}</strong> for this timeframe.
          Donation camps are frequently held over weekends or scheduled a few days in advance.
        </p>
        <div class="camp-empty-actions">
          <button type="button" class="camp-empty-btn" id="checkWeekBtn">Check Next 7 Days</button>
          <button type="button" class="camp-empty-btn" id="resetPickerBtn">Choose Another District</button>
        </div>
      </div>
    `;

    container.querySelector('#checkWeekBtn').addEventListener('click', () => {
      executeCampSearch(districtCode, 'week', container, parentBubble);
    });

    container.querySelector('#resetPickerBtn').addEventListener('click', () => {
      container.replaceWith(buildCampPickerWidget(districtCode, parentBubble));
    });
  }

  /**
   * Render Error & Retry State
   */
  function renderCampError(errorMessage, districtCode, dateMode, container, parentBubble) {
    container.innerHTML = `
      <div class="camp-empty-box">
        <svg class="camp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h4 class="camp-empty-title">Unable to connect to eRaktKosh</h4>
        <p class="camp-empty-desc">${escapeHtml(errorMessage)}. The government portal may be busy or experiencing intermittent connectivity.</p>
        <div class="camp-empty-actions">
          <button type="button" class="camp-empty-btn" id="retryCampBtn">Try Again</button>
          <button type="button" class="camp-empty-btn" id="resetErrorPickerBtn">Change District</button>
        </div>
      </div>
    `;

    container.querySelector('#retryCampBtn').addEventListener('click', () => {
      executeCampSearch(districtCode, dateMode, container, parentBubble);
    });

    container.querySelector('#resetErrorPickerBtn').addEventListener('click', () => {
      container.replaceWith(buildCampPickerWidget(districtCode, parentBubble));
    });
  }

  // =========================================================================
  // eRaktKosh "Check Blood Availability" Client Implementation
  // =========================================================================

  /**
   * Reusable function to fetch blood availability from backend proxy / eRaktKosh
   */
  async function fetchBloodAvailability(stateCode = "27", districtId, componentId = "12", bloodGroupId = "11") {
    const url = `/api/blood-availability?stateCode=${encodeURIComponent(stateCode)}&districtId=${encodeURIComponent(districtId)}&componentId=${encodeURIComponent(componentId)}&bloodGroupId=${encodeURIComponent(bloodGroupId)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `eRaktKosh service responded with status ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Start the conversational Check Blood Availability flow
   */
  function openBloodAvailabilityFlow(preselectedDistrictCode = "521", preselectedBloodGroupId = "11", preselectedComponentId = "12") {
    if (emptyState) emptyState.remove();

    // User message representation
    const userTimestamp = formatTime(new Date());
    appendUserMessage("Check live blood availability in Maharashtra (eRaktKosh)", userTimestamp);

    // Assistant response with inline blood group, district & component picker
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const introText = document.createElement('p');
    introText.innerHTML = `I can check real-time blood bank stock across licensed centres in <strong>Maharashtra</strong> directly from the government's <strong>eRaktKosh</strong> portal. Select your blood group and district to view current inventory:`;
    bubble.appendChild(introText);

    // Build the interactive Blood Picker Widget
    const widget = buildBloodPickerWidget(preselectedDistrictCode, preselectedBloodGroupId, preselectedComponentId, bubble);
    bubble.appendChild(widget);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = formatTime(new Date());

    assistantRow.appendChild(bubble);
    assistantRow.appendChild(meta);
    messagesContainer.appendChild(assistantRow);
    scrollToBottom();
  }

  /**
   * Build the Blood Group, District & Component Picker Component
   */
  function buildBloodPickerWidget(defaultDistrictCode = "521", defaultBloodGroupId = "11", defaultComponentId = "12", parentBubble) {
    const widget = document.createElement('div');
    widget.className = 'camp-picker-widget';

    let currentDistrictCode = defaultDistrictCode;
    let currentBloodGroupId = defaultBloodGroupId;
    let currentComponentId = defaultComponentId;

    // Header
    const header = document.createElement('div');
    header.className = 'camp-picker-header';
    header.innerHTML = `
      <div class="camp-picker-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2c-4 5-8 9-8 13a8 8 0 0 0 16 0c0-4-4-8-8-13z"/>
          <circle cx="12" cy="14" r="2.5"/>
        </svg>
        <span>Check Blood Availability</span>
      </div>
      <span class="camp-source-tag">Maharashtra (stateCode: 27)</span>
    `;
    widget.appendChild(header);

    // 1. Blood Group Chips (all 10 groups including Bombay Oh+/Oh-)
    const bgGroup = document.createElement('div');
    bgGroup.className = 'camp-field-group';
    bgGroup.innerHTML = `<span class="camp-field-label">1. Blood Group (Includes Bombay Groups)</span>`;

    const bgPillsRow = document.createElement('div');
    bgPillsRow.className = 'camp-pills-row';

    BLOOD_GROUPS.forEach(bg => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `camp-chip ${bg.id === currentBloodGroupId ? 'active' : ''}`;
      chip.textContent = bg.label;
      chip.dataset.id = bg.id;
      chip.addEventListener('click', () => {
        bgPillsRow.querySelectorAll('.camp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentBloodGroupId = bg.id;
      });
      bgPillsRow.appendChild(chip);
    });
    bgGroup.appendChild(bgPillsRow);
    widget.appendChild(bgGroup);

    // 2. District Selection (Reusing Maharashtra 35 districts lookup)
    const districtGroup = document.createElement('div');
    districtGroup.className = 'camp-field-group';
    districtGroup.innerHTML = `<span class="camp-field-label">2. District (Maharashtra)</span>`;

    const distPillsRow = document.createElement('div');
    distPillsRow.className = 'camp-pills-row';

    POPULAR_DISTRICT_CODES.forEach(code => {
      const dist = MAHARASHTRA_DISTRICTS.find(d => d.code === code);
      if (!dist) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `camp-chip ${code === currentDistrictCode ? 'active' : ''}`;
      chip.textContent = dist.name;
      chip.dataset.code = code;
      chip.addEventListener('click', () => {
        distPillsRow.querySelectorAll('.camp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentDistrictCode = code;
        distDropdownSelect.value = code;
      });
      distPillsRow.appendChild(chip);
    });
    districtGroup.appendChild(distPillsRow);

    const distDropdownSelect = document.createElement('select');
    distDropdownSelect.className = 'camp-district-select';
    distDropdownSelect.style.marginTop = '6px';

    MAHARASHTRA_DISTRICTS.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist.code;
      opt.textContent = `${dist.name} (Code: ${dist.code})`;
      if (dist.code === currentDistrictCode) opt.selected = true;
      distDropdownSelect.appendChild(opt);
    });

    distDropdownSelect.addEventListener('change', (e) => {
      currentDistrictCode = e.target.value;
      distPillsRow.querySelectorAll('.camp-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.code === currentDistrictCode);
      });
    });

    districtGroup.appendChild(distDropdownSelect);
    widget.appendChild(districtGroup);

    // 3. Blood Component Selection (PRBC: 12 default, Whole Blood: 11)
    const compGroup = document.createElement('div');
    compGroup.className = 'camp-field-group';
    compGroup.innerHTML = `<span class="camp-field-label">3. Component (PRBC is standard transfusion stock)</span>`;

    const compPillsRow = document.createElement('div');
    compPillsRow.className = 'camp-pills-row';

    const compOptions = [
      { id: "12", label: "Packed Red Blood Cells (PRBC - Recommended)" },
      { id: "11", label: "Whole Blood" }
    ];

    compOptions.forEach(opt => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `camp-chip ${opt.id === currentComponentId ? 'active' : ''}`;
      chip.textContent = opt.label;
      chip.dataset.id = opt.id;
      chip.addEventListener('click', () => {
        compPillsRow.querySelectorAll('.camp-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentComponentId = opt.id;
      });
      compPillsRow.appendChild(chip);
    });
    compGroup.appendChild(compPillsRow);
    widget.appendChild(compGroup);

    // Submit Button
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'camp-submit-btn';
    searchBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Check Live Availability</span>
    `;

    searchBtn.addEventListener('click', () => {
      executeBloodSearch(currentDistrictCode, currentBloodGroupId, currentComponentId, widget, parentBubble);
    });

    widget.appendChild(searchBtn);
    return widget;
  }

  /**
   * Execute Blood Availability search, display calm loading state, and render results/edge-cases
   */
  async function executeBloodSearch(districtCode, bloodGroupId, componentId, widgetElement, parentBubble) {
    const districtObj = MAHARASHTRA_DISTRICTS.find(d => d.code === districtCode);
    const districtName = districtObj ? districtObj.name : districtCode;
    const bgObj = BLOOD_GROUPS.find(b => b.id === bloodGroupId);
    const bgLabel = bgObj ? bgObj.label : bloodGroupId;

    // Show calm loading state inside the widget
    widgetElement.innerHTML = `
      <div class="camp-loading-box">
        <span class="thinking-pulse-dot"></span>
        <span class="camp-loading-text">Checking real-time blood stock for <strong>${escapeHtml(bgLabel)}</strong> in <strong>${escapeHtml(districtName)}</strong> on eRaktKosh...</span>
      </div>
    `;
    scrollToBottom();

    try {
      const data = await fetchBloodAvailability("27", districtCode, componentId, bloodGroupId);
      const banks = data.banks || [];

      if (banks.length > 0) {
        if (data.totalAvailableUnits > 0 || data.banksWithStock > 0) {
          renderBloodStockResults(data, widgetElement, parentBubble);
        } else {
          // Zero units reported across all blood banks in this district
          renderBloodZeroUnits(data, widgetElement, parentBubble);
        }
      } else {
        // Zero banks registered in this district
        renderBloodEmptyState(bgLabel, districtName, districtCode, bloodGroupId, componentId, widgetElement, parentBubble);
      }
    } catch (err) {
      renderBloodError(err.message, districtCode, bloodGroupId, componentId, widgetElement, parentBubble);
    }
    scrollToBottom();
  }

  /**
   * Render Blood Bank Cards with stock highlights and medical disclaimer
   */
  function renderBloodStockResults(data, container, parentBubble) {
    const banner = `
      <div class="camp-results-banner">
        <span>Found <strong>${data.banksWithStock}</strong> blood bank${data.banksWithStock > 1 ? 's' : ''} reporting <strong>${data.totalAvailableUnits} available unit${data.totalAvailableUnits > 1 ? 's' : ''}</strong> of <strong>${escapeHtml(data.bloodGroupLabel)}</strong> in <strong>${escapeHtml(data.districtName)}</strong></span>
        <span class="camp-results-badge">Live eRaktKosh</span>
      </div>
    `;

    const disclaimer = `
      <div class="blood-disclaimer-box">
        <svg class="blood-disclaimer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>Important Clinical & Travel Notice:</strong> Blood availability data updates periodically and may not reflect real-time hospital stock or reserved emergency units. <em>Always call the blood bank directly before traveling</em> to verify availability, especially for urgent or emergency needs.
        </div>
      </div>
    `;

    const cardsHtml = data.banks.map(bank => renderSingleBloodBankCard(bank)).join('');

    container.innerHTML = `
      ${banner}
      ${disclaimer}
      <div class="camp-list">
        ${cardsHtml}
      </div>
      <div class="camp-empty-actions" style="margin-top: 14px;">
        <button type="button" class="camp-empty-btn" id="checkAnotherDistrictBtn">Check Another District or Blood Group</button>
      </div>
    `;

    container.querySelector('#checkAnotherDistrictBtn').addEventListener('click', () => {
      container.replaceWith(buildBloodPickerWidget(data.districtId, data.bloodGroupId, data.componentId, parentBubble));
    });
  }

  /**
   * Render a single Blood Bank Stock Card with calm status colors
   */
  function renderSingleBloodBankCard(bank) {
    const bankName = bank.hospitalName && bank.hospitalName.trim() ? bank.hospitalName.trim() : "Licensed Blood Centre";
    const address = bank.address && bank.address.trim() && bank.address.trim() !== "-" ? bank.address.trim() : "";
    const contact = bank.contact && bank.contact.trim() && bank.contact.trim() !== "-" && bank.contact.trim() !== "0" ? bank.contact.trim() : "";
    const primaryPhone = contact ? contact.split(/[,/;]/)[0].trim().replace(/[^\d+]/g, '') : "";
    const type = bank.type && bank.type.trim() ? bank.type.trim() : "Blood Bank";
    const lastUpdated = bank.lastUpdated && bank.lastUpdated.trim() ? bank.lastUpdated.trim() : "";
    const componentName = bank.componentName || "Packed Red Blood Cells";

    // Calm palette: sage green for available, muted gray for 0 (no alarming red/green)
    const stockBadge = bank.isAvailable
      ? `<span class="blood-stock-badge available">● ${bank.availableUnits} Units Available</span>`
      : `<span class="blood-stock-badge none">○ 0 Units Reported</span>`;

    return `
      <article class="camp-card">
        <div class="camp-card-top">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <h4 class="camp-card-title">${escapeHtml(bankName)}</h4>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="blood-type-tag">${escapeHtml(type)}</span>
              <span class="blood-component-pill">${escapeHtml(componentName)}</span>
            </div>
          </div>
          <div>
            ${stockBadge}
          </div>
        </div>

        <div class="camp-meta-grid">
          ${address ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div class="camp-detail-text"><strong>Address:</strong> ${escapeHtml(address)}</div>
            </div>
          ` : ''}

          ${contact ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <div class="camp-detail-text">
                <strong>Contact:</strong> 
                <a href="tel:${escapeHtml(primaryPhone || contact)}" class="camp-phone-link">${escapeHtml(contact)}</a>
              </div>
            </div>
          ` : ''}

          ${lastUpdated ? `
            <div class="camp-detail-item">
              <svg class="camp-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <div class="camp-detail-text"><strong>Last Reported:</strong> ${escapeHtml(lastUpdated)}</div>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Render edge case where banks are reported but all show 0 units
   */
  function renderBloodZeroUnits(data, container, parentBubble) {
    const disclaimer = `
      <div class="blood-disclaimer-box">
        <svg class="blood-disclaimer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>Important Clinical & Travel Notice:</strong> Blood availability data updates periodically and may not reflect real-time hospital stock. <em>Always call the blood bank directly before traveling</em>, especially for urgent or emergency needs.
        </div>
      </div>
    `;

    const cardsHtml = data.banks.map(bank => renderSingleBloodBankCard(bank)).join('');

    container.innerHTML = `
      <div class="camp-empty-box" style="margin-bottom: 14px;">
        <svg class="camp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <h4 class="camp-empty-title">No units currently reported for ${escapeHtml(data.bloodGroupLabel)} in ${escapeHtml(data.districtName)}</h4>
        <p class="camp-empty-desc">
          Try a nearby district or call the state blood helpline (<strong>104</strong>) or national blood helpline (<strong>1910</strong>). You can also call the local blood centres below directly to verify unlogged emergency stock or incoming donations.
        </p>
        <div class="camp-empty-actions">
          <button type="button" class="camp-empty-btn" id="tryNearbyDistrictBtn">Try Another District</button>
          <button type="button" class="camp-empty-btn" id="changeGroupBtn">Change Blood Group</button>
        </div>
      </div>
      ${disclaimer}
      <div class="camp-list">
        ${cardsHtml}
      </div>
    `;

    container.querySelector('#tryNearbyDistrictBtn').addEventListener('click', () => {
      container.replaceWith(buildBloodPickerWidget(data.districtId, data.bloodGroupId, data.componentId, parentBubble));
    });

    container.querySelector('#changeGroupBtn').addEventListener('click', () => {
      container.replaceWith(buildBloodPickerWidget(data.districtId, data.bloodGroupId, data.componentId, parentBubble));
    });
  }

  /**
   * Render edge case where 0 blood banks are found in the district
   */
  function renderBloodEmptyState(bloodGroupLabel, districtName, districtCode, bloodGroupId, componentId, container, parentBubble) {
    container.innerHTML = `
      <div class="camp-empty-box">
        <svg class="camp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <h4 class="camp-empty-title">No units currently reported for ${escapeHtml(bloodGroupLabel)} in ${escapeHtml(districtName)}</h4>
        <p class="camp-empty-desc">
          There are no licensed blood centres reporting stock in <strong>${escapeHtml(districtName)}</strong> at this time. Try a nearby district or call the state blood helpline (<strong>104</strong>) or national helpline (<strong>1910</strong>).
        </p>
        <div class="camp-empty-actions">
          <button type="button" class="camp-empty-btn" id="resetBloodPickerBtn">Try Another District</button>
        </div>
      </div>
    `;

    container.querySelector('#resetBloodPickerBtn').addEventListener('click', () => {
      container.replaceWith(buildBloodPickerWidget(districtCode, bloodGroupId, componentId, parentBubble));
    });
  }

  /**
   * Render API failure with retry option
   */
  function renderBloodError(errorMessage, districtCode, bloodGroupId, componentId, container, parentBubble) {
    container.innerHTML = `
      <div class="camp-empty-box">
        <svg class="camp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h4 class="camp-empty-title">Unable to connect to eRaktKosh</h4>
        <p class="camp-empty-desc">${escapeHtml(errorMessage)}. The eRaktKosh blood availability portal may be busy or experiencing intermittent connectivity.</p>
        <div class="camp-empty-actions">
          <button type="button" class="camp-empty-btn" id="retryBloodBtn">Try Again</button>
          <button type="button" class="camp-empty-btn" id="changeBloodPickerBtn">Change District</button>
        </div>
      </div>
    `;

    container.querySelector('#retryBloodBtn').addEventListener('click', () => {
      executeBloodSearch(districtCode, bloodGroupId, componentId, container, parentBubble);
    });

    container.querySelector('#changeBloodPickerBtn').addEventListener('click', () => {
      container.replaceWith(buildBloodPickerWidget(districtCode, bloodGroupId, componentId, parentBubble));
    });
  }

  // =========================================================================
  // Messaging & Streaming Flow
  // =========================================================================
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isStreaming) return;

    // Check if query is asking for blood availability / stock
    const lower = text.toLowerCase();
    if (
      lower.includes('blood availability') ||
      lower.includes('blood stock') ||
      lower.includes('check blood') ||
      lower.includes('blood units') ||
      lower.includes('blood bank stock') ||
      lower.includes('available blood') ||
      ((lower.includes('blood') || lower.includes('plasma') || lower.includes('prbc')) && (lower.includes('available') || lower.includes('availability') || lower.includes('stock') || lower.includes('shortage') || lower.includes('need')))
    ) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
      // Match district if mentioned
      const matchedDist = MAHARASHTRA_DISTRICTS.find(d => lower.includes(d.name.toLowerCase()));
      // Match blood group if mentioned
      let matchedBg = null;
      if (lower.includes('a+') || lower.includes('a +') || lower.includes('a positive') || lower.includes('a+ve')) matchedBg = "11";
      else if (lower.includes('a-') || lower.includes('a -') || lower.includes('a negative') || lower.includes('a-ve')) matchedBg = "12";
      else if (lower.includes('b+') || lower.includes('b +') || lower.includes('b positive') || lower.includes('b+ve')) matchedBg = "13";
      else if (lower.includes('b-') || lower.includes('b -') || lower.includes('b negative') || lower.includes('b-ve')) matchedBg = "14";
      else if (lower.includes('ab+') || lower.includes('ab +') || lower.includes('ab positive') || lower.includes('ab+ve')) matchedBg = "17";
      else if (lower.includes('ab-') || lower.includes('ab -') || lower.includes('ab negative') || lower.includes('ab-ve')) matchedBg = "18";
      else if (lower.includes('o+') || lower.includes('o +') || lower.includes('o positive') || lower.includes('o+ve')) matchedBg = "15";
      else if (lower.includes('o-') || lower.includes('o -') || lower.includes('o negative') || lower.includes('o-ve')) matchedBg = "16";
      else if (lower.includes('bombay') || lower.includes('oh+') || lower.includes('oh +') || lower.includes('oh+ve')) matchedBg = "22";
      else if (lower.includes('oh-') || lower.includes('oh -') || lower.includes('oh-ve')) matchedBg = "23";

      openBloodAvailabilityFlow(matchedDist ? matchedDist.code : "521", matchedBg || "11");
      return;
    }

    // Check if query is asking for blood donation camps
    if (
      lower.includes('camp near') ||
      lower.includes('camps near') ||
      lower.includes('blood donation camp') ||
      lower.includes('blood camp') ||
      lower.includes('raktkosh') ||
      (lower.includes('camps') && (lower.includes('blood') || lower.includes('donation')))
    ) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
      // Find if user mentioned a specific district in text
      const matched = MAHARASHTRA_DISTRICTS.find(d => lower.includes(d.name.toLowerCase()));
      openCampsFlow(matched ? matched.code : "521");
      return;
    }

    if (emptyState) {
      emptyState.remove();
    }

    // Append User Message
    const userTimestamp = formatTime(new Date());
    appendUserMessage(text, userTimestamp);
    conversationHistory.push({ role: 'user', content: text });

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    isStreaming = true;

    // Append Assistant Message with Calm Thinking State
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Thinking indicator
    const thinkingElem = document.createElement('div');
    thinkingElem.className = 'thinking-indicator';
    thinkingElem.innerHTML = `<span class="thinking-pulse-dot"></span><span>Reflecting on health records & knowledge...</span>`;
    bubble.appendChild(thinkingElem);

    assistantRow.appendChild(bubble);
    messagesContainer.appendChild(assistantRow);
    scrollToBottom();

    let fullResponseText = '';
    let contextBadge = null;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'context') {
              if (event.contextCount > 0 && !contextBadge) {
                contextBadge = document.createElement('div');
                contextBadge.className = 'context-source-badge';
                contextBadge.innerHTML = `
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6c-3 3-3 8 0 12"/>
                  </svg>
                  <span>Informed by Atomic Knowledge Graph (${event.contextCount} notes)</span>
                `;
              }
            } else if (event.type === 'chunk') {
              if (thinkingElem.parentNode) {
                thinkingElem.remove();
                if (contextBadge) bubble.appendChild(contextBadge);
              }
              fullResponseText += event.text;
              renderMarkdownContent(bubble, fullResponseText, contextBadge);
              scrollToBottom();
            } else if (event.type === 'done') {
              if (thinkingElem.parentNode) {
                thinkingElem.remove();
                if (contextBadge) bubble.appendChild(contextBadge);
              }
              fullResponseText = event.fullText || fullResponseText;
              renderMarkdownContent(bubble, fullResponseText, contextBadge);
              conversationHistory.push({ role: 'assistant', content: fullResponseText });
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Stream error');
            }
          } catch (e) {
            // json parse error
          }
        }
      }

      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = formatTime(new Date());
      assistantRow.appendChild(meta);

    } catch (err) {
      if (thinkingElem.parentNode) thinkingElem.remove();
      bubble.innerHTML = `<p style="color: #878278;">I experienced an issue retrieving the response: ${escapeHtml(err.message)}. Please try again or rephrase your question.</p>`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = !chatInput.value.trim();
      scrollToBottom();
    }
  }

  function appendUserMessage(text, timestamp) {
    const row = document.createElement('div');
    row.className = 'message-row user-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = timestamp;

    row.appendChild(bubble);
    row.appendChild(meta);
    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  function appendAssistantMessage(text, timestamp = null, badgeTitle = null) {
    const row = document.createElement('div');
    row.className = 'message-row assistant-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (badgeTitle) {
      const badge = document.createElement('div');
      badge.className = 'context-source-badge';
      badge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${escapeHtml(badgeTitle)}</span>
      `;
      bubble.appendChild(badge);
    }

    renderMarkdownContent(bubble, text);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = timestamp || formatTime(new Date());

    row.appendChild(bubble);
    row.appendChild(meta);
    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  // =========================================================================
  // Lightweight Humanist Markdown Renderer
  // =========================================================================
  function renderMarkdownContent(container, rawMarkdown, badgeElement = null) {
    const contentContainer = document.createElement('div');

    const lines = rawMarkdown.split('\n');
    let html = '';
    let inList = false;
    let listType = 'ul';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Detect Suggestion block / lifestyle tips
      if (/^(suggestions?|lifestyle suggestions?|wellness tips?|actionable steps?):/i.test(line.trim())) {
        if (inList) { html += `</${listType}>`; inList = false; }
        html += `<div class="suggestion-block"><span class="suggestion-block-title">Supportive Suggestions</span>`;
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        if (inList) { html += `</${listType}>`; inList = false; }
        html += `<h4>${formatInline(line.slice(4))}</h4>`;
      } else if (line.startsWith('## ') || line.startsWith('# ')) {
        if (inList) { html += `</${listType}>`; inList = false; }
        html += `<h3>${formatInline(line.replace(/^#+\s*/, ''))}</h3>`;
      }
      // Unordered list
      else if (/^[-*•]\s+/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; listType = 'ul'; }
        html += `<li>${formatInline(line.replace(/^[-*•]\s+/, ''))}</li>`;
      }
      // Ordered list
      else if (/^\d+\.\s+/.test(line)) {
        if (!inList) { html += '<ol>'; inList = true; listType = 'ol'; }
        html += `<li>${formatInline(line.replace(/^\d+\.\s+/, ''))}</li>`;
      }
      // Empty line
      else if (!line.trim()) {
        if (inList) { html += `</${listType}>`; inList = false; }
      }
      // Standard Paragraph
      else {
        if (inList) { html += `</${listType}>`; inList = false; }
        html += `<p>${formatInline(line)}</p>`;
      }
    }

    if (inList) { html += `</${listType}>`; }

    if (html.includes('<div class="suggestion-block">') && !html.endsWith('</div>')) {
      html += '</div>';
    }

    contentContainer.innerHTML = html;

    container.innerHTML = '';
    if (badgeElement) container.appendChild(badgeElement);
    container.appendChild(contentContainer);
  }

  function formatInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code style="background: #EBE5DB; padding: 2px 5px; border-radius: 4px; font-size: 0.85em;">$1</code>');
    return s;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    const workspace = document.getElementById('chatWorkspace');
    workspace.scrollTop = workspace.scrollHeight;
  }
});
