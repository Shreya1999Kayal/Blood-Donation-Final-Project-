(function () {
    'use strict';

    const root = document.getElementById('rakta-help-chat');
    if (!root) return;

    const toggleBtn = document.getElementById('raktaHelpToggle');
    const panel = document.getElementById('raktaHelpPanel');
    const messagesEl = document.getElementById('raktaHelpMessages');
    const form = document.getElementById('raktaHelpForm');
    const input = document.getElementById('raktaHelpInput');
    const sendBtn = document.getElementById('raktaHelpSend');
    const clearBtn = document.getElementById('raktaHelpClear');
    const suggestionsEl = document.getElementById('raktaHelpSuggestions');
    const chipButtons = suggestionsEl ? suggestionsEl.querySelectorAll('.rakta-help-chat__chip') : [];
    const userRole = (root.dataset.userRole || '').trim() || null;

    let history = [];
    let busy = false;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function inlineFormat(line) {
        let html = escapeHtml(line);
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`([^`]+)`/g, '<code class="rakta-help-chat__code">$1</code>');
        html = html.replace(/→/g, '<span class="rakta-help-chat__arrow">→</span>');
        return html;
    }

    function splitFootnote(text) {
        let body = String(text || '').trim();
        let footnote = '';

        const divider = body.indexOf('\n---\n');
        if (divider !== -1) {
            footnote = body.slice(divider + 5).trim();
            body = body.slice(0, divider).trim();
        }

        const noteMatch = body.match(/\n\n_?Note:[\s\S]+_?\s*$/i);
        if (noteMatch) {
            footnote = noteMatch[0].replace(/^_+|_+$/g, '').replace(/^Note:\s*/i, '').trim();
            body = body.slice(0, noteMatch.index).trim();
        }

        return { body, footnote };
    }

    function renderBotHtml(text) {
        const parts = splitFootnote(text);
        const lines = parts.body.split('\n');
        let html = '';
        let inOl = false;
        let inUl = false;

        function closeLists() {
            if (inOl) {
                html += '</ol>';
                inOl = false;
            }
            if (inUl) {
                html += '</ul>';
                inUl = false;
            }
        }

        lines.forEach(function (line) {
            const trimmed = line.trim();
            if (!trimmed) return;

            const titleMatch = trimmed.match(/^(.{3,80}):$/);
            const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
            const ulMatch = trimmed.match(/^[•\-]\s+(.+)$/);

            if (titleMatch && !olMatch) {
                closeLists();
                html += '<p class="rakta-help-chat__title">' + inlineFormat(titleMatch[1]) + '</p>';
            } else if (olMatch) {
                if (!inOl) {
                    closeLists();
                    html += '<ol class="rakta-help-chat__list">';
                    inOl = true;
                }
                html += '<li>' + inlineFormat(olMatch[1]) + '</li>';
            } else if (ulMatch) {
                if (!inUl) {
                    closeLists();
                    html += '<ul class="rakta-help-chat__list rakta-help-chat__list--bullet">';
                    inUl = true;
                }
                html += '<li>' + inlineFormat(ulMatch[1]) + '</li>';
            } else {
                closeLists();
                html += '<p class="rakta-help-chat__para">' + inlineFormat(trimmed) + '</p>';
            }
        });

        closeLists();

        if (parts.footnote) {
            html += '<p class="rakta-help-chat__footnote">' + inlineFormat(parts.footnote) + '</p>';
        }

        return html || '<p class="rakta-help-chat__para">' + inlineFormat(parts.body) + '</p>';
    }

    function setOpen(open) {
        root.classList.toggle('is-open', open);
        panel.hidden = !open;
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            setTimeout(function () { input.focus(); }, 80);
        }
    }

    function appendMessage(text, type) {
        const div = document.createElement('div');
        div.className = 'rakta-help-chat__msg rakta-help-chat__msg--' + type;

        if (type === 'bot') {
            const body = document.createElement('div');
            body.className = 'rakta-help-chat__msg-body';
            body.innerHTML = renderBotHtml(text);
            div.appendChild(body);
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            div.appendChild(p);
        }

        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    function setBusy(value) {
        busy = value;
        sendBtn.disabled = value;
        input.disabled = value;
        chipButtons.forEach(function (chip) {
            chip.disabled = value;
        });
    }

    async function sendMessage(message) {
        const text = (message || '').trim();
        if (!text || busy) return;

        appendMessage(text, 'user');
        input.value = '';
        setBusy(true);

        const typingEl = appendMessage('Thinking…', 'bot');
        typingEl.classList.add('rakta-help-chat__msg--typing');

        try {
            const res = await fetch('/ai/help', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    message: text,
                    history: history,
                    userRole: userRole,
                }),
            });

            const data = await res.json().catch(function () { return {}; });
            typingEl.remove();

            if (!res.ok || !data.ok) {
                appendMessage(data.error || 'Something went wrong. Please try again.', 'error');
                return;
            }

            appendMessage(data.reply, 'bot');
            history.push({ role: 'user', text: text });
            history.push({ role: 'model', text: data.reply });
            if (history.length > 20) {
                history = history.slice(-20);
            }
        } catch (err) {
            typingEl.remove();
            appendMessage('Network error. Check your connection and try again.', 'error');
        } finally {
            setBusy(false);
            input.focus();
        }
    }

    toggleBtn.addEventListener('click', function () {
        setOpen(panel.hidden);
    });

    clearBtn.addEventListener('click', function () {
        history = [];
        messagesEl.innerHTML = '';
        appendMessage(
            'Chat cleared. Ask about RaktaSetu, finding blood, donating, or emergency requests.',
            'bot'
        );
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        sendMessage(input.value);
    });

    chipButtons.forEach(function (chip) {
        chip.addEventListener('click', function () {
            const question = chip.dataset.suggest || chip.textContent;
            if (!panel.hidden) {
                sendMessage(question);
            } else {
                setOpen(true);
                setTimeout(function () { sendMessage(question); }, 120);
            }
        });
    });

    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
})();
