/* eslint-disable no-await-in-loop */
// Recipe steps execute sequentially by design: each step may read variables
// captured by the previous step, so parallel execution is not an option.
import {evaluateCondition} from './condition.js'
import {interpolate, interpolateDeep, toArg} from './interpolate.js'
import {Context, ExecStep, Recipe, Step} from './types.js'

export interface RecipeRunner {
  dryRun?: boolean
  exec(command: string): Promise<{stderr: string; stdout: string}>
  log(message: string): void
  runCommand(id: string, argv: string[], silent?: boolean): Promise<unknown>
}

/** Runs an exec step: captures stdout, or surfaces it terminal-style when uncaptured. */
async function runExecStep(step: ExecStep, ctx: Context, runner: RecipeRunner): Promise<void> {
  const command = String(interpolate(step.exec, ctx))
  if (runner.dryRun) {
    runner.log(`[dry-run] ${command}`)
    return
  }

  const {stdout} = await runner.exec(command)
  // Strip trailing newlines (mirroring shell `$(...)`), so a captured value flows
  // cleanly into a later command instead of splitting a line.
  const output = stdout.replace(/[\r\n]+$/, '')
  if (step.capture) {
    ctx[step.capture] = step.json ? JSON.parse(stdout) : output
  } else if (!step.silent && output) {
    // Surface uncaptured output, so an ad-hoc chain behaves like a terminal.
    runner.log(output)
  }
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
        const result = await runner.runCommand(step.run, argv, !!step.capture)
        if (step.capture) ctx[step.capture] = result
      }

      stepCount++
    } else if ('exec' in step) {
      await runExecStep(step, ctx, runner)
      stepCount++
    } else if ('repeat' in step) {
      const raw = step.repeat
      const count = typeof raw === 'number' ? raw : Number(interpolate(String(raw), ctx))
      const asVar = step.as ?? 'i'
      for (let i = 0; i < count; i++) {
        ctx[asVar] = i
        await runSteps(step.steps, ctx)
      }

      stepCount++
    } else if ('forEach' in step) {
      const collection = interpolate(step.forEach, ctx)
      if (Array.isArray(collection)) {
        const asVar = step.as ?? 'item'
        for (const [index, item] of collection.entries()) {
          ctx[asVar] = item
          ctx[`${asVar}_index`] = index
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
