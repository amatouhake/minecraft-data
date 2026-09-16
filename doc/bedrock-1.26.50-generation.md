# Bedrock 1.26.50 data provenance

The block palette and runtime item registry come from CloudburstMC/Data commit
`7046791ae9fcf056a3b26cd6605ffc1db6d97357`. The custom block definitions and
loot tables come from Mojang `bedrock-samples` tag `v1.26.50.27-preview`.
Collision shapes for the new connection and stair states come from
GeyserMC/mappings-generator commit
`bfafbeb990d8c53f6a0c1accea6d5f622f134277`, whose mappings submodule is
`0fd435d3d4617dd458c6ee0e6889a5245483bf5f` (Java 26.2 / Bedrock 1.26.50).

`tools/js/generateBedrockData.js` imports these sources. Geyser normally omits
the Bedrock identifier when it matches the Java identifier. The importer needs
the identifier on every registry entry so its ordered `blocks.nbt` can be
joined with the ordered `collisions.nbt`. Apply the non-semantic export patch
before running Geyser's generator:

```sh
git -C mappings-generator checkout bfafbeb990d8c53f6a0c1accea6d5f622f134277
git -C mappings-generator submodule update --init --recursive
git -C mappings-generator apply /path/to/minecraft-data/tools/js/geyser-explicit-bedrock-identifiers.patch
JAVA_HOME=/path/to/jdk-25 ./gradlew -p mappings-generator runMappings --no-daemon

node tools/js/generateBedrockData.js \
  --version 1.26.50 \
  --previous-version 1.26.30 \
  --bedrock-data /path/to/cloudburst-data \
  --bedrock-samples /path/to/extracted-bedrock-samples \
  --geyser-mappings /path/to/mappings-generator/mappings/mappings \
  --geyser-blocks /path/to/mappings-generator/mappings/mappings/blocks.nbt
```

The importer preserves existing block metadata, imports exact runtime item IDs,
uses Mojang block components and loot tables for data-driven blocks, and uses
the version-matched Geyser collision registry for state-dependent shapes.
