// Sonar Radar — Arduino Sketch
// POC: 1 HC-SR04, góc cố định 90°
// Serial output: "angle,distance_cm\n" @ 9600 baud, 10Hz
//
// Wiring:
//   HC-SR04 VCC  → Arduino 5V
//   HC-SR04 GND  → Arduino GND
//   HC-SR04 TRIG → Arduino D9
//   HC-SR04 ECHO → Arduino D10
//
// Future: thêm servo → chỉ đổi FIXED_ANGLE thành servo.read()

#define TRIG_PIN          9
#define ECHO_PIN          10
#define FIXED_ANGLE       90
#define MAX_DISTANCE_CM   400
#define SAMPLE_INTERVAL_MS 100

// HC-SR04 max range ~4m → round-trip ~24ms → timeout 25000µs
#define ECHO_TIMEOUT_US   25000

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
}

long readDistanceCm() {
  // Trigger: 10µs HIGH pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Đo thời gian echo HIGH (µs)
  long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);

  if (duration == 0) return 0; // timeout → không có vật trong range

  // distance = duration × tốc độ âm / 2 (khứ hồi)
  // 0.034 cm/µs = tốc độ âm
  long distance = duration * 17L / 1000; // tương đương duration * 0.034 / 2, tránh float

  if (distance < 2 || distance > MAX_DISTANCE_CM) return 0;

  return distance;
}

void loop() {
  long distance = readDistanceCm();

  // distance = 0 → không có vật, backend/FE bỏ qua điểm nhưng vẫn biết angle đang quét
  Serial.print(FIXED_ANGLE);
  Serial.print(",");
  Serial.println(distance);

  delay(SAMPLE_INTERVAL_MS);
}
