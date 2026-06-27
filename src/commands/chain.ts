// The examples intentionally contain literal `${...}` placeholders, which are core to
// the interpolation syntax. Keep `description`/`summary` free of `${...}`: oclif's
// `commands` command renders them through lodash.template, which would try to evaluate
// `${...}` as JavaScript. Examples are EJS-rendered, so they may keep the literal syntax.
/* eslint-disable no-template-curly-in-string */
import {HostConfigCommand} from '@hesed/plugin-lib'
import {Flags} from '@oclif/core'
import {bold, cyan, dim} from 'ansis'

import {parseChain, stripFlags} from '../recipe/chain.js'
import {executeRecipe, RecipeRunner} from '../recipe/engine.js'
import {execShell} from '../recipe/exec.js'
import {saveRecipe} from '../recipe/store.js'
import {Context, Recipe} from '../recipe/types.js'
import {validateRecipe} from '../recipe/validate.js'
import {parseVars} from '../recipe/vars.js'

export default class RecipeChain extends HostConfigCommand {
  static description = `Step syntax — one step per argument, always wrapped in single quotes:
  exec: <shell command> [=> name | =>json name]
  run:  <command-id> [args...]  [=> name | =>json name]
  set:  <name> = <value>
  log:  <message>
  forEach: <collection> [as <name>]   body = next step, or a '{ ... }' block
  repeat:  <count> [as <name>]        body = next step, or a '{ ... }' block
  if:      <condition>                body = next step, or a '{ ... }' block
  else                                (optional, follows an if body)

Capturing output:
  => name      saves raw stdout to a variable (trailing newline stripped)
  =>json name  parses stdout as JSON before saving

Blocks: pass '{' and '}' as separate arguments to group multiple steps as a body.
Variables set in one step are available as placeholders in all later steps.
`
  static enableJsonFlag = true
  // Wrap each step in SINGLE quotes: steps contain ${...} placeholders, and a shell
  // would try to expand them inside double quotes (zsh errors with "bad substitution").
  // Single quotes pass them through literally for the CLI to interpolate.
  static examples = [
    "<%= config.bin %> <%= command.id %> 'exec: date => today' 'log: Today is ${today}'",
    "<%= config.bin %> <%= command.id %> 'set: items = [\"apple\",\"banana\",\"cherry\"]' 'forEach: ${items} as fruit' 'log: - ${fruit}'",
    "<%= config.bin %> <%= command.id %> 'set: count = 3' 'if: ${count} > 0' 'log: work to do' 'else' 'log: nothing to do'",
    "<%= config.bin %> <%= command.id %> 'set: nums = [1,2,3]' 'forEach: ${nums} as n' '{' 'log: item ${n}' 'exec: echo ${n}' '}'",
    "<%= config.bin %> <%= command.id %> 'run: jira issue search \"assignee = currentUser() AND statusCategory != Done\" => r' 'forEach: ${r.data.issues} as issue' 'log: ${issue.key} — ${issue.fields.summary}'",
    "<%= config.bin %> <%= command.id %> 'run: bb pr list my-workspace my-repo --state OPEN => r' 'forEach: ${r.data.values} as pr' 'log: #${pr.id} ${pr.title} (${pr.source.branch.name} → ${pr.destination.branch.name})'",
    "<%= config.bin %> <%= command.id %> 'exec: date => today' 'log: ${today}' --save show-date",
    "<%= config.bin %> <%= command.id %> 'exec: rm -rf /tmp/cache' --dry-run",
  ]
  static flags = {
    debug: Flags.boolean({description: 'Show step counts and execution summary.'}),
    'dry-run': Flags.boolean({description: 'Print the commands that would run without executing them.'}),
    save: Flags.string({description: 'Save the assembled chain as a reusable recipe with this name.'}),
    var: Flags.string({
      description: 'Provide an initial variable (key=value). Repeatable. Values parsed as JSON when possible.',
      multiple: true,
    }),
  }
  // Steps arrive as free-form positional args (including "{", "}", "else"), so the
  // parser — not oclif — decides how many there are.
  static strict = false
  static summary = "Chain commands on the fly, passing each step's output into the next."

  public async run(): Promise<Context> {
    const {flags} = await this.parse(RecipeChain)
    // Read step tokens from the raw argv, not the parsed argv: oclif's strict:false
    // parser reorders positionals (it groups repeated "{"/"}"), which breaks nesting.
    const steps = parseChain(stripFlags(this.argv, new Set(['--save', '--var'])))
    const vars: Context = parseVars(flags.var)

    const recipe: Recipe = {name: flags.save ?? 'chain', steps, vars}

    if (flags.save) {
      validateRecipe(recipe)
      const path = await saveRecipe(this.config, recipe)
      if (!this.jsonEnabled()) this.log(dim(`Saved chain as recipe ${cyan(flags.save)} at ${path}\n`))
    }

    if (!this.jsonEnabled() && flags.debug) {
      this.log(bold(`Running chain (${steps.length} step${steps.length === 1 ? '' : 's'})`))
      if (flags['dry-run']) this.log(dim('Dry run — no commands will be executed.\n'))
    }

    const runner: RecipeRunner = {
      dryRun: flags['dry-run'],
      exec: (command) => execShell(command),
      log: (message) => this.log(message),
      runCommand: (id, cmdArgv, silent) => {
        // Find the longest matching subcommand by greedily consuming argv tokens.
        // Stopping at the first match would dispatch "recipe validate" to the "recipe"
        // topic instead of the "recipe:validate" subcommand.
        let bestId: null | string = this.config.findCommand(id) ? id : null
        let bestI = 0
        let commandId = id
        for (const [i, token] of cmdArgv.entries()) {
          commandId = `${commandId}:${token}`
          if (this.config.findCommand(commandId)) {
            bestId = commandId
            bestI = i + 1
          }
        }

        const [resolvedId, resolvedArgv] = bestId ? [bestId, cmdArgv.slice(bestI)] : [id, cmdArgv]
        if (silent) {
          const orig = process.stdout.write.bind(process.stdout)
          process.stdout.write = () => true
          return this.config.runCommand(resolvedId, resolvedArgv).finally(() => {
            process.stdout.write = orig
          })
        }

        return this.config.runCommand(resolvedId, resolvedArgv)
      },
    }

    const result = await executeRecipe(recipe, runner, vars)

    if (!this.jsonEnabled() && flags.debug) {
      this.log(dim(`\nChain finished (${result.steps} step${result.steps === 1 ? '' : 's'}).`))
    }

    return result.vars
  }
}
