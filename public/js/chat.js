(() => {
    const cfg = window.__CHAT__ || {};
    const conversationId = cfg.conversationId;
    const otherUserId = cfg.otherUserId;
    const currentUserId = cfg.currentUserId;
    const isBloodbank = cfg.theme === 'bloodbank';
    const accentColor = isBloodbank ? '#0284c7' : '#dc3545';

    const chatBox = document.getElementById('chatBox');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    function showChatError(message) {
        const text = message || 'Chat error';
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                icon: 'error',
                title: 'Chat blocked',
                text,
                    confirmButtonColor: accentColor,
            });
            return;
        }
        alert(text);
    }

    function scrollToBottom() {
        if (!chatBox) return;
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function renderMessage(m) {
        const isMe = (m.from || '').toString() === currentUserId.toString();
        const wrapper = document.createElement('div');
        if (isBloodbank) {
            wrapper.className = 'bb-chat-row ' + (isMe ? 'bb-chat-row-me' : 'bb-chat-row-them');
        } else {
            wrapper.className = 'd-flex mb-2 ' + (isMe ? 'justify-content-end' : 'justify-content-start');
        }

        const bubble = document.createElement('div');
        const time = m.createdAt ? new Date(m.createdAt) : new Date();
        if (isBloodbank) {
            bubble.className = 'bb-chat-bubble ' + (isMe ? 'bb-chat-bubble-me' : 'bb-chat-bubble-them');
            bubble.innerHTML =
                '<div class="bb-chat-text">' + escapeHtml(m.text || '') + '</div>' +
                '<time class="bb-chat-time">' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</time>';
        } else {
            bubble.className = 'msg rounded px-3 py-2 ' + (isMe ? 'msg-me' : 'msg-them');
            bubble.innerHTML =
                '<div class="small" style="white-space: pre-wrap;">' + escapeHtml(m.text || '') + '</div>' +
                '<div class="text-end" style="font-size:0.7rem;opacity:0.8;">' + time.toLocaleTimeString() + '</div>';
        }

        wrapper.appendChild(bubble);
        return wrapper;
    }

    scrollToBottom();

    const socket = io();
    const presenceEl = document.getElementById('chatPresenceStatus');
    const presenceWatcher = window.ChatPresence?.createWatcher(socket);
    if (otherUserId && presenceWatcher) {
        presenceWatcher.watch(otherUserId, presenceEl);
    }

    socket.on('connect', () => {
        if (conversationId) socket.emit('chat:join', { conversationId });
    });

    socket.on('chat:message', (m) => {
        if (!m || m.conversationId?.toString?.() !== conversationId?.toString?.()) return;
        chatBox.appendChild(renderMessage(m));
        scrollToBottom();
    });

    socket.on('chat:error', (err) => {
        const msg = err?.error || 'Chat error';
        showChatError(msg);
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = (input?.value || '').trim();
        if (!text) return;
        socket.emit('chat:send', { conversationId, toUserId: otherUserId, text }, (resp) => {
            if (!resp || !resp.ok) {
                showChatError(resp?.error || 'Failed to send message');
                return;
            }
            input.value = '';
            input.focus();
        });
    });
})();

