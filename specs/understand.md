# Understanding: Sonar Radar Project

> Phiên bản cuối — sau toàn bộ brainstorm session 2026-06-27

---

## Quyết định thiết kế đã chốt

| Quyết định | Chọn | Lý do |
|------------|------|-------|
| POC hardware | 1 sensor HC-SR04, góc cố định 90° | Chưa có servo |
| Servo | Thiết kế sẵn, thêm sau | Chỉ đổi 1 dòng Arduino |
| Range | 4m (giới hạn HC-SR04) | Chấp nhận |
| Multi-radar | Hỗ trợ 10–100 radars | Design từ đầu |
| Kết nối | USB (POC) → WiFi/Bluetooth (future) | Additive, không refactor |
| Backend | Quarkus monolith + Gradle + Java 17 | Không cần Kafka ở scale này |
| Database | PostgreSQL | Radar config + detection history |
| FE layout | 1 radar hoặc 2×2 grid, configurable | User chọn |
| Offline radar | Giữ frame cuối + overlay "OFFLINE" | UX tốt hơn là ẩn đi |
| Radar naming | Có (VD: "Cổng vào", "Kho B") | Lưu trong DB |

---

## Kiến trúc tổng thể

```
[Arduino r-01] ──USB Serial──────────────────────────────────────────────►┐
[Arduino r-02] ──WiFi POST /api/ingest/{radarId} (future) ───────────────►│
[Arduino r-..] ──WiFi/BT (future) ───────────────────────────────────────►│
                                                                            │
                                                              ┌─────────────▼──────────────┐
                                                              │       Quarkus Backend       │
                                                              │                             │
                                                              │  IngestService              │
                                                              │       │                     │
                                                              │  ┌────┴────────────┐        │
                                                              │  │  RadarRegistry  │        │
                                                              │  │  (in-memory)    │        │
                                                              │  │  - status map   │        │
                                                              │  │  - last frame   │        │
                                                              │  │  - heartbeat    │        │
                                                              │  └────┬────────────┘        │
                                                              │       │                     │
                                                              │  ┌────▼──────────────────┐  │
                                                              │  │  WS Broadcaster       │  │
                                                              │  │  (selective by sub)   │  │
                                                              │  └────┬──────────────────┘  │
                                                              │       │                     │
                                                              │  DetectionService ──► PG    │
                                                              │  RadarConfigService ──► PG  │
                                                              └───────┼─────────────────────┘
                                                                      │ WebSocket
                                                          ┌───────────┴───────────┐
                                                          ▼                       ▼
                                                     Client A               Client B
                                                  sub: [r-01,r-02]       sub: [r-03]
```

---

## Data Formats

### Arduino → Backend (Serial / HTTP)

```
USB Serial (POC):
  "90,230\n"          ← angle cố định 90°, distance 230cm

WiFi future (HTTP POST /api/ingest/{radarId}):
  {"angle": 45, "distance": 150}
```

### Backend → Frontend (WebSocket)

```json
// Reading event
{
  "type": "READING",
  "radarId": "r-01",
  "angle": 90,
  "distance": 230,
  "timestamp": 1719456789123
}

// Status event (online/offline)
{
  "type": "STATUS",
  "radarId": "r-01",
  "status": "OFFLINE",
  "lastSeen": 1719456789123
}

// Initial state (gửi ngay khi client kết nối)
{
  "type": "SNAPSHOT",
  "radars": [
    {"radarId": "r-01", "name": "Cổng vào", "status": "ONLINE", "lastFrame": {...}},
    {"radarId": "r-02", "name": "Kho B",    "status": "OFFLINE", "lastFrame": {...}}
  ]
}
```

### Client → Backend (WebSocket subscription)

```json
{"action": "SUBSCRIBE",   "radarIds": ["r-01", "r-02"]}
{"action": "UNSUBSCRIBE", "radarIds": ["r-02"]}
```

---

## Database Schema

```sql
-- Radar config (CRUD)
CREATE TABLE radar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detection history (chỉ lưu khi phát hiện vật, không lưu "không có gì")
CREATE TABLE radar_detection (
  id          BIGSERIAL PRIMARY KEY,
  radar_id    UUID NOT NULL REFERENCES radar(id),
  detected_at TIMESTAMPTZ NOT NULL,
  angle       INT NOT NULL,      -- degrees
  distance    INT NOT NULL,      -- cm
  session_id  UUID NOT NULL      -- nhóm 1 phiên bật máy
);

CREATE INDEX idx_detection_time    ON radar_detection(detected_at DESC);
CREATE INDEX idx_detection_radar   ON radar_detection(radar_id, detected_at DESC);
CREATE INDEX idx_detection_session ON radar_detection(session_id);
```

---

## Backend — Chi tiết

**Stack:** Quarkus + Gradle + Java 17

**Dependencies:**
```groovy
implementation 'io.quarkus:quarkus-websockets-next'
implementation 'io.quarkus:quarkus-rest-jackson'
implementation 'io.quarkus:quarkus-hibernate-orm-panache'
implementation 'io.quarkus:quarkus-jdbc-postgresql'
implementation 'com.fazecast:jSerialComm:2.10.4'
```

