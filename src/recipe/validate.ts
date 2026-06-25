import {Recipe, Step} from './types.js'

// The keys that identify a step's type. Every step must use exactly one.
const STEP_TYPE_KEYS = ['log', 'set', 'run', 'exec', 'repeat', 'forEach', 'if'] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateStep(step: unknown, path: string): void {
  if (!isObject(step)) throw new Error(`${path} must be an object.`)

  const typeKeys = STEP_TYPE_KEYS.filter((k) => k in step)
  if (typeKeys.length === 0) {
    throw new Error(`${path} has no recognized step key (one of: ${STEP_TYPE_KEYS.join(', ')}).`)
  }

  if ('forEach' in step || 'repeat' in step) {
    if (!Array.isArray(step.steps)) throw new Error(`${path} must have a "steps" array.`)
    for (const [i, child] of (step.steps as Step[]).entries()) validateStep(child, `${path}.steps[${i}]`)
  }

  if ('if' in step && ('then' in step || 'else' in step)) {
    for (const branch of ['then', 'else'] as const) {
      if (branch in step) {
        if (!Array.isArray(step[branch])) throw new Error(`${path}.${branch} must be an array.`)
        for (const [i, child] of (step[branch] as Step[]).entries()) validateStep(child, `${path}.${branch}[${i}]`)
      }
    }
  }
}

/** Throws a clear Error if the recipe is not well-formed. */
export function validateRecipe(recipe: unknown): asserts recipe is Recipe {
  if (!isObject(recipe)) throw new Error('Recipe must be a JSON object.')
  if (typeof recipe.name !== 'string' || recipe.name.trim() === '') {
    throw new Error('Recipe must have a non-empty "name".')
  }

  if (!Array.isArray(recipe.steps)) throw new Error('Recipe must have a "steps" array.')
  for (const [i, step] of recipe.steps.entries()) validateStep(step, `steps[${i}]`)
}
