import { SerialPort } from 'serialport';

console.log('Scanning for serial ports...');
SerialPort.list().then(ports => {
    if (ports.length === 0) {
        console.log('No ports found.');
    } else {
        ports.forEach(port => {
            console.log(`FOUND: ${port.path}\t${port.manufacturer || ''}\t${port.serialNumber || ''}`);
        });
    }
}).catch(err => {
    console.error('Error listing ports:', err);
});
