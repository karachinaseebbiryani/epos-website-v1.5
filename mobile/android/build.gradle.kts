allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// Force a consistent JVM target (17) across every plugin module. Some plugins
// (e.g. flutter_facebook_auth) compile Java at 11 but Kotlin at 17, which AGP 9
// rejects as "Inconsistent JVM Target Compatibility". Pinning both to 17 — the
// same target the app module uses — keeps the release build consistent. Done in
// afterEvaluate so it overrides each plugin's own compileOptions. Registered
// BEFORE evaluationDependsOn(":app") below so the callback exists before any
// project is force-evaluated (otherwise "afterEvaluate on already-evaluated").
subprojects {
    afterEvaluate {
        extensions.findByName("android")?.let { ext ->
            if (ext is com.android.build.gradle.BaseExtension) {
                ext.compileOptions {
                    sourceCompatibility = JavaVersion.VERSION_17
                    targetCompatibility = JavaVersion.VERSION_17
                }
            }
        }
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions {
                jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
