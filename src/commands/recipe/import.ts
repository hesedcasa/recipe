import {Args, Command, Flags} from '@oclif/core'
import {cyan} from 'ansis'

import {loadRecipeFile, recipeExists, saveRecipe} from '../../recipe/store.js'

export default class RecipeImport extends Command {
  static args = {
    path: Args.string({description: 'Path to a recipe JSON file to import.', required: true}),
  }
  static description = 'Import a recipe from a JSON file into the recipe store so it can be run by name.'
  static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %> ./close-user-tickets.json',
    '<%= config.bin %> <%= command.id %> ./shared-recipe.json --name my-copy',
  ]
  static flags = {
    force: Flags.boolean({char: 'f', description: 'Overwrite an existing recipe with the same name.'}),
    name: Flags.string({description: 'Save the imported recipe under a different name.'}),
  }
  static summary = 'Import a recipe from a file.'

  public async run(): Promise<{name: string; path: string}> {
    const {args, flags} = await this.parse(RecipeImport)

    const recipe = await loadRecipeFile(args.path)
    if (flags.name) recipe.name = flags.name

    if (!flags.force && (await recipeExists(this.config, recipe.name))) {
      this.error(`Recipe "${recipe.name}" already exists. Use --force to overwrite or --name to rename.`)
    }

    const path = await saveRecipe(this.config, recipe)

    if (!this.jsonEnabled()) {
      this.log(`Imported recipe ${cyan(recipe.name)} to ${path}`)
    }

    return {name: recipe.name, path}
  }
}
