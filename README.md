# recipe

Extensible CLI recipe for running configurable AI coding agents

[![Version](https://img.shields.io/npm/v/@hesed/recipe.svg)](https://npmjs.org/package/@hesed/recipe)
[![Downloads/week](https://img.shields.io/npm/dw/@hesed/recipe.svg)](https://npmjs.org/package/@hesed/recipe)

# Install

```bash
sdkck plugins install @hesed/recipe
```

<!-- toc -->
* [recipe](#recipe)
* [Install](#install)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @hesed/recipe
$ recipe COMMAND
running command...
$ recipe (--version)
@hesed/recipe/0.1.0 linux-x64 node-v22.23.0
$ recipe --help [COMMAND]
USAGE
  $ recipe COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`recipe recipe`](#recipe-recipe)
* [`recipe recipe create NAME`](#recipe-recipe-create-name)
* [`recipe recipe delete RECIPE`](#recipe-recipe-delete-recipe)
* [`recipe recipe export RECIPE`](#recipe-recipe-export-recipe)
* [`recipe recipe import PATH`](#recipe-recipe-import-path)
* [`recipe recipe remove RECIPE`](#recipe-recipe-remove-recipe)
* [`recipe recipe run RECIPE`](#recipe-recipe-run-recipe)
* [`recipe recipe show RECIPE`](#recipe-recipe-show-recipe)
* [`recipe recipe validate RECIPE`](#recipe-recipe-validate-recipe)

## `recipe recipe`

List saved recipes.

```
USAGE
  $ recipe recipe [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List saved recipes.

  List saved recipes.

EXAMPLES
  $ recipe recipe
```

_See code: [src/commands/recipe/index.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/index.ts)_

## `recipe recipe create NAME`

Scaffold a new recipe.

```
USAGE
  $ recipe recipe create NAME [--json] [-d <value>] [-f]

ARGUMENTS
  NAME  Name for the new recipe.

FLAGS
  -d, --description=<value>  Description for the recipe.
  -f, --force                Overwrite an existing recipe with the same name.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Scaffold a new recipe.

  Creates a starter recipe in the recipe store that you can edit and run.

EXAMPLES
  $ recipe recipe create close-user-tickets

  $ recipe recipe create close-user-tickets --description "Close all tickets for a user"
```

_See code: [src/commands/recipe/create.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/create.ts)_

## `recipe recipe delete RECIPE`

Remove a saved recipe.

```
USAGE
  $ recipe recipe delete RECIPE [--json]

ARGUMENTS
  RECIPE  Name of the saved recipe to remove.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Remove a saved recipe.

  Delete a recipe from the recipe store.

ALIASES
  $ recipe recipe delete

EXAMPLES
  $ recipe recipe delete close-user-tickets
```

## `recipe recipe export RECIPE`

Export a recipe to a file.

```
USAGE
  $ recipe recipe export RECIPE [--json] [-f] [-o <value>] [--stdout]

ARGUMENTS
  RECIPE  Name of the saved recipe to export.

FLAGS
  -f, --force           Overwrite the output file if it already exists.
  -o, --output=<value>  Output file path. Defaults to ./<name>.json.
      --stdout          Print the recipe to stdout instead of writing a file.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Export a recipe to a file.

  Write a saved recipe to a JSON file so it can be shared or version-controlled.

  With --stdout the recipe is printed instead of written to a file.

EXAMPLES
  $ recipe recipe export close-user-tickets

  $ recipe recipe export close-user-tickets --output ./shared/close-user-tickets.json

  $ recipe recipe export close-user-tickets --stdout
```

_See code: [src/commands/recipe/export.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/export.ts)_

## `recipe recipe import PATH`

Import a recipe from a file.

```
USAGE
  $ recipe recipe import PATH [--json] [-f] [--name <value>]

ARGUMENTS
  PATH  Path to a recipe JSON file to import.

FLAGS
  -f, --force         Overwrite an existing recipe with the same name.
      --name=<value>  Save the imported recipe under a different name.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Import a recipe from a file.

  Import a recipe from a JSON file into the recipe store so it can be run by name.

EXAMPLES
  $ recipe recipe import ./close-user-tickets.json

  $ recipe recipe import ./shared-recipe.json --name my-copy
```

_See code: [src/commands/recipe/import.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/import.ts)_

## `recipe recipe remove RECIPE`

Remove a saved recipe.

```
USAGE
  $ recipe recipe remove RECIPE [--json]

ARGUMENTS
  RECIPE  Name of the saved recipe to remove.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Remove a saved recipe.

  Delete a recipe from the recipe store.

ALIASES
  $ recipe recipe delete

EXAMPLES
  $ recipe recipe remove close-user-tickets
```

_See code: [src/commands/recipe/remove.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/remove.ts)_

## `recipe recipe run RECIPE`

Run a recipe: a sequence of commands chained with conditions, loops and JSON operations.

```
USAGE
  $ recipe recipe run RECIPE [--json] [--dry-run] [--var <value>...]

ARGUMENTS
  RECIPE  Name of a saved recipe, or a path to a recipe file.

FLAGS
  --dry-run         Print the commands that would run without executing them.
  --var=<value>...  Override a recipe variable (key=value). Repeatable. Values are parsed as JSON when possible.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Run a recipe: a sequence of commands chained with conditions, loops and JSON operations.

  Each step runs a command, with optional conditions, loops and JSON operations between them.

  Use --var to override the recipe's default variables, and --dry-run to preview the commands without running them.

EXAMPLES
  $ recipe recipe run close-user-tickets

  $ recipe recipe run close-user-tickets --var assignee=jdoe

  $ recipe recipe run ./my-recipe.json --dry-run
```

_See code: [src/commands/recipe/run.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/run.ts)_

## `recipe recipe show RECIPE`

Print a recipe definition.

```
USAGE
  $ recipe recipe show RECIPE [--json]

ARGUMENTS
  RECIPE  Name of a saved recipe, or a path to a recipe file.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Print a recipe definition.

  Print the full definition of a recipe.

EXAMPLES
  $ recipe recipe show close-user-tickets
```

_See code: [src/commands/recipe/show.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/show.ts)_

## `recipe recipe validate RECIPE`

Validate a recipe.

```
USAGE
  $ recipe recipe validate RECIPE [--json]

ARGUMENTS
  RECIPE  Name of a saved recipe, or a path to a recipe file.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Validate a recipe.

  Check that a recipe is well-formed without running it.

EXAMPLES
  $ recipe recipe validate ./my-recipe.json
```

_See code: [src/commands/recipe/validate.ts](https://github.com/hesedcasa/recipe/blob/v0.1.0/src/commands/recipe/validate.ts)_
<!-- commandsstop -->
