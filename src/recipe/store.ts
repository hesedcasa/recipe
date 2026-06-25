import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {Recipe} from './types.js'

export function recipesDir(config: {dataDir: string}): string {
  return join(config.dataDir, 'recipes')
}

export async function recipeExists(config: {dataDir: string}, name: string): Promise<boolean> {
  try {
    await readFile(join(recipesDir(config), `${name}.json`))
    return true
  } catch {
    return false
  }
}

export async function saveRecipe(config: {dataDir: string}, recipe: Recipe): Promise<string> {
  const dir = recipesDir(config)
  await mkdir(dir, {recursive: true})
  const path = join(dir, `${recipe.name}.json`)
  await writeFile(path, JSON.stringify(recipe, null, 2) + '\n')
  return path
}

export async function readRecipe(config: {dataDir: string}, name: string): Promise<Recipe> {
  const content = await readFile(join(recipesDir(config), `${name}.json`), 'utf8')
  return JSON.parse(content) as Recipe
}

export async function listRecipes(config: {dataDir: string}): Promise<Recipe[]> {
  try {
    const files = await readdir(recipesDir(config))
    return Promise.all(files.filter((f) => f.endsWith('.json')).map((f) => readRecipe(config, f.slice(0, -5))))
  } catch {
    return []
  }
}

export async function removeRecipe(config: {dataDir: string}, name: string): Promise<void> {
  await rm(join(recipesDir(config), `${name}.json`))
}

export async function loadRecipeFile(filePath: string): Promise<Recipe> {
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content) as Recipe
}

export async function resolveRecipe(config: {dataDir: string}, nameOrPath: string): Promise<Recipe> {
  if (nameOrPath.includes('/') || nameOrPath.endsWith('.json')) return loadRecipeFile(nameOrPath)
  return readRecipe(config, nameOrPath)
}
