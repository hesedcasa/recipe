import {Command} from '@oclif/core'
import {dim} from 'ansis'

import {listRecipes, recipesDir} from '../../recipe/store.js'
import {Recipe} from '../../recipe/types.js'

export default class RecipeIndex extends Command {
  static description = 'List saved recipes.'
  static enableJsonFlag = true
  static examples = ['<%= config.bin %> <%= command.id %>']
  static summary = 'List saved recipes.'

  public async run(): Promise<Recipe[]> {
    const recipes = await listRecipes(this.config)

    if (!this.jsonEnabled()) {
      if (recipes.length === 0) {
        this.log(`No recipes saved. Create one with "${this.config.bin} recipe create <name>".`)
        this.log(dim(`Recipes are stored in ${recipesDir(this.config)}`))
      } else {
        for (const recipe of recipes) {
          const steps = `${recipe.steps.length} step${recipe.steps.length === 1 ? '' : 's'}`
          this.log(`${recipe.name} ${dim(steps)}`)
          if (recipe.description) this.log(dim(`  ${recipe.description}`))
        }
      }
    }

    return recipes
  }
}
