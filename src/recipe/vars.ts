import {Context} from './types.js'

/** Parses a `--var key=value` flag, JSON-decoding the value when possible. */
export function parseVar(input: string): [string, unknown] {
  const eq = input.indexOf('=')
  if (eq === -1) throw new Error(`Invalid --var "${input}". Expected key=value.`)
  const key = input.slice(0, eq)
  const raw = input.slice(eq + 1)
  try {
    return [key, JSON.parse(raw)]
  } catch {
    return [key, raw]
  }
}

/** Builds a variable context from repeated `--var key=value` flags. */
export function parseVars(inputs: string[] | undefined): Context {
  return Object.fromEntries((inputs ?? []).map((entry) => parseVar(entry)))
}
