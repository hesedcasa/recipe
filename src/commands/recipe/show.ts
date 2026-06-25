import {Args, Command} from '@oclif/core'

import {resolveRecipe} from '../../recipe/store.js'
import {Recipe} from '../../recipe/types.js'

export default class RecipeShow extends Command {
  static args = {
    recipe: Args.string({description: 'Name of a saved recipe, or a path to a recipe file.', required: true}),
  }
  static description = 'Print the full definition of a recipe.'
  static enableJsonFlag = true
  static examples = ['<%= config.bin %> <%= command.id %> close-user-tickets']
  static summary = 'Print a recipe definition.'

  public async run(): Promise<Recipe> {
    const {args} = await this.parse(RecipeShow)
    const recipe = await resolveRecipe(this.config, args.recipe)

    if (!this.jsonEnabled()) {
      this.log(JSON.stringify(recipe, null, 2))
    }

    return recipe
  }
}
