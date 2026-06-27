# Sonar Radar Arduino

Real-time ultrasonic radar visualization — HC-SR04 sensor on Arduino Uno, streamed via serial to a Quarkus WebSocket server, displayed as a live radar sweep in the browser.

## Architecture

```
Arduino Uno (HC-SR04)
        │ USB Serial (9600 baud)
        ▼
Quarkus Backend (Kotlin)
  • Reads serial port
  • Broadcasts via WebSocket
        │ ws://localhost:8080/ws/radar
        ▼
React Frontend (Vite + Canvas)
  • Radar sweep visualization
  • Alpha-fade trail effect
```

## Project Structure

```
sonar-radar-arduino/
├── arduino/
│   └── radar_sketch/
│       └── radar_sketch.ino   # HC-SR04 sketch, sends "angle,distance\n"
├── backend/                   # Quarkus + Kotlin + Gradle
│   └── src/main/kotlin/com/nhan/radar/
│       ├── ingest/            # Serial port reader (hot-plug, 3s retry)
│       ├── registry/          # Radar state & heartbeat
│       ├── ws/                # WebSocket endpoint + broadcaster
│       └── model/             # RadarReading data class
├── frontend/                  # React + Vite + TypeScript
│   └── src/
│       ├── components/        # RadarCanvas (canvas + rAF loop)
│       ├── hooks/             # useRadarWebSocket (auto-reconnect)
│       ├── types/             # RadarReading, RadarPoint
│       └── utils/             # radarMath (cm→m, toCanvasXY)
└── specs/                     # Design docs
```

## Hardware

| Component | Detail |
|-----------|--------|
| Board | Arduino Uno |
| Sensor | HC-SR04 ultrasonic |
| Trig pin | D9 |
| Echo pin | D10 |
| Max range | 4 m |
| Sample rate | 10 Hz (100 ms) |

## Getting Started

### 1. Upload Arduino sketch

Open `arduino/radar_sketch/radar_sketch.ino` in Arduino IDE and upload to your Uno. Close the Serial Monitor before starting the backend.

### 2. Start the backend

```bash
cd backend
./gradlew quarkusDev
```

The backend reads from `/dev/cu.usbmodem11301` by default (macOS). Override in `src/main/resources/application.properties`:

```properties
radar.serial.port=/dev/cu.usbmodemXXXX
radar.poc.radar-id=r-01
```

Hot-plug is supported — the backend retries the serial port every 3 s if Arduino is not yet connected.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## WebSocket Protocol

**URL**: `ws://localhost:8080/ws/radar`

**Server → Client** (reading):
```json
{
  "type": "READING",
  "radarId": "r-01",
  "angle": 90,
  "distance": 66,
  "timestamp": 1782579639012
}
```
`distance` is in **cm**. The frontend converts to meters (`÷ 100`).

**Client → Server** (subscribe):
```json
{ "action": "SUBSCRIBE",   "radarIds": ["r-01"] }
{ "action": "UNSUBSCRIBE", "radarIds": ["r-01"] }
```

New connections are auto-subscribed to all known radars.

## Roadmap

- [x] Phase 1 — Arduino sketch (HC-SR04, fixed 90° angle)
- [x] Phase 2 — Quarkus backend (serial ingest, WebSocket, hot-plug)
- [x] Phase 3 — React frontend (canvas radar, alpha fade, WS reconnect)
- [ ] Phase 4 — PostgreSQL persistence + detection history API
- [ ] Phase 5 — Multi-radar UI (1 / 2×2 layout, offline overlay)
- [ ] Phase 6 — Servo support (sweeping angle), 3D-printed mount
