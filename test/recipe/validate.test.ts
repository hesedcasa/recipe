/* eslint-disable no-template-curly-in-string, unicorn/no-thenable */
import {expect} from 'chai'

import {Recipe} from '../../src/recipe/types.js'
import {validateRecipe} from '../../src/recipe/validate.js'

describe('validateRecipe', () => {
  it('accepts a well-formed recipe', () => {
    const recipe: Recipe = {
      name: 'ok',
      steps: [
        {log: 'hi'},
        {as: 'i', repeat: 2, steps: [{log: '${i}'}]},
        {else: [{log: 'no'}], if: '${x} > 0', then: [{log: 'yes'}]},
      ],
    }
    expect(() => validateRecipe(recipe)).to.not.throw()
  })

  it('rejects a non-object', () => {
    expect(() => validateRecipe('nope')).to.throw('Recipe must be a JSON object.')
  })

  it('rejects a missing name', () => {
    expect(() => validateRecipe({steps: []})).to.throw('non-empty "name"')
  })

  it('rejects an empty name', () => {
    expect(() => validateRecipe({name: '   ', steps: []})).to.throw('non-empty "name"')
  })

  it('rejects missing steps', () => {
    expect(() => validateRecipe({name: 'x'})).to.throw('"steps" array')
  })

  it('rejects a step with no recognized key', () => {
    expect(() => validateRecipe({name: 'x', steps: [{foo: 'bar'}]})).to.throw('no recognized step key')
  })

  it('rejects a forEach step without steps', () => {
    expect(() => validateRecipe({name: 'x', steps: [{forEach: '${xs}'}]})).to.throw(
      'steps[0] must have a "steps" array.',
    )
  })

  it('validates nested steps recursively', () => {
    expect(() => validateRecipe({name: 'x', steps: [{as: 'i', repeat: 1, steps: [{nope: true}]}]})).to.throw(
      'steps[0].steps[0] has no recognized step key',
    )
  })

  it('rejects a then branch that is not an array', () => {
    expect(() => validateRecipe({name: 'x', steps: [{if: '${a}', then: {log: 'x'}}]})).to.throw(
      'steps[0].then must be an array.',
    )
  })
})
