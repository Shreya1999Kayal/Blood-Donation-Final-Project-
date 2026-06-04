(() => {
    function setStatusEl(el, online) {
        if (!el) return;
        el.textContent = online ? 'Online' : 'Offline';
        el.classList.toggle('is-online', online);
        el.classList.toggle('is-offline', !online);
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('data-online', online ? '1' : '0');
    }

    function createWatcher(socket) {
        let watchedUserId = null;
        let statusEl = null;

        socket.on('presence:update', (data) => {
            if (!data || !watchedUserId) return;
            if (String(data.userId) !== watchedUserId) return;
            setStatusEl(statusEl, !!data.online);
        });

        function watch(userId, el) {
            if (watchedUserId) {
                socket.emit('presence:unwatch', { userId: watchedUserId });
            }

            watchedUserId = userId ? String(userId) : null;
            statusEl = el || null;

            if (!watchedUserId) {
                setStatusEl(statusEl, false);
                return;
            }

            setStatusEl(statusEl, false);
            emitWatch();
        }

        function emitWatch() {
            if (!watchedUserId) return;
            socket.emit('presence:watch', { userId: watchedUserId }, (resp) => {
                if (resp && typeof resp.online === 'boolean') {
                    setStatusEl(statusEl, resp.online);
                }
            });
        }

        socket.on('connect', () => {
            if (watchedUserId) emitWatch();
        });

        function unwatch() {
            if (!watchedUserId) return;
            socket.emit('presence:unwatch', { userId: watchedUserId });
            watchedUserId = null;
            setStatusEl(statusEl, false);
        }

        return { watch, unwatch };
    }

    window.ChatPresence = { createWatcher };
})();
