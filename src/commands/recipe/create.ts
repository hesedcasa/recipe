// The starter recipe intentionally contains literal `${...}` placeholders and a
// `then` branch key, both of which are core to the recipe syntax.
/* eslint-disable no-template-curly-in-string, unicorn/no-thenable */
import {Args, Command, Flags} from '@oclif/core'
import {cyan} from 'ansis'

import {recipeExists, saveRecipe} from '../../recipe/store.js'
import {Recipe} from '../../recipe/types.js'

/** Builds a runnable, self-documenting starter recipe. */
function starterRecipe(name: string, description?: string): Recipe {
  return {
    description: description ?? 'Describe what this recipe does.',
    name,
    steps: [
      {log: 'Hello, ${greeting}!'},
      {set: 'count', value: 2},
      {
        as: 'i',
        repeat: '${count}',
        steps: [{log: 'Iteration ${i}'}],
      },
      {
        else: [{log: 'Nothing to do.'}],
        if: '${count} > 0',
        then: [{log: 'There is something to do.'}],
      },
    ],
    vars: {
      greeting: 'world',
    },
    version: '1.0',
  }
}

export default class RecipeCreate extends Command {
  static args = {
    name: Args.string({description: 'Name for the new recipe.', required: true}),
  }
  static description = 'Creates a starter recipe in the recipe store that you can edit and run.'
  static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %> close-user-tickets',
    '<%= config.bin %> <%= command.id %> close-user-tickets --description "Close all tickets for a user"',
  ]
  static flags = {
    description: Flags.string({char: 'd', description: 'Description for the recipe.'}),
    force: Flags.boolean({char: 'f', description: 'Overwrite an existing recipe with the same name.'}),
  }
  static summary = 'Scaffold a new recipe.'

  public async run(): Promise<{name: string; path: string}> {
    const {args, flags} = await this.parse(RecipeCreate)

    if (!flags.force && (await recipeExists(this.config, args.name))) {
      this.error(`Recipe "${args.name}" already exists. Use --force to overwrite.`)
    }

    const recipe = starterRecipe(args.name, flags.description)
    const path = await saveRecipe(this.config, recipe)

    if (!this.jsonEnabled()) {
      this.log(`Created recipe ${cyan(args.name)} at ${path}`)
      this.log(`Edit it, then run it with "${this.config.bin} recipe run ${args.name}".`)
    }

    return {name: args.name, path}
  }
}
