// Parses a compact, one-token-per-step DSL into recipe Steps so a chain can be
// assembled and run on the fly without authoring a recipe file. Each element of
// the input array is a single step (or a block delimiter), exactly as it arrives
// from the CLI's variadic positional args.
//
// Step forms (the text before the first ":" picks the type):
//   exec: <shell command> [=> name | =>json name]
//   run:  <command-id> [args...] [=> name | =>json name]
//   set:  <name> = <value>        (value JSON-parsed when possible, else string)
//   log:  <message>
//   forEach: ${collection} [as <name>]   body = next step, or a { ... } block
//   repeat:  <count> [as <name>]         body = next step, or a { ... } block
//   if:      <condition>                 body = next step, or a { ... } block
//   else                                 (optional, follows an if's body)
//
// Blocks group multiple steps as a body: a standalone "{" token opens, "}" closes.
// Without a block, a control step's body is the single step that follows it.
//
// `then` is a recipe IfStep key, not a Promise method — the no-thenable rule is moot here.
/* eslint-disable unicorn/no-thenable */
import {ExecStep, ForEachStep, IfStep, RepeatStep, RunStep, Step} from './types.js'

const CAPTURE_RE = /\s=>(json)?\s+([A-Za-z_$][\w$]*)\s*$/

/** Splits a run step's argument string into argv, respecting single/double quotes. */
export function splitArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: "'" | '"' | null = null
  let started = false

  for (const ch of input.trim()) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (ch === ' ' || ch === '\t') {
      if (started) args.push(current)
      current = ''
      started = false
    } else {
      current += ch
      started = true
    }
  }

  if (started) args.push(current)
  return args
}

/** Pulls a trailing `=> name` / `=>json name` capture clause off a command string. */
function takeCapture(body: string): {capture?: string; command: string; json: boolean} {
  const match = CAPTURE_RE.exec(body)
  if (!match) return {command: body.trim(), json: false}
  return {capture: match[2], command: body.slice(0, match.index).trim(), json: Boolean(match[1])}
}

/** Splits "forEach: ${x} as y" / "repeat: 3 as y" head into its expression and `as` binding. */
function takeAs(head: string): {as?: string; expr: string} {
  const match = /\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(head)
  if (!match) return {expr: head.trim()}
  return {as: match[1], expr: head.slice(0, match.index).trim()}
}

class ChainParser {
  private pos = 0

  constructor(private readonly tokens: string[]) {}

  parse(): Step[] {
    const steps = this.parseSteps()
    if (this.pos < this.tokens.length) throw new Error(`Unexpected "${this.tokens[this.pos]}" (no matching "{").`)
    return steps
  }

  /** Parses a control step's body: a `{ ... }` block, or the single following step. */
  private parseBody(owner: string): Step[] {
    if (this.peek() === '{') {
      this.pos++ // consume {
      const body = this.parseSteps()
      if (this.peek() !== '}') throw new Error(`Unclosed "{" for ${owner}.`)
      this.pos++ // consume }
      return body
    }

    if (this.pos >= this.tokens.length || this.peek() === '}' || this.peek() === 'else') {
      throw new Error(`${owner} needs a body step (or a "{ ... }" block).`)
    }

    return [this.parseStep()]
  }

  private parseStep(): Step {
    const token = this.tokens[this.pos++]
    const colon = token.indexOf(':')
    const type = (colon === -1 ? token : token.slice(0, colon)).trim()
    const rest = colon === -1 ? '' : token.slice(colon + 1).trim()

    switch (type) {
      case 'exec': {
        const {capture, command, json} = takeCapture(rest)
        const step: ExecStep = {exec: command, json}
        if (capture) step.capture = capture
        return step
      }

      case 'forEach': {
        const {as: asVar, expr} = takeAs(rest)
        const step: ForEachStep = {forEach: expr, steps: this.parseBody('forEach')}
        if (asVar) step.as = asVar
        return step
      }

      case 'if': {
        const step: IfStep = {if: rest, then: this.parseBody('if')}
        if (this.peek() === 'else') {
          this.pos++ // consume else
          step.else = this.parseBody('else')
        }

        return step
      }

      case 'log': {
        return {log: rest}
      }

      case 'repeat': {
        const {as: asVar, expr} = takeAs(rest)
        const count = Number.isNaN(Number(expr)) ? expr : Number(expr)
        const step: RepeatStep = {repeat: count, steps: this.parseBody('repeat')}
        if (asVar) step.as = asVar
        return step
      }

      case 'run': {
        // A `run` step captures the command's return value directly, so the `=>json`
        // and `=>` capture forms behave identically here (no stdout parsing involved).
        const {capture, command} = takeCapture(rest)
        const [id, ...args] = splitArgs(command)
        if (!id) throw new Error('run: needs a command id.')
        const step: RunStep = {args, run: id}
        if (capture) step.capture = capture
        return step
      }

      case 'set': {
        const eq = rest.indexOf('=')
        if (eq === -1) throw new Error(`set: expected "name = value", got "${rest}".`)
        const name = rest.slice(0, eq).trim()
        const raw = rest.slice(eq + 1).trim()
        let value: unknown
        try {
          value = JSON.parse(raw)
        } catch {
          value = raw
        }

        return {set: name, value}
      }

      default: {
        throw new Error(`Unknown step "${token}". Expected one of: exec, run, set, log, forEach, repeat, if.`)
      }
    }
  }

  private parseSteps(): Step[] {
    const steps: Step[] = []
    while (this.pos < this.tokens.length && this.peek() !== '}') {
      steps.push(this.parseStep())
    }

    return steps
  }

  private peek(): string | undefined {
    return this.tokens[this.pos]
  }
}

/** Parses a chain of step tokens (one step per CLI arg) into recipe Steps. */
export function parseChain(tokens: string[]): Step[] {
  if (tokens.length === 0) throw new Error('A chain needs at least one step.')
  return new ChainParser(tokens).parse()
}

/**
 * Strips CLI flags (and the separate value of any value-taking flag) from raw argv,
 * preserving the order of the remaining step tokens.
 *
 * oclif's `strict: false` parser reorders argv — it groups repeated tokens like the
 * block delimiters `{` and `}` — which corrupts nesting. So the command derives its
 * step tokens from the unmodified `this.argv` via this helper. Step tokens never begin
 * with "-" (they start with `exec:`, `forEach:`, `{`, `}`, `else`, …), so any token
 * starting with "-" is unambiguously a flag.
 */
export function stripFlags(argv: string[], valueFlags: Set<string>): string[] {
  const steps: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('-')) {
      // `--flag value` consumes the next token; `--flag=value` carries it inline.
      if (valueFlags.has(token)) i++
      continue
    }

    steps.push(token)
  }

  return steps
}
