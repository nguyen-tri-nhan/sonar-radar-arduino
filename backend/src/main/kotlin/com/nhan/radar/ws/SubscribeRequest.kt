package com.nhan.radar.ws

data class SubscribeRequest(val action: String, val radarIds: List<String>)
