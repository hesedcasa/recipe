import {exec} from 'node:child_process'
import {promisify} from 'node:util'

const execAsync = promisify(exec)

// exec() is intentional: recipe exec steps are full shell commands that may use pipes,
// redirects, and other shell features. Commands come from user-authored recipe files.
export async function execShell(command: string): Promise<{stderr: string; stdout: string}> {
  const {stderr, stdout} = await execAsync(command)
  return {stderr, stdout}
}
