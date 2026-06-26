import {interpolate, resolvePath} from './interpolate.js'
import {Context} from './types.js'

/** Resolves a condition's right-hand operand: a ${...} expression, a quoted string, or a bare literal. */
function resolveOperand(raw: string, context: Context): unknown {
  const trimmed = raw.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  if (trimmed.includes('${')) return interpolate(trimmed, context)
  return trimmed
}

function splitOutsideTemplates(expr: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0

  while (i < expr.length) {
    if (expr[i] === '$' && expr[i + 1] === '{') {
      depth++
      current += expr[i++]
    } else if (expr[i] === '}' && depth > 0) {
      depth--
      current += expr[i++]
    } else if (depth === 0 && expr.startsWith(separator, i)) {
      parts.push(current)
      current = ''
      i += separator.length
    } else {
      current += expr[i++]
    }
  }

  parts.push(current)
  return parts.length > 1 ? parts : [expr]
}

function applyOp(value: unknown, op: string, right: unknown): boolean {
  const rightStr = String(right)
  switch (op) {
    case '!=': {
      return String(value) !== rightStr
    }

    case '<': {
      return Number(value) < Number(right)
    }

    case '<=': {
      return Number(value) <= Number(right)
    }

    case '==': {
      return String(value) === rightStr
    }

    case '>': {
      return Number(value) > Number(right)
    }

    case '>=': {
      return Number(value) >= Number(right)
    }

    case 'contains': {
      return Array.isArray(value) ? value.includes(right) : String(value).includes(rightStr)
    }

    case 'matches': {
      return new RegExp(rightStr).test(String(value))
    }

    default: {
      return false
    }
  }
}

export function evaluateCondition(expr: string, context: Context): boolean {
  expr = expr.trim()

  const orParts = splitOutsideTemplates(expr, '||')
  if (orParts.length > 1) return orParts.some((part) => evaluateCondition(part.trim(), context))

  const andParts = splitOutsideTemplates(expr, '&&')
  if (andParts.length > 1) return andParts.every((part) => evaluateCondition(part.trim(), context))

  if (expr.startsWith('!')) return !evaluateCondition(expr.slice(1).trim(), context)

  const binaryMatch = /^\$\{([^}]+)\}\s*(==|!=|>=|<=|>|<|contains|matches)\s*(.+)$/.exec(expr)
  if (binaryMatch) {
    const [, path, op, right] = binaryMatch
    return applyOp(resolvePath(context, path), op, resolveOperand(right, context))
  }

  const simpleMatch = /^\$\{([^}]+)\}$/.exec(expr)
  if (simpleMatch) return Boolean(resolvePath(context, simpleMatch[1]))

  return Boolean(expr)
}
