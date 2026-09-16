/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const dataPaths = require('../../../data/dataPaths.json')
const readData = name => JSON.parse(fs.readFileSync(require.resolve(`../../../data/bedrock/1.26.50/${name}.json`)))
const blocks = readData('blocks')
const blockStates = readData('blockStates')
const items = readData('items')
const collisionShapes = readData('blockCollisionShapes')
const previousBlocks = JSON.parse(fs.readFileSync(require.resolve('../../../data/bedrock/1.26.30/blocks.json')))

describe('Bedrock 1.26.50 block-derived data', () => {
  it('uses the 1.26.50 global palette with connectivity and stair corner states', () => {
    assert.equal(dataPaths.bedrock['1.26.50'].blocks, 'bedrock/1.26.50')
    assert.equal(dataPaths.bedrock['1.26.50'].blockStates, 'bedrock/1.26.50')
    assert.equal(dataPaths.bedrock['1.26.50'].blockCollisionShapes, 'bedrock/1.26.50')
    assert.equal(dataPaths.bedrock['1.26.50'].items, 'bedrock/1.26.50')

    const oakFenceStates = blockStates.filter(block => block.name === 'oak_fence')
    const oakStairStates = blockStates.filter(block => block.name === 'oak_stairs')
    const tripWireStates = blockStates.filter(block => block.name === 'trip_wire')
    assert.equal(oakFenceStates.length, 16)
    assert.equal(oakStairStates.length, 40)
    assert.equal(tripWireStates.length, 256)
    assert.deepEqual(Object.keys(oakFenceStates[0].states), [
      'minecraft:connection_east',
      'minecraft:connection_north',
      'minecraft:connection_south',
      'minecraft:connection_west'
    ])
    assert.equal(oakStairStates[0].states['minecraft:corner'].value, 'none')

    const oakFence = blocks.find(block => block.name === 'oak_fence')
    assert.equal(oakFence.minStateId, blockStates.indexOf(oakFenceStates[0]))
    assert.equal(oakFence.maxStateId - oakFence.minStateId + 1, oakFenceStates.length)
    assert(blocks.some(block => block.name === 'poplar_stairs'), 'new 1.26.50 blocks must be indexed')
  })

  it('provides internally consistent block, item, and collision data', () => {
    const itemByName = new Map(items.map(item => [item.name, item]))
    const blockByName = new Map(blocks.map(block => [block.name, block]))
    const previousNames = new Set(previousBlocks.map(block => block.name))
    const addedBlocks = blocks.filter(block => !previousNames.has(block.name))
    for (const block of blocks) {
      const stateShapes = collisionShapes.blocks[block.name]
      assert(stateShapes, `${block.name} has no collision mapping`)
      assert.equal(stateShapes.length, block.maxStateId - block.minStateId + 1, `${block.name} collision cardinality`)
      for (const shape of stateShapes) assert(collisionShapes.shapes[shape], `${block.name} references missing shape ${shape}`)
    }
    assert.equal(addedBlocks.length, 121)
    for (const block of addedBlocks) {
      assert(itemByName.has(block.name), `${block.name} item is missing`)
      assert(block.drops.length > 0, `${block.name} has no drop metadata`)
    }
    assert.deepEqual(addedBlocks.filter(block => block.material === 'default').map(block => block.name).sort(), [
      'poplar_sapling', 'red_shrub', 'shelf_mushroom', 'straw_bed'
    ])
    for (const name of ['poplar_log', 'poplar_stairs', 'white_wool_stairs', 'white_concrete_slab', 'red_shrub', 'shelf_mushroom']) {
      const block = blockByName.get(name)
      assert(block, `${name} block is missing`)
      assert(itemByName.has(name), `${name} item is missing`)
      assert(block.drops.length > 0, `${name} has no drop metadata`)
      assert.equal(collisionShapes.blocks[name].length, block.maxStateId - block.minStateId + 1)
    }

    assert.equal(blockByName.get('poplar_log').material, 'mineable/axe')
    assert.equal(blockByName.get('poplar_log').drops[0], itemByName.get('poplar_log').id)
    assert.equal(blockByName.get('white_wool_stairs').material, 'mineable/shears')
    assert.equal(blockByName.get('white_concrete_slab').material, 'mineable/pickaxe')
    assert.equal(blockByName.get('red_shrub').boundingBox, 'empty')
    assert.equal(new Set(collisionShapes.blocks.oak_stairs).size, 24)
    assert.equal(collisionShapes.blocks.oak_stairs.length, 40)
    assert.equal(new Set(collisionShapes.blocks.oak_fence).size, 16)
    assert.equal(collisionShapes.blocks.oak_fence.length, 16)
    assert.equal(new Set(collisionShapes.blocks.white_wool_stairs).size, 24)
    assert.equal(collisionShapes.blocks.white_wool_stairs.length, 40)
  })
})
