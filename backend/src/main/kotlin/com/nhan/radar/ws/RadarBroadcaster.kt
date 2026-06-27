package com.nhan.radar.ws

import com.fasterxml.jackson.databind.ObjectMapper
import com.nhan.radar.model.RadarReading
import com.nhan.radar.registry.RadarRegistry
import io.quarkus.websockets.next.OpenConnections
import io.quarkus.websockets.next.WebSocketConnection
import jakarta.enterprise.context.ApplicationScoped
import jakarta.inject.Inject
import org.jboss.logging.Logger
import java.util.concurrent.ConcurrentHashMap

@ApplicationScoped
class RadarBroadcaster {

    @Inject lateinit var openConnections: OpenConnections
    @Inject lateinit var objectMapper: ObjectMapper
    @Inject lateinit var registry: RadarRegistry

    // radarId → Set<connectionId>
    private val subscriptions = ConcurrentHashMap<String, MutableSet<String>>()

    fun subscribe(connectionId: String, radarIds: List<String>) {
        radarIds.forEach { radarId ->
            subscriptions.computeIfAbsent(radarId) { ConcurrentHashMap.newKeySet() }.add(connectionId)
        }
        log.infof("[WS] Client %s subscribed to: %s", connectionId, radarIds)
    }

    fun unsubscribe(connectionId: String, radarIds: List<String>) {
        radarIds.forEach { radarId -> subscriptions[radarId]?.remove(connectionId) }
        log.infof("[WS] Client %s unsubscribed from: %s", connectionId, radarIds)
    }

    fun removeConnection(connectionId: String) {
        subscriptions.values.forEach { it.remove(connectionId) }
        log.infof("[WS] Client %s removed from all subscriptions", connectionId)
    }

    fun subscribeToAll(connectionId: String) {
        val known = registry.getKnownRadars()
        if (known.isEmpty()) {
            log.infof("[WS] Client %s connected — no known radars yet (will receive all broadcasts)", connectionId)
        } else {
            subscribe(connectionId, known.toList())
        }
    }

    fun broadcast(reading: RadarReading) {
        val json = objectMapper.writeValueAsString(
            mapOf(
                "type"      to "READING",
                "radarId"   to reading.radarId,
                "pan"       to reading.pan,
                "tilt"      to reading.tilt,
                "distance"  to reading.distance,
                "timestamp" to reading.timestamp,
            )
        )

        val subscribers = subscriptions[reading.radarId]
        val broadcastAll = subscribers.isNullOrEmpty()
        val clientCount  = if (broadcastAll) openConnections.stream().count() else subscribers!!.size.toLong()

        log.infof("[BROADCAST → %d client(s)] %s", clientCount, json)

        if (broadcastAll) {
            openConnections.stream().forEach { it.sendSafe(json) }
        } else {
            openConnections.stream()
                .filter { it.id() in subscribers!! }
                .forEach { it.sendSafe(json) }
        }
    }

    private fun WebSocketConnection.sendSafe(json: String) =
        sendText(json).subscribe().with(
            {},
            { err -> log.errorf("[WS] Send failed to %s: %s", id(), err.message) }
        )

    companion object {
        private val log = Logger.getLogger(RadarBroadcaster::class.java)
    }
}
