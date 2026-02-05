import { SerialPort } from 'serialport';

export class SerialSender {
    constructor(portPath, baudRate = 115200) {
        this.portPath = portPath;
        this.baudRate = baudRate;
        this.port = null;
        this.isConnected = false;
        this.lastError = 0;

        this.connect();
    }

    connect() {
        if (this.isConnected) return;
        if (!this.portPath) {
            console.log('[Serial] No port selected. Waiting for user...');
            return;
        }

        console.log(`[Serial] Connecting to ${this.portPath} at ${this.baudRate}...`);
        try {
            this.port = new SerialPort({ path: this.portPath, baudRate: this.baudRate });

            this.port.on('open', () => {
                console.log('[Serial] Port Open');
                this.isConnected = true;
            });

            this.port.on('error', (err) => {
                if (this.lastError !== err.message) {
                    console.log(`[Serial] Connection Error: ${err.message}`);
                    console.log(`[Serial] Hint: Select the correct port in the Web App interface (Bridge Settings).`);
                    this.lastError = err.message;
                }
                this.isConnected = false;
                this.tryReconnect();
            });

            this.port.on('close', () => {
                console.log('[Serial] Port Closed');
                this.isConnected = false;
                this.tryReconnect();
            });

        } catch (e) {
            console.error('[Serial] Setup Error:', e.message);
            this.tryReconnect();
        }
    }

    tryReconnect() {
        setTimeout(() => {
            if (!this.isConnected) this.connect();
        }, 3000);
    }

    send(data) {
        if (!this.isConnected || !this.port) return;

        // Adalight Header
        // "Ada" + Hi Count + Lo Count + Checksum
        // Count = Num LEDs - 1
        const count = (data.length / 3) - 1;
        const hi = (count >> 8) & 0xFF;
        const lo = count & 0xFF;
        const checksum = hi ^ lo ^ 0x55;

        const header = Buffer.from([
            0x41, // 'A'
            0x64, // 'd'
            0x61, // 'a'
            hi,
            lo,
            checksum
        ]);

        // Send Header + Data
        // Using write with callback to handle backpressure if needed (simple implementation)
        this.port.write(header);
        this.port.write(data, (err) => {
            if (err) console.error('[Serial] Write Error:', err);
        });
    }

    close() {
        if (this.port && this.port.isOpen) {
            this.port.close();
        }
    }
}