**Package structure:**
```
com.nhan.radar/
├── ingest/
│   ├── SerialIngestService.java       ← đọc USB serial, fire CDI event
│   └── HttpIngestResource.java        ← POST /api/ingest/{radarId} (future WiFi)
├── registry/
│   └── RadarRegistry.java             ← in-memory state: status, last frame, heartbeat
├── ws/
│   ├── RadarWebSocket.java            ← @ServerEndpoint("/ws/radar")
│   └── RadarBroadcaster.java          ← selective push theo subscription
├── detection/
│   ├── RadarDetection.java            ← Panache entity
│   ├── DetectionService.java          ← lưu detection async
│   └── DetectionResource.java         ← GET /api/radars/{id}/detections
├── config/
│   ├── Radar.java                     ← Panache entity
│   └── RadarConfigResource.java       ← CRUD /api/radars
└── model/
    └── RadarReading.java              ← DTO: radarId, angle, distance, timestamp
```

**REST API:**
```
POST   /api/radars                          ← tạo radar mới
GET    /api/radars                          ← list all + ONLINE/OFFLINE status
GET    /api/radars/{id}                     ← detail
PUT    /api/radars/{id}                     ← đổi tên/description
DELETE /api/radars/{id}                     ← xóa

POST   /api/ingest/{radarId}               ← WiFi Arduino gửi data (future)

GET    /api/radars/{id}/detections          ← lịch sử
       ?from=...&to=...&limit=...
GET    /api/radars/{id}/detections/sessions ← danh sách session
GET    /api/detections/sessions/{sessionId} ← toàn bộ detections 1 session
```

**Heartbeat logic:**
- Mỗi reading → cập nhật `lastSeen[radarId]`
- Scheduler chạy mỗi 2s: nếu `now - lastSeen > 5s` → đánh dấu OFFLINE, broadcast STATUS event

**POC config (application.properties):**
```properties
radar.serial.port=/dev/cu.usbmodem11301
radar.serial.baud=9600
radar.poc.radarId=r-01
radar.heartbeat.timeout-seconds=5
```

---

## Frontend — Chi tiết

**Stack:** React + Vite + TypeScript (follow mini-social-network)

**Package structure:**
```
src/
├── App.tsx
├── api/
│   └── radarApi.ts                  ← REST calls (axios/fetch)
├── components/
│   ├── RadarCanvas.tsx              ← canvas render 1 radar
│   ├── RadarPanel.tsx               ← canvas + header (tên, status badge)
│   ├── RadarGrid.tsx                ← layout 1 hoặc 2×2
│   ├── RadarSelector.tsx            ← chọn radar nào vào slot nào
│   └── LayoutToggle.tsx             ← switch 1 / 2×2
├── hooks/
│   ├── useRadarWebSocket.ts         ← WS connection, subscription management
│   └── useRadarState.ts             ← state per radarId (readings, status, lastFrame)
├── utils/
│   └── radarMath.ts                 ← (angle, distance) → (x, y) canvas
└── types/
    └── radar.ts                     ← RadarReading, RadarStatus, RadarConfig...
```

**UI layout:**
```
┌─ Toolbar ────────────────────────────────────────────┐
│  Sonar Radar  [■ Single | ⊞ 2×2]   [Manage Radars]  │
└──────────────────────────────────────────────────────┘

Single mode:              2×2 mode:
┌─────────────────┐      ┌──────────┬──────────┐
│  [Cổng vào ●]   │      │[Cổng vào]│[Kho B ●] │
│                 │      │    ●     │          │
│   radar canvas  │      ├──────────┼──────────┤
│                 │      │[Sân sau] │[Tầng 2]  │
└─────────────────┘      │ OFFLINE  │  +Select │
                          └──────────┴──────────┘
```

**RadarCanvas render loop:**
```
requestAnimationFrame:
  clear canvas
  draw: nền đen
  draw: 4 vòng tròn đồng tâm (1m/2m/3m/4m) — màu xanh lá mờ
  draw: labels (1m, 2m, 3m, 4m)
  draw: sweep line tại angle hiện tại
  draw: tất cả điểm đỏ với alpha decay (fade effect)
  if status === OFFLINE: overlay mờ + text "OFFLINE"

WebSocket onmessage (READING):
  if radarId match:
    distanceM = distance / 100   ← FE tự convert cm → m
    add point {angle, distanceM, alpha: 1.0} to points[]

WebSocket onmessage (STATUS → OFFLINE):
  freeze last frame, show overlay

On connect → gửi SNAPSHOT request → nhận lastFrame → hiển thị ngay
```

---

## POC vs Multi-radar — Diff

| Layer | POC (hiện tại) | Multi-radar |
|-------|----------------|-------------|
| Arduino | `"90,distance\n"` qua USB | Thêm WiFi module, tự gửi HTTP |
| Backend ingest | `SerialIngestService` hardcode radarId | `HttpIngestResource` nhận từ nhiều nguồn |
| WS message | Có radarId từ đầu ✅ | Không đổi |
| WS subscription | Client subscribe r-01 ✅ | Client subscribe nhiều radarId |
| Frontend | 1 RadarPanel, layout 1 | N RadarPanel, layout toggle |
| DB | Radar table + detections ✅ | Không đổi |

