package com.nhan.radar.ingest

import com.fazecast.jSerialComm.SerialPort
import com.nhan.radar.model.RadarReading
import com.nhan.radar.ws.RadarBroadcaster
import io.quarkus.runtime.ShutdownEvent
import io.quarkus.runtime.StartupEvent
import io.quarkus.scheduler.Scheduled
import jakarta.enterprise.context.ApplicationScoped
import jakarta.enterprise.event.Observes
import jakarta.inject.Inject
import org.eclipse.microprofile.config.inject.ConfigProperty
import org.jboss.logging.Logger
import java.io.BufferedReader
import java.io.InputStreamReader

@ApplicationScoped
class SerialIngestService {

    @Inject lateinit var broadcaster: RadarBroadcaster

    @ConfigProperty(name = "radar.serial.port", defaultValue = "/dev/cu.usbmodem11301")
    lateinit var serialPortName: String

    @ConfigProperty(name = "radar.serial.baud", defaultValue = "9600")
    var baudRate: Int = 9600

    @ConfigProperty(name = "radar.poc.radar-id", defaultValue = "r-01")
    lateinit var radarId: String

    private var port: SerialPort? = null
    @Volatile private var running = false

    fun onStart(@Observes event: StartupEvent) {
        retryOpenPort() // thử ngay lúc startup, scheduler tiếp tục mỗi 3s nếu chưa mở được
    }

    fun onStop(@Observes event: ShutdownEvent) {
        running = false
        port?.takeIf { it.isOpen }?.closePort()
        log.info("[SERIAL] Port closed")
    }

    @Scheduled(every = "3s")
    fun retryOpenPort() {
        if (running) return
        try {
            val p = SerialPort.getCommPort(serialPortName).also {
                it.setBaudRate(baudRate)
                it.setComPortTimeouts(SerialPort.TIMEOUT_SCANNER, 0, 0)
            }
            if (!p.openPort()) {
                log.debugf("[SERIAL] Waiting for port %s...", serialPortName)
                return
            }
            port = p
            log.infof("[SERIAL] Opened port %s @ %d baud (radarId=%s)", serialPortName, baudRate, radarId)
            running = true
            Thread(::readLoop, "serial-reader").apply { isDaemon = true }.start()
        } catch (e: Exception) {
            log.debugf("[SERIAL] Waiting for port %s... (%s)", serialPortName, e.message)
        }
    }

    private fun readLoop() {
        try {
            BufferedReader(InputStreamReader(port!!.inputStream)).use { reader ->
                while (running) {
                    val line = reader.readLine() ?: break
                    parseLine(line.trim())
                }
            }
        } catch (e: Exception) {
            if (running) log.warnf("[SERIAL] Connection lost: %s — will retry in 3s...", e.message)
        } finally {
            running = false
            port?.closePort()
            log.info("[SERIAL] Reader stopped")
        }
    }

    private fun parseLine(line: String) {
        if (line.isEmpty() || !READING_RE.matches(line)) return
        val parts    = line.split(',')
        val pan      = parts[0].toInt()
        val tilt     = parts[1].toInt()
        val distance = parts[2].toInt()

        val reading = RadarReading(radarId, pan, tilt, distance, System.currentTimeMillis())
        log.infof("[SERIAL] Read  → radarId=%s  pan=%d°  tilt=%d°  distance=%dcm", radarId, pan, tilt, distance)
        broadcaster.broadcast(reading)
    }

    companion object {
        private val log = Logger.getLogger(SerialIngestService::class.java)
        private val READING_RE = Regex("""^\d+,\d+,\d+$""")
    }
}
