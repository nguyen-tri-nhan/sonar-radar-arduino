// Sonar Radar — Arduino Sketch
// Serial output: "pan,tilt,distance_cm\n" @ 9600 baud
//
// Flip USE_SERVO to 1 when servo is wired — no other file needs to change.
//
// Wiring (HC-SR04):
//   VCC  → 5V  |  GND → GND
//   TRIG → D9  |  ECHO → D10
//
// Wiring (pan servo, when USE_SERVO=1):
//   Signal → D6  |  VCC → 5V  |  GND → GND

#define USE_SERVO     0   // 0 = software sweep, 1 = real servo on D6
#define SERVO_PIN     6
#define TRIG_PIN      9
#define ECHO_PIN      10

#define FIXED_TILT    45  // degrees — replace with tiltServo.read() when 2nd servo added
#define STEP_DEG      2   // sweep step in degrees
#define STEP_DELAY_MS 15  // ms between steps (controls sweep speed)
#define MAX_DIST_CM   400
#define ECHO_TIMEOUT  25000  // µs — covers 4m round-trip

#if USE_SERVO
#include <Servo.h>
Servo panServo;
#endif

int panAngle = 0;
int sweepDir = 1;  // +1 ascending, -1 descending

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

#if USE_SERVO
  panServo.attach(SERVO_PIN);
  panServo.write(0);
  delay(500);  // let servo reach start position
#endif
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT);
  if (duration == 0) return 0;  // timeout → nothing in range

  long dist = duration * 17L / 1000;  // duration * 0.034 / 2, integer math
  if (dist < 2 || dist > MAX_DIST_CM) return 0;
  return dist;
}

void loop() {
#if USE_SERVO
  panServo.write(panAngle);
  delay(15);  // let servo settle before reading
#endif

  long distance = readDistanceCm();

  Serial.print(panAngle);
  Serial.print(",");
  Serial.print(FIXED_TILT);  // swap for tiltServo.read() when 2nd servo added
  Serial.print(",");
  Serial.println(distance);  // 0 = no object (backend/FE still get the sweep angle)

  // Advance sweep
  panAngle += sweepDir * STEP_DEG;
  if (panAngle >= 180) { panAngle = 180; sweepDir = -1; }
  if (panAngle <= 0)   { panAngle = 0;   sweepDir =  1; }

  delay(STEP_DELAY_MS);
}
