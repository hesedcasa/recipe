import {expect} from 'chai'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {
  listRecipes,
  loadRecipeFile,
  readRecipe,
  recipeExists,
  removeRecipe,
  resolveRecipe,
  saveRecipe,
} from '../../src/recipe/store.js'
import {Recipe} from '../../src/recipe/types.js'

function fakeConfig(dataDir: string): {dataDir: string} {
  return {dataDir}
}

const sampleRecipe: Recipe = {
  description: 'A test recipe',
  name: 'test-recipe',
  steps: [{log: 'hello'}],
  vars: {greeting: 'world'},
  version: '1.0',
}

describe('recipe store', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'recipe-store-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {force: true, recursive: true})
  })

  describe('saveRecipe / readRecipe', () => {
    it('saves a recipe and reads it back identically', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      const loaded = await readRecipe(config, 'test-recipe')
      expect(loaded).to.deep.equal(sampleRecipe)
    })

    it('saveRecipe returns the file path', async () => {
      const config = fakeConfig(tmpDir)
      const path = await saveRecipe(config, sampleRecipe)
      expect(path).to.include('test-recipe.json')
      expect(path).to.include(tmpDir)
    })

    it('overwrites an existing recipe when called again', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      const updated = {...sampleRecipe, description: 'Updated description'}
      await saveRecipe(config, updated)
      const loaded = await readRecipe(config, 'test-recipe')
      expect(loaded.description).to.equal('Updated description')
    })

    it('creates the recipes directory if it does not exist', async () => {
      const nestedDir = join(tmpDir, 'nested', 'data')
      const config = fakeConfig(nestedDir)
      const path = await saveRecipe(config, sampleRecipe)
      const loaded = await readRecipe(config, 'test-recipe')
      expect(loaded.name).to.equal('test-recipe')
      expect(path).to.include('test-recipe.json')
    })
  })

  describe('recipeExists', () => {
    it('returns true when recipe exists', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      expect(await recipeExists(config, 'test-recipe')).to.be.true
    })

    it('returns false when recipe does not exist', async () => {
      const config = fakeConfig(tmpDir)
      expect(await recipeExists(config, 'no-such-recipe')).to.be.false
    })
  })

  describe('listRecipes', () => {
    it('returns empty array when recipes directory does not exist', async () => {
      const config = fakeConfig(join(tmpDir, 'missing-dir'))
      const recipes = await listRecipes(config)
      expect(recipes).to.deep.equal([])
    })

    it('returns empty array when no recipes are saved', async () => {
      const config = fakeConfig(tmpDir)
      // Create the dir but add no recipes
      await saveRecipe(config, sampleRecipe)
      await removeRecipe(config, 'test-recipe')
      const recipes = await listRecipes(config)
      expect(recipes).to.deep.equal([])
    })

    it('returns all saved recipes', async () => {
      const config = fakeConfig(tmpDir)
      const recipeA: Recipe = {name: 'alpha', steps: [{log: 'a'}]}
      const recipeB: Recipe = {name: 'beta', steps: [{log: 'b'}]}
      await saveRecipe(config, recipeA)
      await saveRecipe(config, recipeB)
      const recipes = await listRecipes(config)
      const names = recipes.map((r) => r.name).sort()
      expect(names).to.deep.equal(['alpha', 'beta'])
    })

    it('ignores non-JSON files in the recipes directory', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      // Write a non-JSON file into the recipes dir
      const {recipesDir} = await import('../../src/recipe/store.js')
      await writeFile(join(recipesDir(config), 'readme.txt'), 'not a recipe')
      const recipes = await listRecipes(config)
      expect(recipes).to.have.length(1)
      expect(recipes[0].name).to.equal('test-recipe')
    })
  })

  describe('removeRecipe', () => {
    it('removes a saved recipe so it no longer exists', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      await removeRecipe(config, 'test-recipe')
      expect(await recipeExists(config, 'test-recipe')).to.be.false
    })

    it('throws when recipe does not exist', async () => {
      const config = fakeConfig(tmpDir)
      let threw = false
      try {
        await removeRecipe(config, 'ghost')
      } catch {
        threw = true
      }

      expect(threw).to.be.true
    })
  })

  describe('loadRecipeFile', () => {
    it('loads a recipe from an absolute file path', async () => {
      const filePath = join(tmpDir, 'my-recipe.json')
      await writeFile(filePath, JSON.stringify(sampleRecipe, null, 2))
      const loaded = await loadRecipeFile(filePath)
      expect(loaded).to.deep.equal(sampleRecipe)
    })

    it('throws for a non-existent file path', async () => {
      let threw = false
      try {
        await loadRecipeFile(join(tmpDir, 'nope.json'))
      } catch {
        threw = true
      }

      expect(threw).to.be.true
    })
  })

  describe('resolveRecipe', () => {
    it('resolves by name from the store when no slash or .json suffix', async () => {
      const config = fakeConfig(tmpDir)
      await saveRecipe(config, sampleRecipe)
      const recipe = await resolveRecipe(config, 'test-recipe')
      expect(recipe).to.deep.equal(sampleRecipe)
    })

    it('resolves by file path when the name contains a slash', async () => {
      const config = fakeConfig(tmpDir)
      const filePath = join(tmpDir, 'local.json')
      await writeFile(filePath, JSON.stringify(sampleRecipe, null, 2))
      const recipe = await resolveRecipe(config, filePath)
      expect(recipe).to.deep.equal(sampleRecipe)
    })

    it('resolves by file path when the name ends with .json (absolute path)', async () => {
      const config = fakeConfig(tmpDir)
      // Write directly to disk — not through saveRecipe, so not in the store dir
      const notInStore: Recipe = {name: 'file-only', steps: [{log: 'hi'}]}
      const filePath = join(tmpDir, 'file-only.json')
      await writeFile(filePath, JSON.stringify(notInStore, null, 2))
      // Absolute path ends with .json — triggers the file-path branch
      const recipe = await resolveRecipe(config, filePath)
      expect(recipe.name).to.equal('file-only')
    })
  })
})
