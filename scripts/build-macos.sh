#!/bin/bash
set -e
cd "$(dirname "$0")/../native/macos"
swift build -c release
echo "Built ac-core at $(pwd)/.build/release/ac-core"
