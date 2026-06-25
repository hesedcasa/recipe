/* eslint-disable no-template-curly-in-string */
import {expect} from 'chai'

import {interpolate, interpolateDeep, resolvePath, toArg} from '../../src/recipe/interpolate.js'

describe('recipe interpolate', () => {
  const context = {
    assignee: 'jdoe',
    meta: {'full name': 'Jane Doe'},
    tickets: {
      issues: [
        {fields: {status: {name: 'Open'}}, key: 'ENG-1'},
        {fields: {status: {name: 'Done'}}, key: 'ENG-2'},
      ],
    },
  }

  describe('resolvePath', () => {
    it('resolves simple keys', () => {
      expect(resolvePath(context, 'assignee')).to.equal('jdoe')
    })

    it('resolves nested keys and array indices', () => {
      expect(resolvePath(context, 'tickets.issues[0].key')).to.equal('ENG-1')
      expect(resolvePath(context, 'tickets.issues[1].fields.status.name')).to.equal('Done')
    })

    it('resolves length', () => {
      expect(resolvePath(context, 'tickets.issues.length')).to.equal(2)
    })

    it('projects across arrays with [*]', () => {
      expect(resolvePath(context, 'tickets.issues[*].key')).to.deep.equal(['ENG-1', 'ENG-2'])
    })

    it('resolves quoted keys', () => {
      expect(resolvePath(context, 'meta["full name"]')).to.equal('Jane Doe')
    })

    it('returns undefined for missing paths', () => {
      expect(resolvePath(context, 'tickets.nope.deep')).to.be.undefined
    })

    describe('edge cases', () => {
      it('returns undefined for [*] projection on a non-array', () => {
        expect(resolvePath({a: 42}, 'a[*]')).to.be.undefined
      })

      it('resolves single-quoted bracket keys', () => {
        const ctx = {meta: {'my key': 'value'}}
        expect(resolvePath(ctx, "meta['my key']")).to.equal('value')
      })

      it('returns undefined when traversing through null', () => {
        expect(resolvePath({a: null}, 'a.b')).to.be.undefined
      })

      it('returns undefined for out-of-bounds array index', () => {
        expect(resolvePath({arr: [1, 2]}, 'arr[5]')).to.be.undefined
      })

      it('resolves root-level array index', () => {
        expect(resolvePath({arr: ['x', 'y']}, 'arr[1]')).to.equal('y')
      })
    })
  })

  describe('interpolate', () => {
    it('returns the raw value for a single full expression', () => {
      expect(interpolate('${tickets.issues}', context)).to.deep.equal(context.tickets.issues)
      expect(interpolate('${tickets.issues.length}', context)).to.equal(2)
    })

    it('stringifies embedded expressions', () => {
      expect(interpolate('Assigned to ${assignee}', context)).to.equal('Assigned to jdoe')
    })

    it('renders empty string for missing values', () => {
      expect(interpolate('x=${missing}', context)).to.equal('x=')
    })

    describe('edge cases', () => {
      it('renders empty string when resolved value is null', () => {
        expect(interpolate('val=${v}', {v: null})).to.equal('val=')
      })

      it('handles multiple embedded expressions in one string', () => {
        expect(interpolate('${a}-${b}', {a: 'foo', b: 'bar'})).to.equal('foo-bar')
      })

      it('returns raw number for a sole numeric expression', () => {
        expect(interpolate('${n}', {n: 42})).to.equal(42)
      })

      it('returns raw boolean for a sole boolean expression', () => {
        expect(interpolate('${flag}', {flag: false})).to.equal(false)
      })

      it('returns raw array for a sole array expression', () => {
        expect(interpolate('${arr}', {arr: [1, 2, 3]})).to.deep.equal([1, 2, 3])
      })
    })
  })

  describe('interpolateDeep', () => {
    it('interpolates strings inside arrays and objects', () => {
      const result = interpolateDeep(['${assignee}', {key: '${tickets.issues[0].key}'}], context)
      expect(result).to.deep.equal(['jdoe', {key: 'ENG-1'}])
    })

    describe('edge cases', () => {
      it('passes through numbers and booleans unchanged', () => {
        expect(interpolateDeep(42, {})).to.equal(42)
        expect(interpolateDeep(false, {})).to.equal(false)
      })

      it('passes through null unchanged', () => {
        expect(interpolateDeep(null, {})).to.be.null
      })

      it('interpolates inside nested objects', () => {
        const result = interpolateDeep({outer: {inner: '${x}'}}, {x: 'hello'})
        expect(result).to.deep.equal({outer: {inner: 'hello'}})
      })

      it('interpolates mixed arrays with primitives', () => {
        const result = interpolateDeep(['${a}', 42, true, null], {a: 'z'})
        expect(result).to.deep.equal(['z', 42, true, null])
      })
    })
  })

  describe('toArg', () => {
    it('coerces non-string values to argument strings', () => {
      expect(toArg('${tickets.issues.length}', context)).to.equal('2')
      expect(toArg('${tickets.issues[0]}', context)).to.equal(JSON.stringify(context.tickets.issues[0]))
    })

    describe('edge cases', () => {
      it('returns empty string for null', () => {
        expect(toArg('${v}', {v: null})).to.equal('')
      })

      it('returns empty string for undefined path', () => {
        expect(toArg('${missing}', {})).to.equal('')
      })

      it('converts number to string', () => {
        expect(toArg('${n}', {n: 99})).to.equal('99')
      })

      it('converts boolean to string', () => {
        expect(toArg('${flag}', {flag: true})).to.equal('true')
      })
    })
  })
})
