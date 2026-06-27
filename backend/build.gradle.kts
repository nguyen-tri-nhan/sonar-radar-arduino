plugins {
    kotlin("jvm") version "2.1.21"
    kotlin("plugin.allopen") version "2.1.21"
    id("io.quarkus") version "3.25.1"
}

group = "com.nhan.radar"
version = "1.0.0-SNAPSHOT"

val quarkusPlatformGroupId: String by project
val quarkusPlatformArtifactId: String by project
val quarkusPlatformVersion: String by project

repositories {
    mavenCentral()
    mavenLocal()
}

dependencies {
    implementation(enforcedPlatform("${quarkusPlatformGroupId}:${quarkusPlatformArtifactId}:${quarkusPlatformVersion}"))
    implementation("io.quarkus:quarkus-arc")
    implementation("io.quarkus:quarkus-websockets-next")
    implementation("io.quarkus:quarkus-rest-jackson")
    implementation("io.quarkus:quarkus-scheduler")
    implementation("io.quarkus:quarkus-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("com.fazecast:jSerialComm:2.10.4")

    testImplementation("io.quarkus:quarkus-junit5")
}

allOpen {
    annotation("jakarta.enterprise.context.ApplicationScoped")
    annotation("jakarta.enterprise.context.RequestScoped")
    annotation("io.quarkus.websockets.next.WebSocket")
    annotation("io.quarkus.test.junit.QuarkusTest")
}

kotlin {
    jvmToolchain(21)
}

tasks.withType<Test>().configureEach {
    systemProperty("java.util.logging.manager", "org.jboss.logmanager.LogManager")
}
