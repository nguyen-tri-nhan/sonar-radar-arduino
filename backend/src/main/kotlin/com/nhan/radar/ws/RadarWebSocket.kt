package com.nhan.radar.ws

import com.fasterxml.jackson.databind.ObjectMapper
import io.quarkus.websockets.next.OnClose
import io.quarkus.websockets.next.OnOpen
import io.quarkus.websockets.next.OnTextMessage
import io.quarkus.websockets.next.WebSocket
import io.quarkus.websockets.next.WebSocketConnection
import jakarta.inject.Inject
import org.jboss.logging.Logger

@WebSocket(path = "/ws/radar")
class RadarWebSocket {

    @Inject lateinit var broadcaster: RadarBroadcaster
    @Inject lateinit var objectMapper: ObjectMapper

    @OnOpen
    fun onOpen(connection: WebSocketConnection) {
        log.infof("[WS] Client connected: %s", connection.id())
        broadcaster.subscribeToAll(connection.id())
    }

    @OnTextMessage
    fun onMessage(message: String, connection: WebSocketConnection) {
        try {
            val req = objectMapper.readValue(message, SubscribeRequest::class.java)
            when (req.action.uppercase()) {
                "SUBSCRIBE"   -> broadcaster.subscribe(connection.id(), req.radarIds)
                "UNSUBSCRIBE" -> broadcaster.unsubscribe(connection.id(), req.radarIds)
                else          -> log.warnf("[WS] Unknown action '%s' from %s", req.action, connection.id())
            }
        } catch (e: Exception) {
            log.warnf("[WS] Unreadable message from %s: %s", connection.id(), message)
        }
    }

    @OnClose
    fun onClose(connection: WebSocketConnection) {
        log.infof("[WS] Client disconnected: %s", connection.id())
        broadcaster.removeConnection(connection.id())
    }

    companion object {
        private val log = Logger.getLogger(RadarWebSocket::class.java)
    }
}
