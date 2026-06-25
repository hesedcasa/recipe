# Recipes

A **recipe** chains multiple CLI commands together to accomplish a task — for
example, "set every Jira ticket assigned to a user to Done". Recipes support
basic conditions, loops and JSON operations, use a small easy-to-read JSON
syntax, and can be imported and exported as plain files.

- [Quick start](#quick-start)
- [Commands](#commands)
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

# Share it
$ mycli recipe export close-user-tickets --output ./close-user-tickets.json
$ mycli recipe import ./close-user-tickets.json
```

## Commands

| Command                        | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `mycli recipe`                 | List saved recipes.                                    |
| `mycli recipe create NAME`     | Scaffold a new recipe.                                 |
| `mycli recipe run RECIPE`      | Run a recipe (by name or by file path).                |
| `mycli recipe show RECIPE`     | Print a recipe definition.                             |
| `mycli recipe validate RECIPE` | Check that a recipe is well-formed without running it. |
| `mycli recipe import PATH`     | Import a recipe file into the store.                   |
| `mycli recipe export RECIPE`   | Export a saved recipe to a file.                       |
| `mycli recipe remove RECIPE`   | Delete a saved recipe.                                 |

Saved recipes live as JSON files under the CLI data directory
(`<dataDir>/recipes/<name>.json`), so importing and exporting is just a file
copy. `recipe run` and the other read commands also accept a direct path to a
`.json` file, so you can run a recipe without saving it first.

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
{"exec": "gh pr list --json number", "capture": "prs", "json": true, "silent": true}
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
  "steps": [{"run": "jira:transition", "args": ["${ticket.key}", "Done"]}]
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
{"if": "${ticket.fields.status.name} != Done", "run": "jira:transition", "args": ["${ticket.key}", "Done"]}
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

## Worked example: close a user's tickets

See [`examples/recipes/close-user-tickets.json`](../examples/recipes/close-user-tickets.json).
It searches Jira for a user's open tickets, then loops over the results and
moves any ticket that is not already Done:

```sh-session
$ mycli recipe import ./examples/recipes/close-user-tickets.json
$ mycli recipe run close-user-tickets --var assignee=jdoe --var project=ENG --dry-run
```

Drop the `--dry-run` flag to actually run the commands.
