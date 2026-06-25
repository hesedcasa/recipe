import {Args, Command} from '@oclif/core'
import {green} from 'ansis'

import {resolveRecipe} from '../../recipe/store.js'
import {validateRecipe} from '../../recipe/validate.js'

export default class RecipeValidate extends Command {
  static args = {
    recipe: Args.string({description: 'Name of a saved recipe, or a path to a recipe file.', required: true}),
  }
  static description = 'Check that a recipe is well-formed without running it.'
  static enableJsonFlag = true
  static examples = ['<%= config.bin %> <%= command.id %> ./my-recipe.json']
  static summary = 'Validate a recipe.'

  public async run(): Promise<{name: string; valid: boolean}> {
    const {args} = await this.parse(RecipeValidate)
    const recipe = await resolveRecipe(this.config, args.recipe)
    // resolveRecipe only parses JSON; validateRecipe checks the structure.
    validateRecipe(recipe)

    if (!this.jsonEnabled()) {
      this.log(`${green('✓')} Recipe ${recipe.name} is valid (${recipe.steps.length} steps).`)
    }

    return {name: recipe.name, valid: true}
  }
}
