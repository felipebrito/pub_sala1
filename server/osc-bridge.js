import { Server } from 'node-osc';
import { Server as SocketIOServer } from 'socket.io'; // Note: socket.io Server import
import { createServer } from 'http';

const OSC_PORT = 4444;
const SOCKET_PORT = 3001;

// 1. Setup Socket.IO Server (for frontend connection)
const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*", // Allow Vite client
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);
});

httpServer.listen(SOCKET_PORT, () => {
    console.log(`[Socket.IO] Server listening on port ${SOCKET_PORT}`);
});

// 2. Setup OSC Server (UDP)
const oscServer = new Server(OSC_PORT, '0.0.0.0', () => {
    console.log(`[OSC] Server listening on 0.0.0.0:${OSC_PORT}`);
    console.log('[OSC] Supported commands: /play, /stop, /pause, /idle, /main');
});

// 3. Handle OSC Messages
oscServer.on('message', (msg) => {
    // msg structure: ['/address', arg1, arg2...]
    const address = msg[0];
    const args = msg.slice(1);

    console.log(`[OSC] Received: ${address}`, args);

    // Filter and forward relevant commands
    if (address === '/play' ||
        address === '/stop' ||
        address === '/pause' ||
        address === '/idle' ||
        address === '/main') {

        // Remove leading slash for cleaner event name: '/play' -> 'play'
        const eventName = address.substring(1);
        io.emit('osc-command', { command: eventName, args });
    }
});

oscServer.on('error', (err) => {
    console.error('[OSC] Error:', err);
});
