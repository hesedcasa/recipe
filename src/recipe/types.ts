export type Context = Record<string, unknown>

export interface LogStep {
  if?: string
  log: string
}

export interface SetStep {
  if?: string
  set: string
  value: unknown
}

export interface RunStep {
  args?: string[]
  capture?: string
  if?: string
  run: string
}

export interface ExecStep {
  capture?: string
  exec: string
  if?: string
  json?: boolean
  silent?: boolean
}

export interface RepeatStep {
  as?: string
  if?: string
  repeat: number | string
  steps: Step[]
}

export interface ForEachStep {
  as: string
  forEach: string
  if?: string
  steps: Step[]
}

export interface IfStep {
  else?: Step[]
  if: string
  then?: Step[]
}

export type Step = ExecStep | ForEachStep | IfStep | LogStep | RepeatStep | RunStep | SetStep

export interface Recipe {
  description?: string
  name: string
  steps: Step[]
  vars?: Context
  version?: string
}
