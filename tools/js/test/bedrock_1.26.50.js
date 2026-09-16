/* eslint-env mocha */

const assert = require('assert')
const protocol = require('../../../data/bedrock/1.26.50/protocol.json')

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

  it('encodes the complete furnace options payload', () => {
    assert.deepEqual(protocol.types.FurnaceLeftTabIndex[1].mappings, {
      0: 'none', 1: 'recipe_food', 2: 'recipe_items', 3: 'recipe_blocks', 4: 'recipe_search', 5: 'inventory'
    })
    assert.deepEqual(protocol.types.FurnaceLayout[1].mappings, { 0: 'none', 1: 'inventory_only', 2: 'default' })
    assert.deepEqual(fields('FurnaceOptions').map(entry => entry.name), ['left_tab', 'filtering', 'layout'])
    const furnace = fields('packet_set_player_furnace_options')
    assert.deepEqual(furnace[0].type[1].mappings, { 0: 'none', 1: 'furnace', 2: 'blast_furnace', 3: 'smoker' })
    assert.equal(furnace[1].type, 'FurnaceOptions')
  })

  it('uses the complete 1.26.50 map and disconnect enums', () => {
    const mapType = field('MapDecoration', 'type').type[1].mappings
    assert.deepEqual(Object.fromEntries(Object.entries(mapType).slice(23)), {
      23: 'witch_hut',
      24: 'trial_chambers',
      25: 'abandoned_camp',
      26: 'buried_ancient_city',
      27: 'buried_mineshaft',
      28: 'desert_pyramid',
      29: 'warm_ocean_ruins',
      30: 'count'
    })
    const disconnect = protocol.types.DisconnectFailReason[1].mappings
    assert.equal(disconnect[148], 'missing_structure_data')
    assert.equal(disconnect[149], 'unsupported_transport')
  })
})
