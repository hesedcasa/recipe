import {Context} from './types.js'

type PathPart = '*' | number | string

function parsePath(path: string): PathPart[] {
  const parts: PathPart[] = []
  let i = 0

  while (i < path.length) {
    if (path[i] === '.') {
      i++
    } else if (path[i] === '[') {
      i++
      if (path[i] === '*') {
        parts.push('*')
        i += 2 // skip * and ]
      } else if (path[i] === '"' || path[i] === "'") {
        const quote = path[i]
        i++
        const end = path.indexOf(quote, i)
        parts.push(path.slice(i, end))
        i = end + 2 // skip closing quote and ]
      } else {
        const end = path.indexOf(']', i)
        const n = Number(path.slice(i, end))
        parts.push(Number.isNaN(n) ? path.slice(i, end) : n)
        i = end + 1
      }
    } else {
      let end = i
      while (end < path.length && path[end] !== '.' && path[end] !== '[') end++
      parts.push(path.slice(i, end))
      i = end
    }
  }

  return parts
}

function resolveWithParts(obj: unknown, parts: PathPart[]): unknown {
  if (parts.length === 0) return obj
  const [head, ...tail] = parts

  if (head === '*') {
    if (!Array.isArray(obj)) return undefined
    return obj.map((item) => resolveWithParts(item, tail))
  }

  // typeof null === 'object', so we need the explicit null check first
  if (obj === null || typeof obj !== 'object') return undefined
  const next = (obj as Record<string, unknown>)[String(head)]
  return resolveWithParts(next, tail)
}

export function resolvePath(context: Context, path: string): unknown {
  return resolveWithParts(context, parsePath(path))
}

export function interpolate(template: string, context: Context): unknown {
  const fullMatch = /^\$\{([^}]+)\}$/.exec(template)
  if (fullMatch) return resolvePath(context, fullMatch[1])

  return template.replaceAll(/\$\{([^}]+)\}/g, (_, path: string) => {
    const value = resolvePath(context, path)
    return value === null || value === undefined ? '' : String(value)
  })
}

export function interpolateDeep(value: unknown, context: Context): unknown {
  if (typeof value === 'string') return interpolate(value, context)
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, context))
  // typeof null === 'object', so the null check is required here
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolateDeep(v, context)]),
    )
  }

  return value
}

export function toArg(template: string, context: Context): string {
  const value = interpolate(template, context)
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
