/* eslint-disable no-template-curly-in-string */
import {expect} from 'chai'

import {evaluateCondition} from '../../src/recipe/condition.js'

describe('recipe condition', () => {
  const context = {
    blocked: false,
    count: 3,
    done: true,
    labels: ['urgent', 'backend'],
    status: 'Open',
  }

  it('evaluates equality and inequality', () => {
    expect(evaluateCondition('${status} == Open', context)).to.be.true
    expect(evaluateCondition('${status} != Done', context)).to.be.true
    expect(evaluateCondition('${status} == Done', context)).to.be.false
  })

  it('interpolates the right-hand operand so two variables can be compared', () => {
    const ctx = {a: 'Closed', b: 'Closed', c: 'Open', m: 3, n: 3}
    expect(evaluateCondition('${a} == ${b}', ctx)).to.be.true
    expect(evaluateCondition('${a} == ${c}', ctx)).to.be.false
    expect(evaluateCondition('${a} != ${c}', ctx)).to.be.true
    expect(evaluateCondition('${n} >= ${m}', ctx)).to.be.true
  })

  it('supports a quoted right-hand operand (preserving spaces)', () => {
    expect(evaluateCondition('${status} == "Open"', context)).to.be.true
    expect(evaluateCondition('${name} == "Won\'t Do"', {name: "Won't Do"})).to.be.true
    expect(evaluateCondition('${name} == "Done"', {name: "Won't Do"})).to.be.false
  })

  it('evaluates numeric comparisons', () => {
    expect(evaluateCondition('${count} > 0', context)).to.be.true
    expect(evaluateCondition('${count} >= 3', context)).to.be.true
    expect(evaluateCondition('${count} < 3', context)).to.be.false
    expect(evaluateCondition('${count} <= 2', context)).to.be.false
  })

  it('evaluates contains and matches', () => {
    expect(evaluateCondition('${labels} contains urgent', context)).to.be.true
    expect(evaluateCondition('${labels} contains missing', context)).to.be.false
    expect(evaluateCondition('${status} matches ^Op', context)).to.be.true
  })

  it('evaluates truthiness and negation', () => {
    expect(evaluateCondition('${done}', context)).to.be.true
    expect(evaluateCondition('!${blocked}', context)).to.be.true
    expect(evaluateCondition('!${done}', context)).to.be.false
  })

  it('evaluates && and ||', () => {
    expect(evaluateCondition('${done} && !${blocked}', context)).to.be.true
    expect(evaluateCondition('${done} && ${blocked}', context)).to.be.false
    expect(evaluateCondition('${blocked} || ${count} > 0', context)).to.be.true
  })

  it('treats false-valued booleans as falsy', () => {
    expect(evaluateCondition('${blocked}', context)).to.be.false
  })

  describe('additional cases', () => {
    it('contains on a string value (substring check)', () => {
      const ctx = {status: 'Open'}
      expect(evaluateCondition('${status} contains Ope', ctx)).to.be.true
      expect(evaluateCondition('${status} contains xyz', ctx)).to.be.false
    })

    it('truthiness with truthy non-boolean values', () => {
      expect(evaluateCondition('${n}', {n: 1})).to.be.true
      expect(evaluateCondition('${n}', {n: 0})).to.be.false
      expect(evaluateCondition('${s}', {s: 'hello'})).to.be.true
      expect(evaluateCondition('${s}', {s: ''})).to.be.false
    })

    it('bare word operand is always truthy', () => {
      expect(evaluateCondition('someword', {})).to.be.true
      expect(evaluateCondition('anything', {})).to.be.true
    })

    it('evaluates three-part || correctly', () => {
      expect(evaluateCondition('${a} || ${b} || ${c}', {a: false, b: false, c: true})).to.be.true
      expect(evaluateCondition('${a} || ${b} || ${c}', {a: false, b: false, c: false})).to.be.false
      expect(evaluateCondition('${a} || ${b} || ${c}', {a: true, b: false, c: false})).to.be.true
    })

    it('evaluates three-part && correctly', () => {
      expect(evaluateCondition('${a} && ${b} && ${c}', {a: true, b: true, c: true})).to.be.true
      expect(evaluateCondition('${a} && ${b} && ${c}', {a: true, b: true, c: false})).to.be.false
    })

    it('double negation restores original truthiness', () => {
      expect(evaluateCondition('!!${done}', {done: true})).to.be.true
      expect(evaluateCondition('!!${blocked}', {blocked: false})).to.be.false
    })

    it('matches operator uses regex', () => {
      expect(evaluateCondition('${key} matches ^ENG-\\d+$', {key: 'ENG-123'})).to.be.true
      expect(evaluateCondition('${key} matches ^ENG-', {key: 'BUG-456'})).to.be.false
    })

    it('negation of a comparison expression', () => {
      expect(evaluateCondition('!${status} == Done', {status: 'Done'})).to.be.false
      expect(evaluateCondition('!${status} == Done', {status: 'Open'})).to.be.true
    })

    it('mixed && and || evaluated left to right', () => {
      // "${a} && ${b} || ${c}" splits on || first → "${a} && ${b}" || "${c}"
      expect(evaluateCondition('${a} && ${b} || ${c}', {a: true, b: false, c: true})).to.be.true
      expect(evaluateCondition('${a} && ${b} || ${c}', {a: true, b: false, c: false})).to.be.false
    })

    it('resolves undefined path as falsy', () => {
      expect(evaluateCondition('${missing}', {})).to.be.false
    })

    it('numeric >= and <= boundary values', () => {
      const ctx = {n: 5}
      expect(evaluateCondition('${n} >= 5', ctx)).to.be.true
      expect(evaluateCondition('${n} <= 5', ctx)).to.be.true
      expect(evaluateCondition('${n} > 5', ctx)).to.be.false
      expect(evaluateCondition('${n} < 5', ctx)).to.be.false
    })
  })
})
