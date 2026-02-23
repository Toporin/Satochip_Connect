#!/bin/bash
set -e

# Usage: ./update_version.sh <version>
# Example: ./update_version.sh 0.2.0

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.2.0"
    exit 1
fi

VERSION_NAME="$1"

if ! echo "$VERSION_NAME" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Error: version must be in X.Y.Z format (integers only), got: $VERSION_NAME"
    exit 1
fi

X=$(echo "$VERSION_NAME" | cut -d. -f1)
Y=$(echo "$VERSION_NAME" | cut -d. -f2)
Z=$(echo "$VERSION_NAME" | cut -d. -f3)

VERSION_CODE=$(( 10000 * X + 100 * Y + Z ))

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRADLE_FILE="$SCRIPT_DIR/android/app/build.gradle"
PBXPROJ_FILE="$SCRIPT_DIR/ios/RNWeb3Wallet.xcodeproj/project.pbxproj"

if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i '' "s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" "$GRADLE_FILE"
    sed -i '' "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VERSION_NAME;/g" "$PBXPROJ_FILE"
    sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $VERSION_CODE;/g" "$PBXPROJ_FILE"
else
    sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i "s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" "$GRADLE_FILE"
    sed -i "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VERSION_NAME;/g" "$PBXPROJ_FILE"
    sed -i "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $VERSION_CODE;/g" "$PBXPROJ_FILE"
fi

echo "Updated version to $VERSION_NAME (versionCode: $VERSION_CODE)"
