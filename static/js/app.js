// ═══════════════════════════════════════
//   VoiceForge — Frontend Logic
// ═══════════════════════════════════════

let referenceAudioFilename = null;
let selectedLang = 'en';
let isSynthesizing = false;

// ── Init ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  setupUploadZone();
  setupLangButtons();
  setupTextarea();
  loadOutputs();
  setInterval(checkStatus, 15000);
});

// ── Status ────────────────────────────
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const badge = document.getElementById('statusBadge');
    const text = document.getElementById('statusText');
    const banner = document.getElementById('setupBanner');

    if (data.tts_available) {
      badge.className = 'status-badge ready';
      text.textContent = `${data.model} · Ready`;
      banner.style.display = 'none';
    } else {
      badge.className = 'status-badge error';
      text.textContent = 'TTS Unavailable';
      banner.style.display = 'block';
    }
  } catch (e) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'status-badge error';
    document.getElementById('statusText').textContent = 'Server Offline';
  }
}

// ── Upload Zone ───────────────────────
function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });

  zone.addEventListener('click', e => {
    if (!e.target.closest('.upload-preview')) {
      input.click();
    }
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleFileUpload(input.files[0]);
  });
}

async function loadVoices() {
    const res = await fetch("/list-voices");
    const files = await res.json();

    const select = document.getElementById("voiceSelect");

    files.forEach(file => {
        const option = document.createElement("option");
        option.value = file;
        option.textContent = file;
        select.appendChild(option);
    });
}

window.onload = loadVoices;

async function handleFileUpload(file) {
  const allowed = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'webm'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showToast('Unsupported file type. Use WAV, MP3, OGG, FLAC, M4A, or WEBM.', 'error');
    return;
  }

  const zone = document.getElementById('uploadZone');
  zone.style.opacity = '0.6';
  zone.style.pointerEvents = 'none';
  showToast('Uploading and processing audio...', '');

  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      referenceAudioFilename = data.filename;
      showPreview(file.name, data.path);
      showToast('Reference audio ready!', 'success');
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (e) {
    showToast('Upload failed. Is the server running?', 'error');
  } finally {
    zone.style.opacity = '1';
    zone.style.pointerEvents = '';
  }
}

function showPreview(filename, audioPath) {
  document.getElementById('uploadInner').style.display = 'none';
  const preview = document.getElementById('uploadPreview');
  preview.style.display = 'block';
  document.getElementById('previewName').textContent = filename;
  const audio = document.getElementById('referenceAudio');
  audio.src = audioPath;
}

function clearReference() {
  referenceAudioFilename = null;
  document.getElementById('uploadInner').style.display = '';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('referenceAudio').src = '';
  document.getElementById('fileInput').value = '';
  showToast('Reference audio cleared', '');
}

// ── Language ──────────────────────────
function setupLangButtons() {
  document.getElementById('langGrid').addEventListener('click', e => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLang = btn.dataset.lang;
  });
}

// ── Textarea ──────────────────────────
function setupTextarea() {
  const ta = document.getElementById('synthText');
  ta.addEventListener('input', () => {
    document.getElementById('charCount').textContent = ta.value.length;
  });
  ta.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') synthesize();
  });
}

// ── Synthesize ────────────────────────
async function synthesize() {
  if (isSynthesizing) return;

  const text = document.getElementById('synthText').value.trim();
  const btn = document.getElementById('synthBtn');
  const btnText = document.getElementById('synthBtnText');

  if (!referenceAudioFilename) {
    showToast('Please upload a reference audio first', 'error');
    return;
  }
  if (!text) {
    showToast('Please enter some text to synthesize', 'error');
    document.getElementById('synthText').focus();
    return;
  }
  if (text.length > 500) {
    showToast('Text too long. Maximum 500 characters.', 'error');
    return;
  }

  isSynthesizing = true;
  btn.classList.add('loading');
  btn.disabled = true;
  btnText.textContent = 'Synthesizing…';
  showToast('Generating voice clone… this may take 10–30 seconds.', '');

  try {
    const res = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        reference_audio: referenceAudioFilename,
        language: selectedLang
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`✓ Done in ${data.synthesis_time}s`, 'success');
      loadOutputs(data);
    } else {
      showToast(data.error || 'Synthesis failed', 'error');
    }
  } catch (e) {
    showToast('Synthesis failed. Is the server running?', 'error');
  } finally {
    isSynthesizing = false;
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = 'Generate Voice';
  }
}

// ── Output List ───────────────────────
async function loadOutputs(newItem = null) {
  const list = document.getElementById('outputList');

  // If we have a new item, prepend it immediately
  if (newItem) {
    const card = createOutputCard({
      filename: newItem.output_filename,
      path: newItem.output_path,
      text: newItem.text,
      language: newItem.language,
      synthesis_time: newItem.synthesis_time,
      created: Date.now() / 1000
    });

    // Remove empty state if present
    const empty = list.querySelector('.empty-state');
    if (empty) list.innerHTML = '';
    list.prepend(card);
    return;
  }

  try {
    const res = await fetch('/api/outputs');
    const outputs = await res.json();

    if (outputs.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎧</div>
          <div>No outputs yet. Generate your first voice clone above.</div>
        </div>`;
      return;
    }

    list.innerHTML = '';
    outputs.forEach(o => list.appendChild(createOutputCard(o)));
  } catch (e) {
    console.error('Could not load outputs', e);
  }
}

function createOutputCard(o) {
  const card = document.createElement('div');
  card.className = 'output-card';
  card.id = `card-${o.filename}`;

  const displayText = o.text
    ? (o.text.length > 120 ? o.text.slice(0, 117) + '…' : o.text)
    : '(No text metadata)';

  const langLabel = o.language ? o.language.toUpperCase() : 'EN';
  const timeAgo = o.created ? formatTime(o.created) : '';
  const synthTime = o.synthesis_time ? ` · synthesized in ${o.synthesis_time}s` : '';

  card.innerHTML = `
    <div class="output-meta">
      <div class="output-text">${escHtml(displayText)}</div>
      <span class="output-badge">${langLabel}</span>
    </div>
    <div class="output-controls">
      <audio controls src="${o.path}"></audio>
      <a class="btn-download" href="${o.path}" download title="Download">⬇</a>
      <button class="btn-delete" onclick="deleteOutput('${o.filename}')" title="Delete">✕</button>
    </div>
    <div class="output-time">${timeAgo}${synthTime}</div>
  `;

  return card;
}

async function deleteOutput(filename) {
  if (!confirm('Delete this output?')) return;
  try {
    await fetch(`/api/delete/${filename}`, { method: 'DELETE' });
    const card = document.getElementById(`card-${filename}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-8px)';
      card.style.transition = 'all 0.2s';
      setTimeout(() => { card.remove(); checkEmpty(); }, 200);
    }
    showToast('Output deleted', '');
  } catch (e) {
    showToast('Could not delete output', 'error');
  }
}

function checkEmpty() {
  const list = document.getElementById('outputList');
  if (!list.children.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎧</div>
        <div>No outputs yet. Generate your first voice clone above.</div>
      </div>`;
  }
}

// ── Setup Modal ───────────────────────
function toggleSetup() {
  const modal = document.getElementById('setupModal');
  modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

// ── Toast ─────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Utils ─────────────────────────────
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(ts) {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleDateString();
}
