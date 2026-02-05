#include <Arduino.h>
#include <FastLED.h>

// ----- CONFIGURATION -----
// Adalight sends a header "Ada" followed by high byte count, low byte count,
// checksum. Baudrate: 115200 is standard, but ESP32 can handle much higher
// (e.g., 921600 or 2000000). Ensure the sender matches this baudrate.

#define LED_PIN                                                                \
  2 // GPIO 2 is a good default for built-in LED on some boards, but usually
    // D4/D2. Connect Data In here.
#define NUM_LEDS 300 // Max standard buffer, can be increased.
#define BAUDRATE 115200

CRGB leds[NUM_LEDS];

// Adalight Header
// Magid word "Ada" (0x41, 0x64, 0x61)
// Hi Byte count (Count - 1) >> 8
// Lo Byte count (Count - 1) & 0xFF
// Checksum (Hi ^ Lo ^ 0x55)

void setup() {
  Serial.begin(BAUDRATE);
  // Wait for serial to stabilize
  delay(1000);

  // "Magic Word" string to tell host we are ready (Optional, but good for some
  // software)
  Serial.print("Ada\n");

  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(100);

  // Startup Animation: Red -> Green -> Blue
  for (int i = 0; i < 3; i++) {
    fill_solid(leds, NUM_LEDS, CRGB::Red);
    FastLED.show();
    delay(100);
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    delay(100);
    fill_solid(leds, NUM_LEDS, CRGB::Green);
    FastLED.show();
    delay(100);
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    delay(100);
    fill_solid(leds, NUM_LEDS, CRGB::Blue);
    FastLED.show();
    delay(100);
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    delay(100);
  }
}

void loop() {
  if (Serial.available()) {
    // Check for PING command "PING"
    // To keep it robust, we look for 'P' first

    char c = Serial.peek();

    // HANDSHAKE: PING -> LUMINA_OK
    if (c == 'P') {
      String cmd = Serial.readStringUntil('\n');
      // Trim whitespace
      cmd.trim();
      if (cmd == "PING") {
        Serial.println("LUMINA_OK");

        // Visual Feedback
        fill_solid(leds, NUM_LEDS, CRGB::White);
        FastLED.show();
        delay(500);
        fill_solid(leds, NUM_LEDS, CRGB::Black);
        FastLED.show();
        return;
      }
    }

    // Wait for header "Ada"
    if (Serial.available() >= 6) { // Header is 6 bytes
      if (Serial.read() == 'A') {
        if (Serial.read() == 'd') {
          if (Serial.read() == 'a') {
            // Header found!
            uint8_t hi = Serial.read();
            uint8_t lo = Serial.read();
            uint8_t chk = Serial.read();

            // Verify checksum
            if (chk == (hi ^ lo ^ 0x55)) {
              unsigned int count = ((hi << 8) | lo) + 1;
              if (count > NUM_LEDS)
                count = NUM_LEDS;

              // Read Data
              Serial.readBytes((char *)leds, count * 3);
              FastLED.show();
            }
          }
        }
      }
    }
  }
}