**POC đã thiết kế multi-radar-ready.** Khi thêm hardware chỉ thêm Arduino mới, đăng ký radarId, done.

---

## Cấu trúc thư mục dự án

```
sonar-radar-arduino/
├── Makefile                              ← dev, build, run commands
├── specs/
│   ├── requirement.md
│   └── understand.md
├── arduino/
│   └── radar_sketch/
│       └── radar_sketch.ino
├── backend/                              ← Quarkus, Gradle, Java 17
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradle/
│   └── src/main/
│       ├── java/com/nhan/radar/
│       │   ├── ingest/
│       │   ├── registry/
│       │   ├── ws/
│       │   ├── detection/
│       │   ├── config/
│       │   └── model/
│       └── resources/
│           └── application.properties
└── frontend/                             ← React, Vite, TypeScript
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── api/
        ├── components/
        ├── hooks/
        ├── utils/
        └── types/
```

---

## Implementation Plan

### Phase 1 — Arduino Sketch
**Goal:** Arduino gửi `"90,<distance>\n"` ổn định qua USB Serial

- [ ] Viết sketch đọc HC-SR04 bằng raw pulse (không dùng thư viện ngoài)
- [ ] Gửi `"90,<distance_cm>\n"` qua Serial @ 9600 baud mỗi 100ms
- [ ] Validate: mở Serial Monitor, thấy số thay đổi khi đưa tay lại gần

### Phase 2 — Quarkus Backend (core pipeline)
**Goal:** Backend nhận serial, broadcast WebSocket với radarId

- [ ] Init project: `quarkus create app radar-backend --build-tool=gradle-kotlin-dsl --java=17`
- [ ] Add extensions: `quarkus-websockets-next`, `quarkus-rest-jackson`
- [ ] Add `jSerialComm` dependency vào `build.gradle.kts`
- [ ] `RadarReading.java` — DTO (radarId, angle, distance, timestamp)
- [ ] `RadarRegistry.java` — in-memory map, heartbeat scheduler
- [ ] `SerialIngestService.java` — đọc serial, parse, update registry, fire CDI event
- [ ] `RadarBroadcaster.java` — giữ WS sessions theo subscription
- [ ] `RadarWebSocket.java` — handle connect/disconnect/subscribe message
- [ ] Validate: `websocat ws://localhost:8080/ws/radar` nhận được JSON

### Phase 3 — React Frontend (radar canvas)
**Goal:** Thấy điểm đỏ di chuyển trên radar

- [ ] Init project: `npm create vite@latest frontend -- --template react-ts`
- [ ] `radarMath.ts` — hàm convert (angle, distance_cm) → (x, y): chia 100 ra m, rồi map lên canvas px
- [ ] `RadarCanvas.tsx` — canvas với vòng tròn + sweep + điểm đỏ + fade
- [ ] `useRadarWebSocket.ts` — connect WS, parse messages, manage subscription
- [ ] `useRadarState.ts` — state per radarId
- [ ] `RadarPanel.tsx` — canvas + status badge + radar name
- [ ] `App.tsx` — single panel layout, kết nối WS, subscribe r-01
- [ ] Validate: thấy điểm đỏ thay đổi khi đưa tay lại gần sensor

### Phase 4 — Database + CRUD API
**Goal:** Lưu detection history, quản lý radar config

- [ ] Add extensions: `quarkus-hibernate-orm-panache`, `quarkus-jdbc-postgresql`
- [ ] `Radar.java` — Panache entity
- [ ] `RadarDetection.java` — Panache entity
- [ ] `RadarConfigResource.java` — CRUD `/api/radars`
- [ ] `DetectionService.java` — lưu detection async (CDI event)
- [ ] `DetectionResource.java` — GET `/api/radars/{id}/detections`
- [ ] Setup PostgreSQL local (Docker)
- [ ] Validate: POST tạo radar, thấy detections được lưu

### Phase 5 — Multi-radar UI
**Goal:** Dashboard quản lý nhiều radar, layout toggle

- [ ] `RadarGrid.tsx` — layout 1 hoặc 2×2
- [ ] `LayoutToggle.tsx` — switch layout
- [ ] `RadarSelector.tsx` — chọn radar vào từng slot
- [ ] `radarApi.ts` — GET `/api/radars` để load danh sách
- [ ] Handle offline: freeze last frame + overlay
- [ ] Handle SNAPSHOT: hiển thị last frame ngay khi kết nối
- [ ] Validate: mở 2 tab, 1 tab nhìn layout 2×2

### Phase 6 — Integration & Polish
**Goal:** Full pipeline, edge cases handled

- [ ] Test reconnect WebSocket khi backend restart
- [ ] Test serial disconnect/reconnect (rút USB)
- [ ] Heartbeat timeout → OFFLINE event → FE hiển thị đúng
- [ ] Makefile: `make dev-backend`, `make dev-frontend`, `make dev` (cả 2)
