plugins {
    id("com.android.application")
}

android {
    namespace = "app.tinta"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.tinta"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

// The web app is the app: copy the built site into the APK so it works offline.
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.file("../web/dist"))
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
