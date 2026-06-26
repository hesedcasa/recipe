/* eslint-disable no-template-curly-in-string, unicorn/no-thenable */
import {expect} from 'chai'

import {executeRecipe, RecipeRunner} from '../../src/recipe/engine.js'
import {Recipe} from '../../src/recipe/types.js'

/** Records every command invocation so tests can assert on them. */
function fakeRunner(commandResults: Record<string, unknown> = {}): {
  logs: string[]
  ran: Array<{argv: string[]; id: string}>
  runner: RecipeRunner
} {
  const logs: string[] = []
  const ran: Array<{argv: string[]; id: string}> = []
  const runner: RecipeRunner = {
    async exec(command) {
      ran.push({argv: [], id: command})
      return {stderr: '', stdout: commandResults[command] ? String(commandResults[command]) : ''}
    },
    log(message) {
      logs.push(message)
    },
    async runCommand(id, argv) {
      ran.push({argv, id})
      return commandResults[id]
    },
  }
  return {logs, ran, runner}
}

describe('recipe engine', () => {
  it('captures command output and loops with a condition (Jira-style)', async () => {
    const recipe: Recipe = {
      name: 'close-user-tickets',
      steps: [
        {args: ['assignee = ${assignee}'], capture: 'tickets', run: 'jira:search'},
        {
          as: 'ticket',
          forEach: '${tickets.issues}',
          steps: [
            {
              args: ['${ticket.key}', 'Done'],
              if: '${ticket.fields.status.name} != Done',
              run: 'jira:transition',
            },
          ],
        },
      ],
      vars: {assignee: 'jdoe'},
    }

    const {ran, runner} = fakeRunner({
      'jira:search': {
        issues: [
          {fields: {status: {name: 'Open'}}, key: 'ENG-1'},
          {fields: {status: {name: 'Done'}}, key: 'ENG-2'},
          {fields: {status: {name: 'In Progress'}}, key: 'ENG-3'},
        ],
      },
    })

    await executeRecipe(recipe, runner)

    expect(ran[0]).to.deep.equal({argv: ['assignee = jdoe'], id: 'jira:search'})
    // ENG-2 is already Done and must be skipped by the `if` guard.
    const transitions = ran.filter((r) => r.id === 'jira:transition')
    expect(transitions.map((t) => t.argv[0])).to.deep.equal(['ENG-1', 'ENG-3'])
  })

  it('honors override variables', async () => {
    const recipe: Recipe = {
      name: 'greet',
      steps: [{args: ['${name}'], run: 'say'}],
      vars: {name: 'world'},
    }
    const {ran, runner} = fakeRunner()
    await executeRecipe(recipe, runner, {name: 'alice'})
    expect(ran[0].argv).to.deep.equal(['alice'])
  })

  it('runs if/then/else branches', async () => {
    const recipe: Recipe = {
      name: 'branch',
      steps: [
        {set: 'count', value: 0},
        {
          else: [{log: 'empty'}],
          if: '${count} > 0',
          then: [{log: 'has items'}],
        },
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['empty'])
  })

  it('does nothing in dry-run mode but still logs the plan', async () => {
    const recipe: Recipe = {name: 'dry', steps: [{args: ['prod'], run: 'deploy'}]}
    const {logs, ran, runner} = fakeRunner()
    runner.dryRun = true
    await executeRecipe(recipe, runner)
    expect(ran).to.be.empty
    expect(logs[0]).to.equal('[dry-run] deploy prod')
  })

  it('performs JSON operations with set and repeat', async () => {
    const recipe: Recipe = {
      name: 'json-ops',
      steps: [
        {set: 'items', value: ['${a}', '${b}']},
        {as: 'i', repeat: 2, steps: [{log: 'i=${i}'}]},
      ],
      vars: {a: 'x', b: 'y'},
    }
    const {logs, runner} = fakeRunner()
    const result = await executeRecipe(recipe, runner)
    expect(result.vars.items).to.deep.equal(['x', 'y'])
    expect(logs).to.deep.equal(['i=0', 'i=1'])
  })

  it('parses captured shell JSON output', async () => {
    const recipe: Recipe = {
      name: 'shell',
      steps: [{capture: 'data', exec: 'gh api', json: true, silent: true}],
    }
    const {runner} = fakeRunner({'gh api': '{"count": 5}'})
    const result = await executeRecipe(recipe, runner)
    expect(result.vars.data).to.deep.equal({count: 5})
  })

  it('captures raw stdout, stripping trailing newlines, when json flag is not set', async () => {
    const recipe: Recipe = {
      name: 'raw-exec',
      steps: [{capture: 'out', exec: 'echo hello'}],
    }
    const {runner} = fakeRunner({'echo hello': 'hello\n'})
    const result = await executeRecipe(recipe, runner)
    // Trailing newlines are stripped so the value chains into later commands cleanly.
    expect(result.vars.out).to.equal('hello')
  })

  it('logs uncaptured exec stdout so a chain behaves like a terminal', async () => {
    const recipe: Recipe = {
      name: 'visible',
      steps: [{exec: 'some-cmd'}],
    }
    const {logs, ran, runner} = fakeRunner({'some-cmd': 'hello\n'})
    const result = await executeRecipe(recipe, runner)
    expect(ran[0].id).to.equal('some-cmd')
    expect(logs).to.deep.equal(['hello']) // trailing newline stripped
    expect(result.vars).not.to.have.property('out')
  })

  it('suppresses uncaptured exec stdout when silent is set', async () => {
    const recipe: Recipe = {
      name: 'quiet',
      steps: [{exec: 'some-cmd', silent: true}],
    }
    const {logs, runner} = fakeRunner({'some-cmd': 'noisy'})
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal([])
  })

  it('exec step in dry-run mode logs the command and does not execute', async () => {
    const recipe: Recipe = {
      name: 'exec-dry',
      steps: [{exec: 'rm -rf /important'}],
    }
    const {logs, ran, runner} = fakeRunner()
    runner.dryRun = true
    await executeRecipe(recipe, runner)
    expect(ran).to.be.empty
    expect(logs[0]).to.equal('[dry-run] rm -rf /important')
  })

  it('run step without args calls command with empty argv', async () => {
    const recipe: Recipe = {
      name: 'no-args',
      steps: [{run: 'plugins'}],
    }
    const {ran, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(ran[0]).to.deep.equal({argv: [], id: 'plugins'})
  })

  it('run step without capture ignores return value', async () => {
    const recipe: Recipe = {
      name: 'no-capture',
      steps: [{args: ['x'], run: 'cmd'}],
    }
    const {runner} = fakeRunner({cmd: {key: 'value'}})
    const result = await executeRecipe(recipe, runner)
    expect(result.vars).not.to.have.property('cmd')
  })

  it('dry-run for run step with no args omits trailing space', async () => {
    const recipe: Recipe = {name: 'no-args-dry', steps: [{run: 'status'}]}
    const {logs, runner} = fakeRunner()
    runner.dryRun = true
    await executeRecipe(recipe, runner)
    expect(logs[0]).to.equal('[dry-run] status')
  })

  it('forEach with empty array never executes steps', async () => {
    const recipe: Recipe = {
      name: 'empty-foreach',
      steps: [
        {set: 'items', value: []},
        {as: 'item', forEach: '${items}', steps: [{log: 'saw ${item}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.be.empty
  })

  it('forEach with non-array value skips body silently', async () => {
    const recipe: Recipe = {
      name: 'non-array-foreach',
      steps: [
        {set: 'val', value: 'not-an-array'},
        {as: 'item', forEach: '${val}', steps: [{log: 'saw ${item}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    const result = await executeRecipe(recipe, runner)
    expect(logs).to.be.empty
    expect(result.steps).to.equal(2)
  })

  it('repeat with string interpolated count', async () => {
    const recipe: Recipe = {
      name: 'dynamic-repeat',
      steps: [
        {set: 'n', value: 3},
        {as: 'i', repeat: '${n}', steps: [{log: 'pass ${i}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['pass 0', 'pass 1', 'pass 2'])
  })

  it('repeat without as still runs the body', async () => {
    const recipe: Recipe = {
      name: 'no-as-repeat',
      steps: [{repeat: 2, steps: [{log: 'tick'}]}],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['tick', 'tick'])
  })

  it('repeat without as binds the index to the default "i"', async () => {
    const recipe: Recipe = {
      name: 'default-i',
      steps: [{repeat: 3, steps: [{log: 'i=${i}'}]}],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['i=0', 'i=1', 'i=2'])
  })

  it('forEach without as binds the element to the default "item"', async () => {
    const recipe: Recipe = {
      name: 'default-item',
      steps: [
        {set: 'fruits', value: ['apple', 'pear']},
        {forEach: '${fruits}', steps: [{log: 'item=${item}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['item=apple', 'item=pear'])
  })

  it('forEach binds the iteration index to <as>_index', async () => {
    const recipe: Recipe = {
      name: 'foreach-index',
      steps: [
        {set: 'fruits', value: ['apple', 'pear', 'kiwi']},
        {as: 'fruit', forEach: '${fruits}', steps: [{log: '${fruit_index}:${fruit}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['0:apple', '1:pear', '2:kiwi'])
  })

  it('forEach with default as exposes item_index', async () => {
    const recipe: Recipe = {
      name: 'default-item-index',
      steps: [
        {set: 'xs', value: ['a', 'b']},
        {forEach: '${xs}', steps: [{log: '${item_index}=${item}'}]},
      ],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['0=a', '1=b'])
  })

  it('repeat with count 0 executes no iterations', async () => {
    const recipe: Recipe = {
      name: 'zero-repeat',
      steps: [{as: 'i', repeat: 0, steps: [{log: 'should not appear'}]}],
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.be.empty
  })

  it('if guard on log step skips when condition is false', async () => {
    const recipe: Recipe = {
      name: 'guarded-log',
      steps: [
        {if: '${flag}', log: 'should not appear'},
        {if: '!${flag}', log: 'visible'},
      ],
      vars: {flag: false},
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['visible'])
  })

  it('if guard on set step prevents assignment when condition is false', async () => {
    const recipe: Recipe = {
      name: 'guarded-set',
      steps: [{if: '${flag}', set: 'x', value: 99}],
      vars: {flag: false},
    }
    const {runner} = fakeRunner()
    const result = await executeRecipe(recipe, runner)
    expect(result.vars).not.to.have.property('x')
  })

  it('if guard on exec step prevents execution when condition is false', async () => {
    const recipe: Recipe = {
      name: 'guarded-exec',
      steps: [{exec: 'dangerous-cmd', if: '${flag}'}],
      vars: {flag: false},
    }
    const {ran, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(ran).to.be.empty
  })

  it('if/then without else: false condition takes no action', async () => {
    const recipe: Recipe = {
      name: 'if-then-only',
      steps: [{if: '${flag}', then: [{log: 'yes'}]}],
      vars: {flag: false},
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.be.empty
  })

  it('if/else without then: true condition takes no action on true branch', async () => {
    const recipe: Recipe = {
      name: 'if-else-only',
      steps: [{else: [{log: 'no'}], if: '${flag}'}],
      vars: {flag: true},
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.be.empty
  })

  it('if/else without then: false condition runs else branch', async () => {
    const recipe: Recipe = {
      name: 'if-else-false',
      steps: [{else: [{log: 'fallback'}], if: '${flag}'}],
      vars: {flag: false},
    }
    const {logs, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(logs).to.deep.equal(['fallback'])
  })

  it('recipe vars and overrides merge correctly (overrides win)', async () => {
    const recipe: Recipe = {
      name: 'merge',
      steps: [{args: ['${a}', '${b}'], run: 'cmd'}],
      vars: {a: 'default-a', b: 'default-b'},
    }
    const {ran, runner} = fakeRunner()
    await executeRecipe(recipe, runner, {a: 'override-a'})
    expect(ran[0].argv).to.deep.equal(['override-a', 'default-b'])
  })

  it('returns the correct step count for a mixed recipe', async () => {
    const recipe: Recipe = {
      name: 'step-count',
      steps: [
        {log: 'one'}, // +1
        {set: 'x', value: 1}, // +1
        {as: 'i', repeat: 2, steps: [{log: 'rep ${i}'}]},
        // repeat body runs twice: each log +1, then repeat itself +1 → +3
        {if: '${x} > 0', then: [{log: 'yes'}]},
        // if/then: inner log +1, if-branch +1 → +2
      ],
    }
    const {runner} = fakeRunner()
    const result = await executeRecipe(recipe, runner)
    // 1 + 1 + (2 inner logs + 1 repeat) + (1 inner log + 1 if) = 7
    expect(result.steps).to.equal(7)
  })

  it('exec step interpolates command string before executing', async () => {
    const recipe: Recipe = {
      name: 'exec-interp',
      steps: [{capture: 'out', exec: 'echo ${name}'}],
      vars: {name: 'alice'},
    }
    const {ran, runner} = fakeRunner({'echo alice': 'alice'})
    await executeRecipe(recipe, runner)
    expect(ran[0].id).to.equal('echo alice')
  })

  it('nested forEach with if-guarded run step', async () => {
    const recipe: Recipe = {
      name: 'nested',
      steps: [
        {
          as: 'item',
          forEach: '${list}',
          steps: [{args: ['${item.key}'], if: '${item.active}', run: 'process'}],
        },
      ],
      vars: {
        list: [
          {active: true, key: 'A'},
          {active: false, key: 'B'},
          {active: true, key: 'C'},
        ],
      },
    }
    const {ran, runner} = fakeRunner()
    await executeRecipe(recipe, runner)
    expect(ran.map((r) => r.argv[0])).to.deep.equal(['A', 'C'])
  })
})
