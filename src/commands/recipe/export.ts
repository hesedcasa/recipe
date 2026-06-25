import {Args, Command, Flags} from '@oclif/core'
import {cyan} from 'ansis'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'

import {readRecipe} from '../../recipe/store.js'

export default class RecipeExport extends Command {
  static args = {
    recipe: Args.string({description: 'Name of the saved recipe to export.', required: true}),
  }
  static description = `Write a saved recipe to a JSON file so it can be shared or version-controlled.

With --stdout the recipe is printed instead of written to a file.`
  static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %> close-user-tickets',
    '<%= config.bin %> <%= command.id %> close-user-tickets --output ./shared/close-user-tickets.json',
    '<%= config.bin %> <%= command.id %> close-user-tickets --stdout',
  ]
  static flags = {
    force: Flags.boolean({char: 'f', description: 'Overwrite the output file if it already exists.'}),
    output: Flags.string({char: 'o', description: 'Output file path. Defaults to ./<name>.json.'}),
    stdout: Flags.boolean({description: 'Print the recipe to stdout instead of writing a file.'}),
  }
  static summary = 'Export a recipe to a file.'

  public async run(): Promise<{path?: string; recipe: string}> {
    const {args, flags} = await this.parse(RecipeExport)
    const recipe = await readRecipe(this.config, args.recipe)
    const content = `${JSON.stringify(recipe, null, 2)}\n`

    if (flags.stdout) {
      this.log(content.trimEnd())
      return {recipe: recipe.name}
    }

    const output = resolve(flags.output ?? `${recipe.name}.json`)

    if (!flags.force) {
      const {access} = await import('node:fs/promises')
      try {
        await access(output)
        this.error(`${output} already exists. Use --force to overwrite.`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }

    await writeFile(output, content)

    if (!this.jsonEnabled()) {
      this.log(`Exported recipe ${cyan(recipe.name)} to ${output}`)
    }

    return {path: output, recipe: recipe.name}
  }
}
