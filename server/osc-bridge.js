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

    socket.on('flash-firmware', async ({ port, firmwarePath }) => {
        console.log(`[Flash] Request received. Port: ${port}, File: ${firmwarePath}`);

        // Use python to run the script
        // Assuming running from project root
        const { spawn } = await import('node:child_process');

        const process = spawn('python3', ['scripts/flash_firmware.py', port, firmwarePath]);

        process.stdout.on('data', (data) => {
            const line = data.toString();
            console.log(`[Flash Output] ${line}`);
            socket.emit('flash-log', line);
        });

        process.stderr.on('data', (data) => {
            const line = data.toString();
            console.error(`[Flash Error] ${line}`);
            socket.emit('flash-log', `ERROR: ${line}`);
        });

        process.on('close', (code) => {
            console.log(`[Flash] Process exited with code ${code}`);
            socket.emit('flash-complete', { success: code === 0 });
        });
    });

    socket.on('get-ports', async () => {
        try {
            console.log('[Flash] Scanning for serial ports...');
            const { SerialPort } = await import('serialport');
            const ports = await SerialPort.list();
            console.log(`[Flash] Found ${ports.length} ports.`);
            socket.emit('ports-list', ports);
        } catch (error) {
            console.error('[Flash] Error listing ports:', error);
            socket.emit('ports-list', []);
        }
    });

    socket.on('verify-firmware', async ({ port }) => {
        console.log(`[Verify] Checking firmware on ${port}...`);
        try {
            const { SerialPort, ReadlineParser } = await import('serialport');
            const serial = new SerialPort({ path: port, baudRate: 115200 });
            const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

            let verified = false;
            let pingInterval;

            // Timeout if no response in 10s
            const timeout = setTimeout(() => {
                if (!verified) {
                    console.log('[Verify] Timeout.');
                    socket.emit('verify-log', 'Timeout waiting for response.');
                    socket.emit('verify-error-tip', 'Tip: Try pressing the "EN" or "RST" button on the ESP32.');
                    socket.emit('verify-complete', { success: false });
                    clearInterval(pingInterval);
                    if (serial.isOpen) serial.close();
                }
            }, 10000);

            serial.on('open', () => {
                console.log('[Verify] Port open. Handshaking...');
                socket.emit('verify-log', 'Connected. Handshaking...');

                // Send PING every second
                pingInterval = setInterval(() => {
                    if (!verified && serial.isOpen) {
                        // console.log('[Verify] Tx: PING'); 
                        serial.write('PING\n');
                    }
                }, 1000);
            });

            parser.on('data', (data) => {
                const line = data.toString().trim();
                console.log(`[Verify RX] ${line}`);
                if (line.includes('LUMINA_OK')) {
                    verified = true;
                    clearTimeout(timeout);
                    clearInterval(pingInterval);
                    console.log('[Verify] Verified!');
                    socket.emit('verify-log', 'Response received: LUMINA_OK');
                    socket.emit('verify-complete', { success: true });
                    serial.close();
                }
            });

            serial.on('error', (err) => {
                console.error('[Verify] Error:', err);
                socket.emit('verify-log', `Error: ${err.message}`);
                if (!verified) {
                    clearInterval(pingInterval);
                    clearTimeout(timeout);
                    socket.emit('verify-complete', { success: false });
                }
            });

        } catch (err) {
            console.error('[Verify] Setup Error:', err);
            socket.emit('verify-complete', { success: false });
        }
    });

    socket.on('blink-device', async ({ port }) => {
        console.log(`[Blink] Request on ${port}`);
        try {
            const { SerialPort } = await import('serialport');
            const serial = new SerialPort({ path: port, baudRate: 115200 });

            serial.on('open', () => {
                console.log('[Blink] Sending signal...');
                // PING triggers the White Flash in firmware
                serial.write('PING\n');

                // Close after a short delay to ensure sent
                setTimeout(() => {
                    serial.close();
                }, 500);
            });

            serial.on('error', (err) => {
                console.error('[Blink] Error:', err);
            });

        } catch (err) {
            console.error('[Blink] Setup Error:', err);
        }
    });
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
