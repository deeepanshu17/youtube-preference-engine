// =============================================
// YRE Popup Script — Manage Gemini API Key
// =============================================

const STORAGE_KEY = 'yre_gemini_key';

const $ = (sel) => document.querySelector(sel);

// ========== Load current state ==========
document.addEventListener('DOMContentLoaded', async () => {
    const result = await chrome.storage.local.get([STORAGE_KEY, 'yre_user_profile', 'yre_watch_history']);

    // — API Key status —
    const key = result[STORAGE_KEY];
    const dot = $('#status-dot');
    const text = $('#status-text');
    const detail = $('#status-detail');
    const ctaCard = $('#cta-card');

    if (key && key.length > 10) {
        dot.className = 'status-dot active';
        text.textContent = 'AI Scoring Active';
        detail.textContent = 'Gemini 2.0 Flash is enhancing your scores';
        $('#api-key-input').value = key;
        ctaCard.classList.add('cta-hidden');
    } else {
        dot.className = 'status-dot inactive';
        text.textContent = 'Heuristic Only';
        detail.textContent = 'Add a Gemini key to unlock AI-powered scoring';
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

        // Update status
        $('#status-dot').className = 'status-dot active';
        $('#status-text').textContent = 'AI Scoring Active';
        $('#status-detail').textContent = 'Gemini 2.0 Flash is enhancing your scores';
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

    $('#status-dot').className = 'status-dot inactive';
    $('#status-text').textContent = 'Heuristic Only';
    $('#status-detail').textContent = 'Add a Gemini key to unlock AI-powered scoring';
    $('#cta-card').classList.remove('cta-hidden');
});

// ========== Toggle key visibility ==========
$('#toggle-key').addEventListener('click', () => {
    const input = $('#api-key-input');
    if (input.type === 'password') {
        input.type = 'text';
        $('#toggle-key').textContent = '🔒';
    } else {
        input.type = 'password';
        $('#toggle-key').textContent = '👁️';
    }
});
