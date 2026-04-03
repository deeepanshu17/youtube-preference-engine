// =============================================
// YRE Popup Script — Premium UI + Gemini Key
// =============================================

const STORAGE_KEY = 'yre_gemini_key';
const $ = (sel) => document.querySelector(sel);

// ========== Status Icons (SVG) ==========
const STATUS_ICONS = {
    active: `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="#4ade80" stroke-width="1.5" fill="rgba(74,222,128,0.1)"/>
            <path d="M7 11.5L9.5 14L15 8.5" stroke="#4ade80" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
    inactive: `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="#fbbf24" stroke-width="1.5" fill="rgba(251,191,36,0.08)"/>
            <path d="M11 7V12" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="11" cy="14.5" r="1" fill="#fbbf24"/>
        </svg>`
};

// ========== Load current state ==========
document.addEventListener('DOMContentLoaded', async () => {
    const result = await chrome.storage.local.get([STORAGE_KEY, 'yre_user_profile', 'yre_watch_history']);

    // — API Key status —
    const key = result[STORAGE_KEY];
    const statusCard = $('#status-card');
    const iconWrap = $('#status-icon-wrap');
    const text = $('#status-text');
    const detail = $('#status-detail');
    const ctaCard = $('#cta-card');

    if (key && key.length > 10) {
        statusCard.classList.add('ai-active');
        statusCard.classList.remove('ai-inactive');
        iconWrap.className = 'status-icon-wrap active';
        iconWrap.innerHTML = STATUS_ICONS.active;
        text.textContent = 'AI Scoring Active';
        detail.textContent = 'Powered by Gemini 2.0 Flash — enhancing your recommendations';
        $('#api-key-input').value = key;
        ctaCard.classList.add('cta-hidden');
    } else {
        statusCard.classList.add('ai-inactive');
        statusCard.classList.remove('ai-active');
        iconWrap.className = 'status-icon-wrap inactive';
        iconWrap.innerHTML = STATUS_ICONS.inactive;
        text.textContent = 'Smart Scoring Mode';
        detail.textContent = 'Using heuristic analysis · Add a Gemini key to unlock AI-powered scoring';
        ctaCard.classList.remove('cta-hidden');
    }

    // — Profile stats —
    const profile = result['yre_user_profile'];
    const history = result['yre_watch_history'] || [];

    if (profile) {
        $('#stat-history').textContent = history.length;
        $('#stat-channels').textContent = Object.keys(profile.preferences?.topChannels || {}).length;
        $('#stat-keywords').textContent = Object.keys(profile.preferences?.topKeywords || {}).length;
    } else {
        $('#stat-history').textContent = history.length;
        $('#stat-channels').textContent = '0';
        $('#stat-keywords').textContent = '0';
    }
});

// ========== Save key ==========
$('#save-btn').addEventListener('click', async () => {
    const key = $('#api-key-input').value.trim();
    const msg = $('#save-msg');

    if (!key) {
        msg.textContent = '⚠️ Please paste a key first';
        msg.className = 'save-msg error';
        return;
    }

    if (key.length < 20) {
        msg.textContent = '⚠️ That doesn\'t look like a valid Gemini key';
        msg.className = 'save-msg error';
        return;
    }

    // Quick validation — try a minimal API call
    msg.textContent = '⏳ Validating key...';
    msg.className = 'save-msg';

    try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
        const resp = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Reply with just: OK' }] }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const errMsg = err?.error?.message || `HTTP ${resp.status}`;
            msg.textContent = `❌ Invalid key: ${errMsg}`;
            msg.className = 'save-msg error';
            return;
        }

        // Key works! Save it.
        await chrome.storage.local.set({ [STORAGE_KEY]: key });

        msg.textContent = '✅ Key saved! Reload YouTube to activate AI scoring.';
        msg.className = 'save-msg success';

        // Update status card
        const statusCard = $('#status-card');
        statusCard.classList.add('ai-active');
        statusCard.classList.remove('ai-inactive');
        $('#status-icon-wrap').className = 'status-icon-wrap active';
        $('#status-icon-wrap').innerHTML = STATUS_ICONS.active;
        $('#status-text').textContent = 'AI Scoring Active';
        $('#status-detail').textContent = 'Powered by Gemini 2.0 Flash — enhancing your recommendations';
        $('#cta-card').classList.add('cta-hidden');

    } catch (e) {
        msg.textContent = '❌ Network error — check your connection';
        msg.className = 'save-msg error';
    }
});

// ========== Clear key ==========
$('#clear-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    $('#api-key-input').value = '';

    const msg = $('#save-msg');
    msg.textContent = '🗑️ Key removed. AI scoring disabled.';
    msg.className = 'save-msg';

    const statusCard = $('#status-card');
    statusCard.classList.add('ai-inactive');
    statusCard.classList.remove('ai-active');
    $('#status-icon-wrap').className = 'status-icon-wrap inactive';
    $('#status-icon-wrap').innerHTML = STATUS_ICONS.inactive;
    $('#status-text').textContent = 'Smart Scoring Mode';
    $('#status-detail').textContent = 'Using heuristic analysis · Add a Gemini key to unlock AI-powered scoring';
    $('#cta-card').classList.remove('cta-hidden');
});

// ========== Toggle key visibility ==========
$('#toggle-key').addEventListener('click', () => {
    const input = $('#api-key-input');
    const icon = $('#eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
            <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>`;
    }
});
