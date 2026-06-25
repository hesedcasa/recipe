/* eslint-disable no-await-in-loop */
// Recipe steps execute sequentially by design: each step may read variables
// captured by the previous step, so parallel execution is not an option.
import {evaluateCondition} from './condition.js'
import {interpolate, interpolateDeep, toArg} from './interpolate.js'
import {Context, Recipe, Step} from './types.js'

export interface RecipeRunner {
  dryRun?: boolean
  exec(command: string): Promise<{stderr: string; stdout: string}>
  log(message: string): void
  runCommand(id: string, argv: string[]): Promise<unknown>
}

export async function executeRecipe(
  recipe: Recipe,
  runner: RecipeRunner,
  overrides: Context = {},
): Promise<{steps: number; vars: Context}> {
  const vars: Context = {...recipe.vars, ...overrides}
  let stepCount = 0

  async function executeStep(step: Step, ctx: Context): Promise<void> {
    if ('log' in step) {
      runner.log(String(interpolate(step.log, ctx)))
      stepCount++
    } else if ('set' in step) {
      ctx[step.set] = interpolateDeep(step.value, ctx)
      stepCount++
    } else if ('run' in step) {
      const argv = (step.args ?? []).map((a) => toArg(String(a), ctx))
      if (runner.dryRun) {
        runner.log(`[dry-run] ${step.run}${argv.length > 0 ? ' ' + argv.join(' ') : ''}`)
      } else {
        const result = await runner.runCommand(step.run, argv)
        if (step.capture) ctx[step.capture] = result
      }

      stepCount++
    } else if ('exec' in step) {
      const command = String(interpolate(step.exec, ctx))
      if (runner.dryRun) {
        runner.log(`[dry-run] ${command}`)
      } else {
        const {stdout} = await runner.exec(command)
        if (step.capture) ctx[step.capture] = step.json ? JSON.parse(stdout) : stdout
      }

      stepCount++
    } else if ('repeat' in step) {
      const raw = step.repeat
      const count = typeof raw === 'number' ? raw : Number(interpolate(String(raw), ctx))
      for (let i = 0; i < count; i++) {
        if (step.as) ctx[step.as] = i
        await runSteps(step.steps, ctx)
      }

      stepCount++
    } else if ('forEach' in step) {
      const collection = interpolate(step.forEach, ctx)
      if (Array.isArray(collection)) {
        for (const item of collection) {
          ctx[step.as] = item
          await runSteps(step.steps, ctx)
        }
      }

      stepCount++
    }
  }

  async function runSteps(steps: Step[], ctx: Context): Promise<void> {
    for (const step of steps) {
      if ('then' in step || ('else' in step && !('run' in step) && !('exec' in step))) {
        const cond = evaluateCondition(step.if, ctx)
        if (cond) {
          if (step.then) await runSteps(step.then, ctx)
        } else if (step.else) await runSteps(step.else, ctx)
        stepCount++
      } else {
        if ('if' in step && step.if && !evaluateCondition(step.if, ctx)) continue
        await executeStep(step, ctx)
      }
    }
  }

  await runSteps(recipe.steps, vars)
  return {steps: stepCount, vars}
}
