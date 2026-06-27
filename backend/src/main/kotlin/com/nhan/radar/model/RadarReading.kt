package com.nhan.radar.model

data class RadarReading(
    val radarId: String,
    val pan: Int,
    val tilt: Int,
    val distance: Int,
    val timestamp: Long,
)
