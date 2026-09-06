/* ═══════════════════════════════════════════════════════════════
   Menos Code v4.0 — Client Application
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const state = {
    conversations: [],
    currentConvId: null,
    isStreaming: false,
    abortController: null,
    currentVariant: 'default',
    lastUsedKey: null,
    settings: { temperature: 0.7, maxTokens: 4096 }
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const els = {
    welcomeScreen: $('#welcomeScreen'), chatContainer: $('#chatContainer'),
    messages: $('#messages'), userInput: $('#userInput'),
    sendBtn: $('#sendBtn'), stopBtn: $('#stopBtn'), charCount: $('#charCount'),
    newChatBtn: $('#newChatBtn'), conversationList: $('#conversationList'),
    searchInput: $('#searchInput'), settingsBtn: $('#settingsBtn'),
    settingsPanel: $('#settingsPanel'), closeSettingsBtn: $('#closeSettingsBtn'),
    tempSlider: $('#tempSlider'), tempValue: $('#tempValue'),
    maxTokensSlider: $('#maxTokensSlider'), maxTokensValue: $('#maxTokensValue'),
    keyStatus: $('#keyStatus'), keysGrid: $('#keysGrid'),
    sidebar: $('#sidebar'), sidebarToggle: $('#sidebarToggle'),
    previewPanel: $('#previewPanel'), previewFrame: $('#previewFrame'),
    previewSource: $('#previewSource'), closePreviewBtn: $('#closePreviewBtn'),
    previewNewTab: $('#previewNewTab')
  };

  // ─── Toast ─────────────────────────────────────────────────────
  function toast(msg, type = 'info', ms = 4000) {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
    t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${esc(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, ms);
  }

  // ─── Init ──────────────────────────────────────────────────────
  function init() {
    loadStorage(); bindEvents(); renderConvList(); fetchKeyStatus();
    if (state.currentConvId) {
      const c = conv(state.currentConvId);
      if (c?.messages.length) { showChat(); renderMsgs(c.messages); }
    }
    marked.setOptions({ highlight: (c, l) => { try { return l && hljs.getLanguage(l) ? hljs.highlight(c, { language: l }).value : hljs.highlightAuto(c).value; } catch { return c; } }, breaks: true, gfm: true });
  }

  // ─── Key status ────────────────────────────────────────────────
  async function fetchKeyStatus() {
    try {
      const r = await fetch('/api/keys'); const d = await r.json();
      els.keyStatus.textContent = `${d.totalKeys} Keys`;
      els.keysGrid.innerHTML = d.stats.map(k => `<div class="key-dot ${k.status}" title="Key #${k.index}: ${k.totalRequests} reqs">${k.index}${k.totalRequests > 0 ? `<span class="key-reqs">${k.totalRequests}</span>` : ''}</div>`).join('');
      $('#infoKeys').textContent = d.totalKeys;
    } catch {}
  }

  // ─── Storage ───────────────────────────────────────────────────
  function save() { try { localStorage.setItem('mc-c', JSON.stringify(state.conversations)); localStorage.setItem('mc-id', state.currentConvId); localStorage.setItem('mc-s', JSON.stringify(state.settings)); localStorage.setItem('mc-v', state.currentVariant); } catch {} }
  function loadStorage() {
    try {
      const c = localStorage.getItem('mc-c'); if (c) state.conversations = JSON.parse(c);
      const id = localStorage.getItem('mc-id'); if (id) state.currentConvId = id;
      const s = localStorage.getItem('mc-s'); if (s) { state.settings = { ...state.settings, ...JSON.parse(s) }; els.tempSlider.value = state.settings.temperature; els.tempValue.textContent = state.settings.temperature.toFixed(2); els.maxTokensSlider.value = state.settings.maxTokens; els.maxTokensValue.textContent = state.settings.maxTokens; }
      const v = localStorage.getItem('mc-v'); if (v) { state.currentVariant = v; updateVariantUI(v); }
    } catch {}
  }

  // ─── Conversations ─────────────────────────────────────────────
  function createConv() { const c = { id: 'c' + Date.now(), title: 'New conversation', messages: [], createdAt: new Date().toISOString(), variant: state.currentVariant }; state.conversations.unshift(c); state.currentConvId = c.id; save(); renderConvList(); return c; }
  function conv(id) { return state.conversations.find(c => c.id === id); }
  function delConv(id) { state.conversations = state.conversations.filter(c => c.id !== id); if (state.currentConvId === id) state.currentConvId = state.conversations[0]?.id || null; save(); renderConvList(); if (state.currentConvId) { const c = conv(state.currentConvId); if (c?.messages.length) { showChat(); renderMsgs(c.messages); } else showWelcome(); } else showWelcome(); toast('Deleted', 'info'); }

  function showWelcome() { els.welcomeScreen.classList.remove('hidden'); els.chatContainer.classList.remove('active'); }
  function showChat() { els.welcomeScreen.classList.add('hidden'); els.chatContainer.classList.add('active'); }

  function renderConvList(filter = '') {
    const f = filter ? state.conversations.filter(c => c.title.toLowerCase().includes(filter.toLowerCase())) : state.conversations;
    let html = '', lastD = '';
    f.forEach(c => { const d = fmtDate(c.createdAt); if (d !== lastD) { html += `<div class="conv-date">${d}</div>`; lastD = d; } html += `<div class="conv-item ${c.id === state.currentConvId ? 'active' : ''}" data-id="${c.id}"><svg class="conv-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="conv-title">${esc(c.title)}</span><button class="btn-icon conv-delete" data-delete="${c.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>`; });
    if (!f.length) html = '<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:13px">No conversations</div>';
    els.conversationList.innerHTML = html;
  }

  function renderMsgs(msgs) { els.messages.innerHTML = msgs.map((m, i) => renderMsg(m, i)).join(''); hlAll(); scrollBot(); }

  function renderMsg(m, i) {
    const isU = m.role === 'user';
    const variantLabel = m.variant ? `<span class="message-variant">${m.variant}</span>` : '';
    const keyLabel = m.keyIndex ? `<span class="message-key">#${m.keyIndex}</span>` : '';
    const meta = isU ? '' : `<div class="message-meta">${variantLabel}${keyLabel}</div>`;

    let body;
    if (isU) {
      body = `<div class="message-body">${esc(m.content)}</div>`;
    } else {
      let html = renderMd(m.content, m.reasoning);
      body = `<div class="message-body">${html}</div>`;
    }

    const acts = `<div class="message-actions">
      <button class="msg-action-btn" onclick="copyMsg(this,${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>
      ${!isU ? `<button class="msg-action-btn" onclick="regen(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retry</button>` : ''}
    </div>`;

    return `<div class="message ${m.role}" data-index="${i}">
      <div class="message-header">
        <div class="message-avatar">${isU ? 'U' : '⚡'}</div>
        <span class="message-sender">${isU ? 'You' : 'Menos Code'}</span>
        ${meta}
      </div>${body}${acts}</div>`;
  }

  function pushMsg(role, content, extra = {}) {
    const c = conv(state.currentConvId); if (!c) return;
    c.messages.push({ role, content, ...extra });
    if (c.messages.length === 1 && role === 'user') { c.title = content.slice(0, 50) + (content.length > 50 ? '...' : ''); save(); renderConvList(); }
    save(); return c.messages.length - 1;
  }

  // ─── Markdown ──────────────────────────────────────────────────
  function renderMd(text, reasoning) {
    if (!text) return '';
    const r = new marked.Renderer();
    r.code = function (code, lang) {
      if (typeof code === 'object') { lang = code.lang; code = code.text; }
      const l = lang || 'code';
      const hl = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value;
      const isPrev = ['html', 'htm'].includes(l?.toLowerCase());
      return `<div class="code-block-wrapper" data-lang="${l}"><div class="code-block-header"><div class="code-block-left"><span class="code-block-lang">${esc(l)}</span></div><div class="code-block-actions">${isPrev ? `<button class="code-action-btn" onclick="previewCode(this,'${l}')" title="Run"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run</button>` : ''}<button class="code-action-btn" onclick="dlCode(this,'${l}')" title="Download"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save</button><button class="code-action-btn" onclick="copyCode(this)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button></div></div><pre><code class="hljs language-${l}">${hl}</code></pre></div>`;
    };
    let html = marked.parse(text, { renderer: r });
    if (reasoning) {
      html = `<div class="thinking-block"><div class="thinking-header" onclick="this.parentElement.classList.toggle('open')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg><span>Menos Thinking</span></div><div class="thinking-content">${marked.parse(reasoning)}</div></div>` + html;
    }
    return html;
  }

  // ─── Stream ────────────────────────────────────────────────────
  async function sendMsg(text) {
    if (!text.trim() || state.isStreaming) return;
    if (!state.currentConvId) createConv();
    showChat();
    const ui = pushMsg('user', text);
    els.messages.insertAdjacentHTML('beforeend', renderMsg({ role: 'user', content: text }, ui));
    const ai = conv(state.currentConvId).messages.length;
    els.messages.insertAdjacentHTML('beforeend', `<div class="message assistant streaming" data-index="${ai}"><div class="message-header"><div class="message-avatar">⚡</div><span class="message-sender">Menos Code</span><div class="message-meta"><span class="message-variant">${state.currentVariant}</span></div></div><div class="message-body"><div class="loading-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div><div class="message-actions"></div></div>`);
    scrollBot();

    const c = conv(state.currentConvId);
    const apiMsgs = c.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }));

    state.isStreaming = true; state.abortController = new AbortController(); updateUI();
    let full = '', reasoning = '', usedKey = '';

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMsgs, settings: state.settings, variant: state.currentVariant }),
        signal: state.abortController.signal
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error' }));
        els.messages.querySelector('.message.streaming .message-body').innerHTML = `<div class="error-message">${esc(err.error)}</div>`;
        toast(err.error, 'error'); state.isStreaming = false; updateUI(); return;
      }

      const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
      const sBody = els.messages.querySelector('.message.streaming .message-body');

      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim(); if (!t.startsWith('data: ')) continue;
          const d = t.slice(6); if (d === '[DONE]') continue;
          try {
            const p = JSON.parse(d);
            if (p.keyIndex) { usedKey = p.keyIndex; els.keyStatus.textContent = `${usedKey}/10`; }
            if (p.error) { sBody.innerHTML = `<div class="error-message">${esc(p.error)}</div>`; toast(p.error, 'error'); continue; }
            if (p.reasoning) reasoning += p.reasoning;
            if (p.content) {
              full += p.content;
              let h = '';
              if (reasoning) h += `<div class="thinking-block open"><div class="thinking-header" onclick="this.parentElement.classList.toggle('open')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg><span>Menos Thinking</span></div><div class="thinking-content">${renderMd(reasoning)}</div></div>`;
              h += `<div class="sc">${renderMd(full)}</div>`;
              sBody.innerHTML = h; hlAll(); scrollBot();
            }
          } catch {}
        }
      }

      const sEl = els.messages.querySelector('.message.streaming');
      if (sEl) {
        sEl.classList.remove('streaming');
        const sc = sEl.querySelector('.sc'); if (sc) sc.outerHTML = sc.innerHTML;
        const meta = sEl.querySelector('.message-meta');
        if (meta) meta.innerHTML = `<span class="message-variant">${state.currentVariant}</span>${usedKey ? `<span class="message-key">#${usedKey}</span>` : ''}`;
      }

      if (full) {
        const cv = conv(state.currentConvId);
        const last = cv.messages[cv.messages.length - 1];
        if (last.role === 'assistant') { last.content = full; last.reasoning = reasoning; last.keyIndex = usedKey; last.variant = state.currentVariant; }
        save();
      }
    } catch (e) {
      if (e.name === 'AbortError') toast('Stopped', 'info');
      else { els.messages.querySelector('.message.streaming .message-body').innerHTML = '<div class="error-message">Connection error. Try again.</div>'; toast('Error', 'error'); }
    } finally { state.isStreaming = false; state.abortController = null; updateUI(); fetchKeyStatus(); }
  }

  function stop() { if (state.abortController) state.abortController.abort(); }

  // ─── UI ────────────────────────────────────────────────────────
  function updateUI() {
    if (state.isStreaming) { els.sendBtn.classList.add('hidden'); els.stopBtn.classList.remove('hidden'); els.userInput.disabled = true; }
    else { els.sendBtn.classList.remove('hidden'); els.stopBtn.classList.add('hidden'); els.userInput.disabled = false; els.userInput.focus(); }
    els.sendBtn.disabled = !els.userInput.value.trim() || state.isStreaming;
  }
  function scrollBot() { requestAnimationFrame(() => { els.chatContainer.scrollTop = els.chatContainer.scrollHeight; }); }
  function updateVariantUI(v) { $$('.variant-btn, .input-variant-btn').forEach(b => b.classList.toggle('active', b.dataset.variant === v)); }

  // ─── Events ────────────────────────────────────────────────────
  function bindEvents() {
    els.userInput.addEventListener('input', () => { els.userInput.style.height = 'auto'; els.userInput.style.height = Math.min(els.userInput.scrollHeight, 200) + 'px'; els.charCount.textContent = els.userInput.value.length || ''; els.sendBtn.disabled = !els.userInput.value.trim() || state.isStreaming; });
    els.userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    els.sendBtn.addEventListener('click', doSend);
    els.stopBtn.addEventListener('click', stop);
    els.newChatBtn.addEventListener('click', () => { state.currentConvId = null; save(); showWelcome(); renderConvList(); els.userInput.value = ''; els.userInput.style.height = 'auto'; updateUI(); });
    els.conversationList.addEventListener('click', e => { const d = e.target.closest('[data-delete]'); if (d) { e.stopPropagation(); delConv(d.dataset.delete); return; } const c = e.target.closest('.conv-item'); if (c) { state.currentConvId = c.dataset.id; save(); const cv = conv(c.dataset.id); if (cv?.messages.length) { showChat(); renderMsgs(cv.messages); } else showWelcome(); renderConvList(); if (window.innerWidth <= 768) els.sidebar.classList.remove('open'); } });
    els.searchInput.addEventListener('input', e => renderConvList(e.target.value));
    $$('.chip').forEach(c => c.addEventListener('click', () => { els.userInput.value = c.dataset.prompt; updateUI(); doSend(); }));
    els.settingsBtn.addEventListener('click', () => { els.settingsPanel.classList.toggle('hidden'); if (!els.settingsPanel.classList.contains('hidden')) fetchKeyStatus(); });
    els.closeSettingsBtn.addEventListener('click', () => els.settingsPanel.classList.add('hidden'));
    els.tempSlider.addEventListener('input', e => { state.settings.temperature = parseFloat(e.target.value); els.tempValue.textContent = state.settings.temperature.toFixed(2); save(); });
    els.maxTokensSlider.addEventListener('input', e => { state.settings.maxTokens = parseInt(e.target.value); els.maxTokensValue.textContent = state.settings.maxTokens; save(); });
    els.sidebarToggle.addEventListener('click', () => els.sidebar.classList.toggle('open'));
    document.addEventListener('click', e => { if (window.innerWidth <= 768 && els.sidebar.classList.contains('open') && !els.sidebar.contains(e.target) && e.target !== els.sidebarToggle) els.sidebar.classList.remove('open'); });
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); els.newChatBtn.click(); } if (e.key === 'Escape') { els.settingsPanel.classList.add('hidden'); els.previewPanel.classList.add('hidden'); } });
    $$('.variant-btn, .input-variant-btn').forEach(b => b.addEventListener('click', () => { state.currentVariant = b.dataset.variant; updateVariantUI(state.currentVariant); save(); toast(`Mode: ${b.dataset.variant}`, 'success'); }));
    els.closePreviewBtn?.addEventListener('click', () => els.previewPanel.classList.add('hidden'));
    els.previewNewTab?.addEventListener('click', () => { if (els.previewFrame.srcdoc) { const w = window.open(); w.document.write(els.previewFrame.srcdoc); w.document.close(); } });
    $$('.preview-tab').forEach(t => t.addEventListener('click', () => { $$('.preview-tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); const isP = t.dataset.tab === 'preview'; els.previewFrame.classList.toggle('hidden', !isP); els.previewSource.classList.toggle('hidden', isP); }));
  }

  function doSend() { const v = els.userInput.value.trim(); if (!v || state.isStreaming) return; els.userInput.value = ''; els.userInput.style.height = 'auto'; els.charCount.textContent = ''; updateUI(); sendMsg(v); }

  // ─── Helpers ───────────────────────────────────────────────────
  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  function fmtDate(d) { const diff = Date.now() - new Date(d); const days = Math.floor(diff / 864e5); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return 'This week'; if (days < 30) return 'This month'; return 'Older'; }
  function hlAll() { document.querySelectorAll('.code-block-wrapper pre code:not(.hljs)').forEach(b => hljs.highlightElement(b)); }
  function getExt(l) { const m = { javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', tsx: 'tsx', python: 'py', py: 'py', java: 'java', cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', html: 'html', css: 'css', sql: 'sql', bash: 'sh', json: 'json', xml: 'xml', yaml: 'yml', vue: 'vue', svelte: 'svelte', dart: 'dart', swift: 'swift', kotlin: 'kt' }; return m[l?.toLowerCase()] || l || 'txt'; }

  // ─── Global ────────────────────────────────────────────────────
  window.copyCode = function (btn) { const w = btn.closest('.code-block-wrapper'); navigator.clipboard.writeText(w.querySelector('code').textContent).then(() => { const o = btn.innerHTML; btn.innerHTML = '✓ Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.innerHTML = o; btn.classList.remove('copied'); }, 2000); }); };
  window.dlCode = function (btn, lang) { const w = btn.closest('.code-block-wrapper'); const code = w.querySelector('code').textContent; const fn = `code.${getExt(lang)}`; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = fn; document.body.appendChild(a); a.click(); a.remove(); toast(`Saved: ${fn}`, 'success'); };
  window.previewCode = function (btn, lang) {
    const code = btn.closest('.code-block-wrapper').querySelector('code').textContent;
    let html = code;
    if (['html', 'htm'].includes(lang?.toLowerCase())) { if (!code.includes('<html') && !code.includes('<!DOCTYPE')) html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${code}</body></html>`; }
    else if (lang?.toLowerCase() === 'css') html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${code}</style></head><body><div style="padding:20px"><p>CSS Preview</p><div class="demo">Demo</div></div></body></html>`;
    else if (['javascript', 'js'].includes(lang?.toLowerCase())) html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="out" style="padding:20px;font-family:sans-serif"></div><script>try{${code}}catch(e){document.getElementById('out').innerHTML='<pre style="color:red">'+e+'</pre>'}<\/script></body></html>`;
    else { toast('Preview: HTML/CSS/JS only', 'warning'); return; }
    els.previewPanel.classList.remove('hidden'); $$('.preview-tab').forEach(t => t.classList.remove('active')); $('.preview-tab[data-tab="preview"]').classList.add('active'); els.previewFrame.classList.remove('hidden'); els.previewSource.classList.add('hidden'); els.previewFrame.srcdoc = html; els.previewSource.querySelector('code').textContent = code; toast('Preview opened', 'success');
  };
  window.copyMsg = function (btn, i) { const c = conv(state.currentConvId); if (!c?.messages[i]) return; navigator.clipboard.writeText(c.messages[i].content).then(() => { const o = btn.innerHTML; btn.innerHTML = '✓ Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.innerHTML = o; btn.classList.remove('copied'); }, 2000); }); };
  window.regen = function (i) { if (state.isStreaming) return; const c = conv(state.currentConvId); if (!c || c.messages[i]?.role !== 'assistant') return; c.messages.splice(i, 1); save(); renderMsgs(c.messages); const lastU = [...c.messages].reverse().find(m => m.role === 'user'); if (lastU) { const ui = c.messages.indexOf(lastU); c.messages.splice(ui, 1); save(); renderMsgs(c.messages); sendMsg(lastU.content); } };

  document.addEventListener('DOMContentLoaded', init);
})();
