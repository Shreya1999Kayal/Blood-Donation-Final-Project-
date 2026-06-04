const { attachSocketAuth } = require('./socketAuth');
const { joinNotificationRooms } = require('./notifications');
const { registerChatHandlers } = require('./chat');
const { registerPresenceHandlers } = require('./presence');

function configureSockets(io) {
    attachSocketAuth(io);

    io.on('connection', (socket) => {
        // Auth middleware guarantees socket.user exists
        joinNotificationRooms(socket);
        registerPresenceHandlers(io, socket);
        registerChatHandlers(io, socket);
    });
}

module.exports = { configureSockets };

