import {Args, Command} from '@oclif/core'

import {recipeExists, removeRecipe} from '../../recipe/store.js'

export default class RecipeRemove extends Command {
  static aliases = ['recipe:delete']
  static args = {
    recipe: Args.string({description: 'Name of the saved recipe to remove.', required: true}),
  }
  static description = 'Delete a recipe from the recipe store.'
  static enableJsonFlag = true
  static examples = ['<%= config.bin %> <%= command.id %> close-user-tickets']
  static summary = 'Remove a saved recipe.'

  public async run(): Promise<{name: string; removed: boolean}> {
    const {args} = await this.parse(RecipeRemove)

    if (!(await recipeExists(this.config, args.recipe))) {
      this.error(`Recipe "${args.recipe}" not found.`)
    }

    await removeRecipe(this.config, args.recipe)

    if (!this.jsonEnabled()) {
      this.log(`Removed recipe ${args.recipe}.`)
    }

    return {name: args.recipe, removed: true}
  }
}
