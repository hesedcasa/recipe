import {Args, Command, Flags} from '@oclif/core'
import {bold, cyan, dim} from 'ansis'

import {executeRecipe, RecipeRunner} from '../../recipe/engine.js'
import {execShell} from '../../recipe/exec.js'
import {resolveRecipe} from '../../recipe/store.js'
import {Context} from '../../recipe/types.js'

/** Parses a `--var key=value` flag, JSON-decoding the value when possible. */
function parseVar(input: string): [string, unknown] {
  const eq = input.indexOf('=')
  if (eq === -1) throw new Error(`Invalid --var "${input}". Expected key=value.`)
  const key = input.slice(0, eq)
  const raw = input.slice(eq + 1)
  try {
    return [key, JSON.parse(raw)]
  } catch {
    return [key, raw]
  }
}

export default class RecipeRun extends Command {
  static args = {
    recipe: Args.string({description: 'Name of a saved recipe, or a path to a recipe file.', required: true}),
  }
  static description = `Each step runs a command, with optional conditions, loops and JSON operations between them.

Use --var to override the recipe's default variables, and --dry-run to preview the commands without running them.`
  static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %> close-user-tickets',
    '<%= config.bin %> <%= command.id %> close-user-tickets --var assignee=jdoe',
    '<%= config.bin %> <%= command.id %> ./my-recipe.json --dry-run',
  ]
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the commands that would run without executing them.'}),
    var: Flags.string({
      description: 'Override a recipe variable (key=value). Repeatable. Values are parsed as JSON when possible.',
      multiple: true,
    }),
  }
  static summary = 'Run a recipe: a sequence of commands chained with conditions, loops and JSON operations.'

  public async run(): Promise<Context> {
    const {args, flags} = await this.parse(RecipeRun)
    const recipe = await resolveRecipe(this.config, args.recipe)

    const overrides: Context = Object.fromEntries((flags.var ?? []).map((entry) => parseVar(entry)))

    if (!this.jsonEnabled()) {
      this.log(bold(`Running recipe ${cyan(recipe.name)}`))
      if (recipe.description) this.log(dim(recipe.description))
      if (flags['dry-run']) this.log(dim('Dry run — no commands will be executed.\n'))
    }

    const runner: RecipeRunner = {
      dryRun: flags['dry-run'],
      exec: (command) => execShell(command),
      log: (message) => this.log(message),
      runCommand: (id, argv) => this.config.runCommand(id, argv),
    }

    const result = await executeRecipe(recipe, runner, overrides)

    if (!this.jsonEnabled()) {
      this.log(dim(`\n✅ Recipe ${recipe.name} finished (${result.steps} step${result.steps === 1 ? '' : 's'}).`))
    }

    return result.vars
  }
}
