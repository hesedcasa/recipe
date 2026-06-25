# Recipes

A **recipe** chains multiple CLI commands together to accomplish a task — for
example, "set every Jira ticket assigned to a user to Done". Recipes support
basic conditions, loops and JSON operations, use a small easy-to-read JSON
syntax, and can be imported and exported as plain files.

- [Quick start](#quick-start)
- [Commands](#commands)
- [Chain commands on the fly](#chain-commands-on-the-fly)
- [Recipe format](#recipe-format)
- [Variables and interpolation](#variables-and-interpolation)
- [Step types](#step-types)
- [Conditions](#conditions)
- [Worked example: close a user's tickets](#worked-example-close-a-users-tickets)

## Quick start

```sh-session
# Scaffold a starter recipe you can edit
$ mycli recipe create close-user-tickets

# See what it would do without running anything
$ mycli recipe run close-user-tickets --dry-run

# Run it, overriding a variable
$ mycli recipe run close-user-tickets --var assignee=jdoe

# Or chain commands on the fly, without authoring a recipe — each step's
# output feeds the next. Add --save <name> to keep it as a reusable recipe.
$ mycli chain \
    'run: jira issue search "assignee = currentUser() AND statusCategory != Done" => r' \
    'log: found ${r.data.issues.length} open issue(s)'

# Share it
$ mycli recipe export close-user-tickets --output ./close-user-tickets.json
$ mycli recipe import ./close-user-tickets.json
```

## Commands

<!-- prettier-ignore -->
| Command | Description |
| - | - |
| `mycli recipe` | List saved recipes. |
| `mycli recipe create NAME` | Scaffold a new recipe. |
| `mycli recipe run RECIPE` | Run a recipe (by name or by file path). |
| `mycli chain STEPS...` | Chain commands on the fly (one step per arg), feeding each step's output into the next, without a recipe file. |
| `mycli recipe show RECIPE` | Print a recipe definition. |
| `mycli recipe validate RECIPE` | Check that a recipe is well-formed without running it. |
| `mycli recipe import PATH` | Import a recipe file into the store. |
| `mycli recipe export RECIPE` | Export a saved recipe to a file. |
| `mycli recipe remove RECIPE` | Delete a saved recipe. |

Saved recipes live as JSON files under the CLI data directory
(`<dataDir>/recipes/<name>.json`), so importing and exporting is just a file
copy. `recipe run` and the other read commands also accept a direct path to a
`.json` file, so you can run a recipe without saving it first.

## Chain commands on the fly

`chain` runs a chain without authoring a recipe file: **each positional
argument is one step**, and a step's output flows into the next. It's the quick,
interactive front end to the same engine `recipe run` uses, so capture,
interpolation, loops and conditions all work. Add `--save <name>` to turn the
chain you just assembled into a reusable recipe.

```
$ mycli chain \
    'run: jira issue search "assignee = currentUser() AND statusCategory != Done" => r' \
    'log: found ${r.data.issues.length} open issue(s)' \
    'forEach: ${r.data.issues} as issue' \
    'log: ${issue.key} — ${issue.fields.summary}'

$ mycli chain \
    'run: bb pr list my-workspace my-repo --state OPEN => r' \
    'forEach: ${r.data.values} as pr' \
    'log: #${pr.id} ${pr.title} (${pr.source.branch.name} → ${pr.destination.branch.name})'
```

> **Wrap each step in single quotes.** Steps contain `${...}` placeholders; inside
> double quotes your shell will try to expand them itself (zsh reports
> `bad substitution`). Single quotes pass them through untouched so `chain`
> can interpolate them.

Each step is `type: rest`, where the text before the first `:` picks the type:

<!-- prettier-ignore -->
| Step | Meaning |
| - | - |
| `exec: <shell command>` | Run a shell command. Uncaptured output is printed (like a terminal). |
| `run: <command-id> [args...]` | Run one of this CLI's own commands. |
| `set: <name> = <value>` | Set a variable (value is parsed as JSON when possible, else kept as string). |
| `log: <message>` | Print a message. |
| `forEach: ${items} [as <name>]` | Loop over an array (element bound to `<name>`, default `item`). |
| `repeat: <count> [as <name>]` | Repeat a fixed number of times. |
| `if: <condition>` … `else` | Branch. |

**Capture** a step's output into a variable with a trailing arrow, then reference
it with `${...}` in later steps:

- `=> name` captures stdout as a string (trailing newlines are stripped).
- `=>json name` parses stdout as JSON, so `${name.field}` and projections work.

A control step's **body** is the single step that follows it. To group several
steps, wrap them in a block by passing `{` and `}` as their own arguments:

```
$ mycli chain \
    'run: jira issue search "assignee = currentUser() AND statusCategory != Done" => r' \
    'forEach: ${r.data.issues} as issue' '{' \
      'run: jira issue transitions ${issue.key} => t' \
      'log: ${issue.key} has ${t.data.transitions.length} available transition(s)' \
    '}'
```

## Recipe format

```jsonc
{
  "name": "close-user-tickets", // required, unique, filesystem-safe
  "description": "Close a user's tickets", // optional
  "version": "1.0", // optional
  "vars": {"assignee": "jdoe"}, // optional default variables
  "steps": [
    /* ... */
  ], // required, runs in order
}
```

## Variables and interpolation

Anywhere a string is allowed you can embed `${...}` placeholders. The expression
inside is a JSON path resolved against the current variables:

<!-- prettier-ignore -->
| Expression                 | Result                                |
| -------------------------- | ------------------------------------- |
| `${assignee}`              | the value of `assignee`               |
| `${tickets.issues[0].key}` | first issue key                       |
| `${tickets.issues.length}` | number of issues                      |
| `${tickets.issues[*].key}` | array of every issue key (projection) |
| `${meta["full name"]}`     | a key that contains a space           |

When a string is exactly one `${...}` expression the raw value is kept (arrays,
numbers and objects survive). Otherwise the value is stringified in place.

Override any variable at run time with `--var key=value` (repeatable). Values
are parsed as JSON when possible, so `--var count=3` is the number `3` and
`--var 'tags=["a","b"]'` is an array.

## Step types

Each step is an object. Its type is determined by which key it uses.

**Run a command in this CLI** and capture what it returns:

```json
{"run": "plugins", "args": ["--json"], "capture": "installed"}
```

**Run a shell command** and capture its stdout (optionally parsed as JSON):

```json
{
  "exec": "mycli jira issue search \"assignee = currentUser() AND statusCategory != Done\" --max 20",
  "capture": "result",
  "json": true,
  "silent": true
}
```

**Set a variable** — the basic JSON operation:

```json
{"set": "count", "value": "${tickets.issues.length}"}
```

**Log a message:**

```json
{"log": "Closing ${ticket.key}"}
```

**Branch** with `if` / `then` / `else`:

```json
{
  "if": "${count} > 0",
  "then": [{"log": "There is work to do"}],
  "else": [{"log": "Nothing to do"}]
}
```

**Loop over an array** with `forEach`. The current element is bound to `as`
(default `item`) and its index to `<as>_index`:

```json
{
  "forEach": "${tickets.issues}",
  "as": "ticket",
  "steps": [{"run": "jira:issue:transition", "args": ["${ticket.key}", "${doneTransitionId}"]}]
}
```

**Repeat** a fixed number of times. The iteration index is bound to `as`
(default `i`):

```json
{"repeat": 3, "as": "attempt", "steps": [{"log": "Attempt ${attempt}"}]}
```

Any step (except a branch) may carry an `if` guard, so it only runs when the
condition is true:

```json
{
  "if": "${ticket.fields.status.name} != Done",
  "run": "jira:issue:transition",
  "args": ["${ticket.key}", "${doneTransitionId}"]
}
```

## Conditions

Condition expressions are used by `if` guards, `if/then/else` branches and loop
guards. They support:

- comparisons: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `matches`
- boolean logic: `&&` and `||` (evaluated left to right, no parentheses)
- negation: a leading `!`
- truthiness: a bare operand with no operator

Operands may be `${...}` expressions, quoted strings, numbers, `true`/`false`/
`null`, or bare words (treated as string literals).

```
${status} != Done
${tickets.issues.length} > 0
${labels} contains urgent
${name} matches ^ENG-
${done} && !${blocked}
```

## Worked examples

[`example/open-prs.json`](./example/open-prs.json) lists the open pull requests
in the current repo and prints a one-line summary of each. It only needs the
GitHub CLI (`gh auth login`), so you can run it as-is:

```sh-session
$ mycli recipe run ./example/open-prs.json
$ mycli recipe run ./example/open-prs.json --var limit=5
```

[`example/jira-my-open-issues.json`](./example/jira-my-open-issues.json) lists
your open Jira issues and prints a one-line summary of each. It uses the `jira`
plugin's JSON output and reads nested fields like `${result.data.issues[*].key}`.
Authenticate once with `mycli jira auth add`, then run it (override `--var jql=...`
to search anything else):

```sh-session
$ mycli recipe run ./example/jira-my-open-issues.json
$ mycli recipe run ./example/jira-my-open-issues.json --var max=5
```

The same thing as an on-the-fly chain, no file needed:

```sh-session
$ mycli chain \
    'run: jira issue search "assignee = currentUser() AND statusCategory != Done" --max 3 => r' \
    'log: you have ${r.data.issues.length} open issues' \
    'forEach: ${r.data.issues} as issue' \
    'log:  ${issue.key} — ${issue.fields.summary}'
```

[`example/close-user-tickets.json`](./example/close-user-tickets.json) searches
Jira (via the `jira` plugin) for a user's open tickets, then for each one looks up
its available transitions and applies the one named by `--var transition`. It
shows nested loops, captured JSON and a name match (`${t.name} == ${transition}`):

```sh-session
$ mycli recipe import ./example/close-user-tickets.json
$ mycli recipe run close-user-tickets --var project=SATHREE --var transition=Closed --dry-run
```

Drop the `--dry-run` flag to actually run the commands.
