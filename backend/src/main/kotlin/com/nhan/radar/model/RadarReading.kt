package com.nhan.radar.model

data class RadarReading(
    val radarId: String,
    val angle: Int,
    val distance: Int,
    val timestamp: Long,
)
