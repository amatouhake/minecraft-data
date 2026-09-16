const fs = require('fs')
const path = require('path')
const nbt = require('prismarine-nbt')

function argument (name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing --${name}`)
  return path.resolve(process.argv[index + 1])
}

const stripNamespace = name => name.replace(/^minecraft:/, '')
const titleCase = value => value.replace(/_/g, ' ').replace(/\b\S/g, letter => letter.toUpperCase())
const stateValues = state => Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.value]))
const stateKey = (name, state) => `${name}\0${JSON.stringify(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)))}`
const clone = value => JSON.parse(JSON.stringify(value))

function templateName (name, available) {
  const candidates = []
  if (name.includes('poplar')) candidates.push(name.replace(/poplar/g, 'oak'))
  if (name.endsWith('_poplar_leaves')) candidates.push('oak_leaves')
  if (name === 'poplar_standing_sign') candidates.push('standing_sign')
  if (name === 'poplar_wall_sign') candidates.push('wall_sign')
  if (name === 'poplar_door') candidates.push('wooden_door')
  if (name === 'poplar_fence_gate') candidates.push('fence_gate')
  if (name === 'poplar_trapdoor') candidates.push('trapdoor')
  if (name === 'poplar_pressure_plate') candidates.push('wooden_pressure_plate')
  if (name === 'poplar_button') candidates.push('wooden_button')
  if (/_wool_(?:double_slab|slab|stairs)$/.test(name)) {
    candidates.push(name.replace(/^[a-z_]+_wool_/, 'oak_'))
  }
  if (/_concrete_(?:double_slab|slab|stairs)$/.test(name)) {
    candidates.push(name.replace(/^[a-z_]+_concrete_/, 'stone_'))
    candidates.push(name.replace(/^[a-z_]+_concrete_/, 'oak_'))
  }
  if (name === 'red_shrub') candidates.push('deadbush')
  if (name === 'shelf_mushroom') candidates.push('brown_mushroom')
  if (name === 'straw_bed') candidates.push('bed')
  if (name.endsWith('_stained_glass_pane') || name.endsWith('glass_pane')) candidates.push('glass_pane')
  if (name.endsWith('_fence')) candidates.push('oak_fence')
  return candidates.find(candidate => available.has(candidate))
}

function itemTemplateName (name, available) {
  const candidates = []
  if (name.includes('poplar')) candidates.push(name.replace(/poplar/g, 'oak'))
  if (/_wool_(?:double_slab|slab|stairs)$/.test(name)) candidates.push(name.replace(/^[a-z_]+_wool_/, 'oak_'))
  if (/_concrete_(?:double_slab|slab|stairs)$/.test(name)) candidates.push(name.replace(/^[a-z_]+_concrete_/, 'stone_'))
  if (name === 'red_shrub') candidates.push('deadbush')
  if (name === 'shelf_mushroom') candidates.push('brown_mushroom')
  if (name === 'straw_bed') candidates.push('bed')
  return candidates.find(candidate => available.has(candidate))
}

function readBehaviourBlocks (samplesDir) {
  const directory = path.join(samplesDir, 'behavior_pack', 'blocks')
  const result = new Map()
  if (!fs.existsSync(directory)) return result
  for (const file of fs.readdirSync(directory)) {
    if (!file.endsWith('.json')) continue
    const data = JSON.parse(fs.readFileSync(path.join(directory, file)))
    const block = data['minecraft:block']
    if (block?.description?.identifier) result.set(stripNamespace(block.description.identifier), block)
  }
  return result
}

function collectLootItems (value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectLootItems(entry, output)
  } else if (value && typeof value === 'object') {
    if (typeof value.name === 'string' && value.type === 'item') output.add(stripNamespace(value.name))
    for (const entry of Object.values(value)) collectLootItems(entry, output)
  }
  return output
}

function behaviourLoot (samplesDir, block) {
  const relative = block?.components?.['minecraft:loot']
  if (!relative) return []
  const file = path.join(samplesDir, 'behavior_pack', relative)
  if (!fs.existsSync(file)) return []
  return [...collectLootItems(JSON.parse(fs.readFileSync(file)))]
}

function convertGeyserShape (shape) {
  return shape.map(([x, y, z, width, height, depth]) => [
    x - width / 2,
    y - height / 2,
    z - depth / 2,
    x + width / 2,
    y + height / 2,
    z + depth / 2
  ].map(value => Object.is(value, -0) ? 0 : value))
}

function behaviourBox (box, rotation = 0) {
  if (box === false) return []
  if (!box?.origin || !box?.size) return undefined
  const [ox, oy, oz] = box.origin
  const [sx, sy, sz] = box.size
  const min = [(ox + 8) / 16, oy / 16, (oz + 8) / 16]
  const max = [min[0] + sx / 16, min[1] + sy / 16, min[2] + sz / 16]
  const turns = ((rotation / 90) % 4 + 4) % 4
  const points = [[min[0], min[2]], [min[0], max[2]], [max[0], min[2]], [max[0], max[2]]].map(([x, z]) => {
    for (let turn = 0; turn < turns; turn++) [x, z] = [1 - z, x]
    return [x, z]
  })
  return [[
    Math.min(...points.map(point => point[0])), min[1], Math.min(...points.map(point => point[1])),
    Math.max(...points.map(point => point[0])), max[1], Math.max(...points.map(point => point[1]))
  ]]
}

async function readGzipNbt (file) {
  return nbt.simplify((await nbt.parse(fs.readFileSync(file))).parsed)
}

async function main () {
  const version = argument('version')
  const bedrockData = argument('bedrock-data')
  const bedrockSamples = argument('bedrock-samples')
  const geyserMappings = argument('geyser-mappings')
  const geyserBlocksFile = argument('geyser-blocks')
  const previousVersion = argument('previous-version')
  const repository = path.resolve(__dirname, '..', '..')
  const outputDir = path.join(repository, 'data', 'bedrock', path.basename(version))
  const previousDir = path.join(repository, 'data', 'bedrock', path.basename(previousVersion))

  const paletteNbt = await nbt.parse(fs.readFileSync(path.join(bedrockData, 'block_palette.nbt')))
  const rawPalette = paletteNbt.parsed.value.blocks.value.value
  const blockStates = rawPalette.map(block => ({
    name: stripNamespace(block.name.value),
    states: block.states.value,
    version: block.version.value
  }))
  const paletteIndex = new Map(blockStates.map((block, index) => [stateKey(block.name, stateValues(block.states)), index]))

  const runtimeItems = JSON.parse(fs.readFileSync(path.join(bedrockData, 'runtime_item_states.json')))
  const previousItems = JSON.parse(fs.readFileSync(path.join(previousDir, 'items.json')))
  const previousItemByName = new Map(previousItems.map(item => [item.name, item]))
  const items = runtimeItems.map(runtime => {
    const name = stripNamespace(runtime.name)
    const previous = previousItemByName.get(name)
    const template = previousItemByName.get(itemTemplateName(name, previousItemByName) || '')
    const item = clone(previous || template || {})
    item.id = runtime.id
    item.stackSize ??= /(?:boat|minecart|shulker_box|bucket)$/.test(name) ? 1 : /(?:sign|banner)$/.test(name) ? 16 : 64
    item.name = name
    item.displayName = titleCase(name)
    item.nbt ??= { type: 'compound', name: '', value: {} }
    item.version ??= 'none'
    delete item.blockStateId
    delete item.variations
    return item
  }).sort((a, b) => a.id - b.id)
  const itemIdByName = new Map(items.map(item => [item.name, item.id]))

  const attributes = JSON.parse(fs.readFileSync(path.join(bedrockData, 'blocks.json')))
  const attributesByHash = new Map(attributes.map(block => [block.blockStateHash >>> 0, block]))
  const attributesByName = new Map()
  for (const block of attributes) {
    const name = stripNamespace(block.name)
    if (!attributesByName.has(name)) attributesByName.set(name, block)
  }
  const behaviourBlocks = readBehaviourBlocks(bedrockSamples)
  const previousBlocks = JSON.parse(fs.readFileSync(path.join(previousDir, 'blocks.json')))
  const previousBlockByName = new Map(previousBlocks.map(block => [block.name, block]))
  const rangeByName = new Map()
  rawPalette.forEach((block, stateId) => {
    const name = stripNamespace(block.name.value)
    const range = rangeByName.get(name)
    if (range) range.maxStateId = stateId
    else rangeByName.set(name, { minStateId: stateId, maxStateId: stateId, networkId: block.network_id.value >>> 0 })
  })

  let nextBlockId = Math.max(...previousBlocks.map(block => block.id)) + 1
  const blocks = []
  for (const [name, range] of rangeByName) {
    const previous = previousBlockByName.get(name)
    const templateNameValue = templateName(name, previousBlockByName)
    const template = previousBlockByName.get(templateNameValue)
    const block = clone(previous || template || {})
    const source = attributesByHash.get(range.networkId) || attributesByName.get(name)
    const behaviour = behaviourBlocks.get(name)
    const components = behaviour?.components || {}
    const internal = behaviour?.description?.internal_vanilla_data || {}

    block.id = previous?.id ?? nextBlockId++
    block.name = name
    block.displayName = titleCase(name)
    block.stackSize ??= 64
    if (source) {
      block.hardness = source.hardness
      block.resistance = source.explosionResistance
      block.diggable = source.hardness >= 0
      block.transparent = !source.isSolid || source.translucency > 0
      block.emitLight = source.lightEmission
      block.filterLight = source.lightDampening
    } else if (behaviour) {
      const mining = components['minecraft:destructible_by_mining']
      const explosion = components['minecraft:destructible_by_explosion']
      if (typeof mining?.seconds_to_destroy === 'number') block.hardness = mining.seconds_to_destroy
      if (typeof explosion?.explosion_resistance === 'number') block.resistance = explosion.explosion_resistance
      block.diggable = mining !== false
      if (typeof internal.translucency === 'number') block.transparent = internal.translucency > 0
      if (components['minecraft:collision_box'] === false) block.boundingBox = 'empty'
    }
    block.hardness ??= 0
    block.resistance ??= 0
    block.diggable ??= false
    block.material ??= 'default'
    if ((components['minecraft:tags'] || []).includes('minecraft:is_shears_item_destructible')) block.material = 'mineable/shears'
    if ((components['minecraft:tags'] || []).includes('minecraft:is_pickaxe_item_destructible')) block.material = 'mineable/pickaxe'
    block.transparent ??= false
    block.emitLight ??= 0
    block.filterLight ??= 0
    block.defaultState = range.minStateId
    block.minStateId = range.minStateId
    block.maxStateId = range.maxStateId

    let drops = previous ? block.drops || [] : []
    const lootNames = behaviourLoot(bedrockSamples, behaviour)
    if (lootNames.length) drops = lootNames.map(itemName => itemIdByName.get(itemName)).filter(id => id !== undefined)
    if (!previous && !drops.length) {
      const dropName = name.endsWith('_double_slab') ? name.replace('_double_slab', '_slab') : name
      const ownDrop = itemIdByName.get(dropName)
      if (ownDrop !== undefined) drops = [ownDrop]
    }
    block.drops = [...new Set(drops)]
    block.boundingBox ??= 'block'
    blocks.push(block)
  }
  blocks.sort((a, b) => a.id - b.id)

  const geyserCollision = await readGzipNbt(path.join(geyserMappings, 'collisions.nbt'))
  const geyserBlocks = await readGzipNbt(geyserBlocksFile)
  const blockMappings = geyserBlocks.bedrock_mappings
  if (blockMappings.length !== geyserCollision.indices.length) throw new Error('Geyser block mappings and collision indices are not aligned')
  if (blockMappings.some(mapping => !mapping.bedrock_identifier)) {
    throw new Error('The Geyser block mapping must retain bedrock_identifier for every registry entry; see doc/bedrock-1.26.50-generation.md')
  }

  const shapes = []
  const shapeIdByValue = new Map()
  const internShape = value => {
    const key = JSON.stringify(value)
    if (!shapeIdByValue.has(key)) {
      shapeIdByValue.set(key, shapes.length)
      shapes.push(value)
    }
    return shapeIdByValue.get(key)
  }
  const geyserShapeIds = geyserCollision.shapes.map(shape => internShape(convertGeyserShape(shape)))
  const collisionByState = new Map()
  blockMappings.forEach((mapping, index) => {
    const name = stripNamespace(mapping.bedrock_identifier)
    const key = stateKey(name, mapping.state || {})
    if (!paletteIndex.has(key)) return
    const shapeId = geyserShapeIds[geyserCollision.indices[index]]
    if (!collisionByState.has(key)) collisionByState.set(key, shapeId)
  })

  rawPalette.forEach((raw, index) => {
    const key = stateKey(blockStates[index].name, stateValues(blockStates[index].states))
    const source = attributesByHash.get(raw.network_id.value >>> 0)
    if (source) collisionByState.set(key, internShape(source.collisionShape || []))
  })

  const statesByName = new Map()
  blockStates.forEach((state, index) => {
    if (!statesByName.has(state.name)) statesByName.set(state.name, [])
    statesByName.get(state.name).push({ state, index })
  })
  for (const [name, entries] of statesByName) {
    const behaviour = behaviourBlocks.get(name)
    const baseBox = behaviour?.components?.['minecraft:collision_box']
    if (baseBox === undefined) continue
    for (const { state } of entries) {
      const values = stateValues(state.states)
      let box = baseBox
      if (name === 'shelf_mushroom' && values.growth === 1) {
        box = { origin: [-7, 4, -2], size: [14, 7, 10] }
      }
      const rotation = { north: 0, south: 180, west: 90, east: 270 }[values['minecraft:cardinal_direction']] || 0
      const shape = behaviourBox(box, rotation)
      if (shape !== undefined) collisionByState.set(stateKey(name, values), internShape(shape))
    }
  }
  for (const [name, entries] of statesByName) {
    const template = templateName(name, statesByName)
    if (!template) continue
    const templateByState = new Map(statesByName.get(template).map(({ state }) => [stateKey('', stateValues(state.states)), collisionByState.get(stateKey(template, stateValues(state.states)))]))
    for (const { state } of entries) {
      const key = stateKey(name, stateValues(state.states))
      if (collisionByState.has(key)) continue
      const shape = templateByState.get(stateKey('', stateValues(state.states)))
      if (shape !== undefined) collisionByState.set(key, shape)
    }
  }
  for (const [name, entries] of statesByName) {
    const source = attributesByName.get(name)
    if (!source) continue
    const shape = internShape(source.collisionShape || [])
    for (const { state } of entries) {
      const key = stateKey(name, stateValues(state.states))
      if (!collisionByState.has(key)) collisionByState.set(key, shape)
    }
  }

  const collisionBlocks = {}
  for (const [name, entries] of statesByName) {
    collisionBlocks[name] = entries.map(({ state }) => {
      const key = stateKey(name, stateValues(state.states))
      const shape = collisionByState.get(key)
      if (shape === undefined) throw new Error(`Missing collision shape for ${key}`)
      return shape
    })
  }
  for (const block of blocks) {
    const stateShapes = collisionBlocks[block.name]
    block.boundingBox = stateShapes.every(shape => shapes[shape].length === 0) ? 'empty' : 'block'
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'blockStates.json'), JSON.stringify(blockStates, null, '\t') + '\n')
  fs.writeFileSync(path.join(outputDir, 'blocks.json'), JSON.stringify(blocks, null, 2) + '\n')
  fs.writeFileSync(path.join(outputDir, 'items.json'), JSON.stringify(items, null, 2) + '\n')
  fs.writeFileSync(path.join(outputDir, 'blockCollisionShapes.json'), JSON.stringify({ blocks: collisionBlocks, shapes: Object.fromEntries(shapes.map((shape, index) => [index, shape])) }, null, '\t') + '\n')
  console.log(JSON.stringify({ blockStates: blockStates.length, blocks: blocks.length, items: items.length, collisionShapes: shapes.length }))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
