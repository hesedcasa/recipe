// Tests intentionally pass literal `${...}` placeholders to exercise the chain DSL, and
// assert on recipe IfStep objects whose `then` key is unrelated to Promise thenables.
/* eslint-disable no-template-curly-in-string, unicorn/no-thenable */
import {expect} from 'chai'

import {parseChain, splitArgs, stripFlags} from '../../src/recipe/chain.js'

describe('chain', () => {
  describe('parseChain', () => {
    it('parses a linear exec chain with capture', () => {
      const steps = parseChain(['exec: gh pr list --json number =>json prs', 'log: found ${prs.length}'])
      expect(steps).to.deep.equal([
        {capture: 'prs', exec: 'gh pr list --json number', json: true},
        {log: 'found ${prs.length}'},
      ])
    })

    it('captures stdout as a raw string with => (no json)', () => {
      const [step] = parseChain(['exec: date => today'])
      expect(step).to.deep.equal({capture: 'today', exec: 'date', json: false})
    })

    it('leaves exec without a capture clause untouched', () => {
      const [step] = parseChain(['exec: echo hi'])
      expect(step).to.deep.equal({exec: 'echo hi', json: false})
    })

    it('does not treat a shell redirect as a capture', () => {
      const [step] = parseChain(['exec: echo hi > /tmp/x'])
      expect(step).to.deep.equal({exec: 'echo hi > /tmp/x', json: false})
    })

    it('parses a run step into id + args', () => {
      const [step] = parseChain(['run: jira:transition ${ticket.key} Done'])
      expect(step).to.deep.equal({args: ['${ticket.key}', 'Done'], run: 'jira:transition'})
    })

    it('respects quotes when splitting run args', () => {
      expect(splitArgs('cmd "a b" c')).to.deep.equal(['cmd', 'a b', 'c'])
      expect(splitArgs("cmd 'a b'")).to.deep.equal(['cmd', 'a b'])
    })

    it('parses set with JSON-typed and string values', () => {
      expect(parseChain(['set: count = 3'])).to.deep.equal([{set: 'count', value: 3}])
      expect(parseChain(['set: name = jdoe'])).to.deep.equal([{set: 'name', value: 'jdoe'}])
      expect(parseChain(['set: tags = ["a","b"]'])).to.deep.equal([{set: 'tags', value: ['a', 'b']}])
    })

    it('binds a forEach body from the single following step', () => {
      const steps = parseChain(['forEach: ${prs} as pr', 'log: ${pr.number}'])
      expect(steps).to.deep.equal([{as: 'pr', forEach: '${prs}', steps: [{log: '${pr.number}'}]}])
    })

    it('binds a multi-step body from a { ... } block', () => {
      const steps = parseChain(['forEach: ${prs}', '{', 'log: a', 'log: b', '}', 'log: after'])
      expect(steps).to.deep.equal([{forEach: '${prs}', steps: [{log: 'a'}, {log: 'b'}]}, {log: 'after'}])
    })

    it('parses repeat with a numeric count and as binding', () => {
      const steps = parseChain(['repeat: 3 as i', 'log: ${i}'])
      expect(steps).to.deep.equal([{as: 'i', repeat: 3, steps: [{log: '${i}'}]}])
    })

    it('keeps a non-numeric repeat count as a string (interpolated at run time)', () => {
      const [step] = parseChain(['repeat: ${count}', 'log: x'])
      expect(step).to.include({repeat: '${count}'})
    })

    it('parses if / else with single-step bodies', () => {
      const steps = parseChain(['if: ${n} > 0', 'log: yes', 'else', 'log: no'])
      expect(steps).to.deep.equal([{else: [{log: 'no'}], if: '${n} > 0', then: [{log: 'yes'}]}])
    })

    it('parses nested control flow', () => {
      const steps = parseChain(['forEach: ${prs} as pr', '{', 'if: ${pr.draft}', 'log: draft', '}'])
      expect(steps).to.deep.equal([{as: 'pr', forEach: '${prs}', steps: [{if: '${pr.draft}', then: [{log: 'draft'}]}]}])
    })

    it('throws on an unknown step type', () => {
      expect(() => parseChain(['frobnicate: x'])).to.throw(/Unknown step/)
    })

    it('throws on an unclosed block', () => {
      expect(() => parseChain(['forEach: ${x}', '{', 'log: a'])).to.throw(/Unclosed/)
    })

    it('throws on a stray closing brace', () => {
      expect(() => parseChain(['log: a', '}'])).to.throw(/no matching/)
    })

    it('throws when a control step has no body', () => {
      expect(() => parseChain(['forEach: ${x}'])).to.throw(/needs a body/)
    })

    it('throws on an empty chain', () => {
      expect(() => parseChain([])).to.throw(/at least one step/)
    })
  })

  describe('stripFlags', () => {
    const valueFlags = new Set(['--save', '--var'])

    it('keeps step tokens (including { } else) in original order', () => {
      const argv = ['forEach: ${x}', '{', 'log: a', '}', '--dry-run']
      expect(stripFlags(argv, valueFlags)).to.deep.equal(['forEach: ${x}', '{', 'log: a', '}'])
    })

    it('drops value-taking flags and their separate value token', () => {
      const argv = ['log: hi', '--var', 'k=v', '--save', 'my-recipe']
      expect(stripFlags(argv, valueFlags)).to.deep.equal(['log: hi'])
    })

    it('drops --flag=value forms without consuming the next token', () => {
      const argv = ['--var=k=v', 'log: hi', '--save=name']
      expect(stripFlags(argv, valueFlags)).to.deep.equal(['log: hi'])
    })

    it('preserves nesting when oclif would have reordered braces', () => {
      // The exact raw argv for a doubly-nested chain plus trailing flags.
      const argv = ['forEach: ${outer} as o', '{', 'forEach: ${o.ts} as t', '{', 'log: x', '}', '}', '--var', 'k=v']
      expect(stripFlags(argv, valueFlags)).to.deep.equal([
        'forEach: ${outer} as o',
        '{',
        'forEach: ${o.ts} as t',
        '{',
        'log: x',
        '}',
        '}',
      ])
    })
  })
})
