/* eslint-env mocha */

const assert = require('assert')
const protocol = require('../../../data/bedrock/1.26.50/protocol.json')
const dataPaths = require('../../../data/dataPaths.json')
const blocks = require('../../../data/bedrock/1.26.50/blocks.json')
const blockStates = require('../../../data/bedrock/1.26.50/blockStates.json')

function fields (typeName) {
  const type = protocol.types[typeName]
  assert.equal(type[0], 'container', `${typeName} must be a container`)
  return type[1]
}

function field (typeName, fieldName) {
  const value = fields(typeName).find(entry => entry.name === fieldName)
  assert(value, `${typeName}.${fieldName} is missing`)
  return value
}

describe('Bedrock 1.26.50 schema changes', () => {
  it('encodes every gathering field as optional in wire order', () => {
    const gathering = fields('GatheringJoinInfo')
    assert.deepEqual(gathering.map(entry => entry.name), [
      'experience_id',
      'experience_name',
      'experience_world_id',
      'experience_world_name',
      'creator_id',
      'target_id',
      'scenario_id',
      'server_id'
    ])
    for (const entry of gathering) assert.equal(entry.type[0], 'option', `${entry.name} must be optional`)
  })

  it('includes the new environment, diagnostics, and debug text fields', () => {
    assert.equal(field('EnvironmentAttributeData', 'noise_alignment').type, 'NoiseAlignment')
    assert.equal(field('NoiseAlignment', 'type').type, 'NoiseAlignmentType')
    assert.equal(field('NoiseAlignment', 'value').type, 'varint')
    assert.equal(field('EntityDiagnosticTimingInfo', 'position').type, 'vec3f')
    assert.equal(field('EntityDiagnosticTimingInfo', 'dimension').type, 'string')
    assert.equal(field('ShapeText', 'line_gap_height').type[0], 'option')
  })

  it('includes the string-array pack setting variant', () => {
    const packet = protocol.types.packet_serverbound_pack_setting_change
    const packSetting = packet[1].find(entry => entry.name === 'pack_setting').type
    const type = packSetting[1].find(entry => entry.name === 'type').type
    const value = packSetting[1].find(entry => entry.name === 'value').type
    assert.equal(type[1].mappings['3'], 'string_array')
    assert.equal(value[1].fields.string_array[0], 'array')
    assert.equal(value[1].fields.string_array[1].type, 'string')
  })

  it('uses the 1.26.50 global palette with connectivity and stair corner states', () => {
    assert.equal(dataPaths.bedrock['1.26.50'].blocks, 'bedrock/1.26.50')
    assert.equal(dataPaths.bedrock['1.26.50'].blockStates, 'bedrock/1.26.50')

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
})
