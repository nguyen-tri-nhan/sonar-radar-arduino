package com.nhan.radar.registry

import com.nhan.radar.model.RadarReading
import io.quarkus.scheduler.Scheduled
import jakarta.enterprise.context.ApplicationScoped
import org.jboss.logging.Logger
import java.util.concurrent.ConcurrentHashMap

@ApplicationScoped
class RadarRegistry {

    enum class RadarStatus { ONLINE, OFFLINE }

    private val lastSeen   = ConcurrentHashMap<String, Long>()
    private val statusMap  = ConcurrentHashMap<String, RadarStatus>()
    private val lastFrame  = ConcurrentHashMap<String, RadarReading>()
    private val knownRadars: MutableSet<String> = ConcurrentHashMap.newKeySet()

    fun onReading(reading: RadarReading) {
        lastSeen[reading.radarId]  = System.currentTimeMillis()
        lastFrame[reading.radarId] = reading
        statusMap[reading.radarId] = RadarStatus.ONLINE
        knownRadars.add(reading.radarId)
    }

    fun getStatus(radarId: String)   = statusMap.getOrDefault(radarId, RadarStatus.OFFLINE)
    fun getLastFrame(radarId: String) = lastFrame[radarId]
    fun getKnownRadars(): Set<String> = knownRadars.toSet()
    fun getAllStatuses(): Map<String, RadarStatus> = statusMap.toMap()

    @Scheduled(every = "2s")
    fun checkHeartbeats() {
        val now = System.currentTimeMillis()
        lastSeen.forEach { (radarId, ts) ->
            if (now - ts > OFFLINE_TIMEOUT_MS) {
                val prev = statusMap.put(radarId, RadarStatus.OFFLINE)
                if (prev == RadarStatus.ONLINE) {
                    log.infof("[RADAR %s] → OFFLINE (no data for >%ds)", radarId, OFFLINE_TIMEOUT_MS / 1000)
                }
            }
        }
    }

    companion object {
        private val log = Logger.getLogger(RadarRegistry::class.java)
        private const val OFFLINE_TIMEOUT_MS = 5_000L
    }
}
