// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ac-core",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "ac-core",
            path: "Sources/ACCore"
        ),
        .testTarget(
            name: "ACCoreTests",
            dependencies: ["ac-core"],
            path: "Tests/ACCoreTests"
        ),
        .testTarget(
            name: "ACCoreIntegrationTests",
            dependencies: ["ac-core"],
            path: "Tests/ACCoreIntegrationTests"
        ),
    ]
)
