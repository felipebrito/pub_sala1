import dgram from 'node:dgram';

/**
 * Art-Net Sender Class
 * Handles manual packing of ArtDMX packets and transmission via UDP.
 */
export class ArtnetSender {
    constructor(targetIp, port = 6454) {
        this.targetIp = targetIp;
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.socket.bind(() => {
            this.socket.setBroadcast(true);
        });
        this.sequence = 0;
    }

    /**
     * Sends a single DMX universe
     * @param {number} universe - Universe ID (0-32767)
     * @param {Uint8Array} dmxData - DMX channel data (exactly 512 bytes or truncated if specified)
     */
    send(universe, dmxData) {
        // Protocol Header: "Art-Net" + 0x00
        const HEADER = Buffer.from('Art-Net\0');

        // OpCode: ArtDMX (0x5000), Little Endian
        const OP_CODE = Buffer.from([0x00, 0x50]);

        // Protocol Version: 14 (Big Endian)
        const PROTOCOL_VERSION = Buffer.from([0x00, 0x0E]);

        // Sequence: 0x00 to 0xFF. If 0, sequencing is disabled.
        this.sequence = (this.sequence + 1) & 0xFF;
        const SEQUENCE = Buffer.from([this.sequence]);

        // Physical: Port that generated this data (0-3).
        const PHYSICAL = Buffer.from([0x00]);

        // Universe: Subnet/Universe (Little Endian)
        const universeLow = universe & 0xFF;
        const universeHigh = (universe >> 8) & 0xFF;
        const UNIVERSE = Buffer.from([universeLow, universeHigh]);

        // Length: Number of DMX channels (2 to 512, must be even, Big Endian)
        let length = dmxData.length;
        if (length % 2 !== 0) length += 1; // Ensure even length
        const LENGTH = Buffer.from([(length >> 8) & 0xFF, length & 0xFF]);

        // Create payload
        const payload = Buffer.alloc(length, 0);
        Buffer.from(dmxData).copy(payload);

        // Build final packet
        const packet = Buffer.concat([
            HEADER,
            OP_CODE,
            PROTOCOL_VERSION,
            SEQUENCE,
            PHYSICAL,
            UNIVERSE,
            LENGTH,
            payload
        ]);

        this.socket.send(packet, this.port, this.targetIp, (err) => {
            if (err) console.error(`Error sending ArtDMX to universe ${universe}:`, err);
        });
    }

    close() {
        this.socket.close();
    }
}
