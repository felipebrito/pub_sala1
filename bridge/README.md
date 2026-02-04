# Lumina Mapper Bridge - Milestone 0

This is a standalone Node.js bridge for the Lumina Mapper project, responsible for generating and sending Art-Net (ArtDMX) data to control 180 WS2811 LED pixels.

## Architecture

- **`index.js`**: Main loop (30 FPS default). Manages pattern cycling and splits the 180 pixels into two Art-Net universes.
- **`config.js`**: Global constants (Target IP, Port, Pixel Count).
- **`artnetSender.js`**: Low-level packing of ArtDMX packets using Node.js `dgram`. No external libraries are used for Art-Net logic.
- **`frameGenerator.js`**: Logical patterns (Corner tests, Gradients, Chases).

## Pixel Mapping

The 180 pixels (540 channels) are distributed as follows:
- **Universe 0**: Pixels 1 to 170 (Channels 1-510).
- **Universe 1**: Pixels 171 to 180 (Channels 1-30).

## How to Run

1. Ensure you have Node.js (v16+) installed.
2. Navigate to the `bridge` directory.
3. Run the bridge:
   ```bash
   node index.js
   ```

## How to Validate

### 1. Verification via Console
Check the terminal logs for:
- **FPS**: Should be stable around 30.
- **Universes**: Confirms U0 and U1 are being sent.
- **Pattern**: Displays the currently active test pattern.

### 2. Verification via Art-Net Receiver
You can use tools like:
- **QLC+**: Configure an Art-Net input on `127.0.0.1` and monitor the DMX monitor.
- **Art-Net Sniffer**: Any standard packet sniffer will show UDP packets on port `6454` with the "Art-Net" header.
- **WLED / ESP32**: If you have a physical device, point the `TARGET_IP` in `config.js` to its IP address.

### 3. Packet Structure
The `artnetSender.js` follows the Art-Net 4 specification:
- Header: `Art-Net\0`
- OpCode: `0x5000` (ArtDMX)
- Protocol: `14`
- Universe: Correctly handled as a 15-bit address in two bytes.
