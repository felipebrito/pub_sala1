import sys
import os
import subprocess

def flash_esp(port, firmware_path):
    """
    Flashes the ESP32 with the provided firmware binary using esptool.
    """
    if not os.path.exists(firmware_path):
        print(f"Error: Firmware file not found at {firmware_path}")
        sys.exit(1)

    # Determine directory of firmware file to find siblings
    firmware_dir = os.path.dirname(firmware_path)
    bootloader_path = os.path.join(firmware_dir, "bootloader.bin")
    partitions_path = os.path.join(firmware_dir, "partitions.bin")

    # Verify all files exist
    if not os.path.exists(bootloader_path):
        print(f"Error: Bootloader not found at {bootloader_path}")
        sys.exit(1)
    if not os.path.exists(partitions_path):
        print(f"Error: Partitions not found at {partitions_path}")
        sys.exit(1)

    print(f"Flashing to {port}...")
    print(f"  0x1000:  {bootloader_path}")
    print(f"  0x8000:  {partitions_path}")
    print(f"  0x10000: {firmware_path}")

    cmd = [
        sys.executable, "-m", "esptool",
        "--chip", "esp32",
        "--port", port,
        "--baud", "230400",  # Lowered from 460800 for stability
        "--before", "default_reset",
        "--after", "hard_reset",
        "write_flash",
        "-z",
        "--flash_mode", "dio",
        "--flash_freq", "40m",
        "--flash_size", "detect",
        "0x1000", bootloader_path,
        "0x8000", partitions_path,
        "0x10000", firmware_path
    ]

    try:
        subprocess.check_call(cmd)
        print("Flashing complete!")
    except subprocess.CalledProcessError as e:
        print("Error during flashing.")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: esptool not found. Please install it with 'pip install esptool'.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python flash_firmware.py <serial_port> <firmware_binary_path>")
        print("Example: python flash_firmware.py /dev/ttyUSB0 firmware.bin")
        sys.exit(1)

    port = sys.argv[1]
    firmware = sys.argv[2]
    flash_esp(port, firmware)
