import {Command, Config} from '@oclif/core'
import {expect} from 'chai'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import RecipeRun from '../../../src/commands/recipe/run.js'
import {Recipe} from '../../../src/recipe/types.js'

// The recipe runner dispatches steps via `this.config.runCommand(...)`. Hosts
// frequently inject commands into the Config's command map at startup (e.g. the
// `figma`/`context7` commands) rather than through a statically installed
// plugin. oclif's default `Command.run` reloads the Config and discards those
// dynamic commands; `HostConfigCommand` (which RecipeRun extends) keeps the live
// Config intact so recipe steps targeting dynamic commands still resolve.
describe('recipe run command', () => {
  let tmpDir: string
  let config: Config

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'recipe-run-test-'))
    config = await Config.load(process.cwd())
  })

  afterEach(async () => {
    await rm(tmpDir, {force: true, recursive: true})
  })

  it('dispatches a dynamically-registered command from a recipe step', async () => {
    let dispatchedArgv: string[] | undefined

    class DynamicCommand extends Command {
      static id = 'dyn:hello'

      async run(): Promise<void> {
        dispatchedArgv = this.argv
      }
    }

    // Inject the command the way a host does at startup — straight into the
    // Config's command map, not via the registered plugin list.
    ;(config as unknown as {_commands: Map<string, unknown>})._commands.set('dyn:hello', {
      aliases: [],
      hidden: false,
      id: 'dyn:hello',
      load: async () => DynamicCommand,
      pluginType: 'core',
    })

    const recipe: Recipe = {name: 'call-dynamic', steps: [{args: ['world'], run: 'dyn:hello'}]}
    const recipePath = join(tmpDir, 'call-dynamic.json')
    await writeFile(recipePath, JSON.stringify(recipe))

    await RecipeRun.run([recipePath], config)

    // If the Config had been reloaded (plain Command behavior), the dynamic
    // command would be gone and runCommand would have thrown instead.
    expect(dispatchedArgv).to.deep.equal(['world'])
  })
})
