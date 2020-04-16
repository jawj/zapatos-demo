
# Zapatos: _Zero-Abstraction Postgres for TypeScript_

## What does it do?

[Postgres](https://www.postgresql.org/) and [TypeScript](https://www.typescriptlang.org/) are independently awesome. Zapatos is a library that aims to make them awesome together. 

To achieve that, it does these five things:

* **Typescript schema** &nbsp; A command-line tool speaks to your Postgres database and writes up a TypeScript schema of detailed types for every table. This enables the following three things. [Show me »](#typescript-schema)

* **Arbitrary SQL** &nbsp; Simple building blocks help you write arbitrary SQL and manually apply the right types to what goes in and what comes back. [Show me »](#arbitrary-sql)

* **Everyday CRUD** &nbsp; Shortcut functions produce your everyday [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) queries with no fuss and no surprises, fully and automatically typed. [Show me »](#everyday-crud)

* **JOINs as nested JSON** &nbsp; Nested shortcut calls generate [LATERAL JOIN](https://www.postgresql.org/docs/12/queries-table-expressions.html#id-1.5.6.6.5.10.2) queries, resulting in arbitrarily complex nested JSON structures, still fully and automatically typed. [Show me »](#joins-as-nested-json)

* **Transactions** &nbsp; A transaction function helps with managing and retrying transactions. [Show me »](#transaction)


### Why does it do that?

It is a truth universally acknowledged that [ORMs aren't very good](https://en.wikipedia.org/wiki/Object-relational_impedance_mismatch). 

I like SQL, and Postgres especially. In my experience, abstractions that obscure how SQL works, or that prioritise ease of switching to another database tomorrow over effective use of _this_ database _today_, are a source of misery.

I've also come to love strongly typed languages, and TypeScript in particular. VS Code's type checking and autocomplete speed development, prevent bugs, and simplify refactoring. Especially when they _just happen_, they bring joy.

Zapatos aims to minimise the misery of abstraction, intensify the joy of type inference, and represent a credible alternative to traditional ORMs.


### What doesn't it do?

Zapatos doesn't handle schema migrations. Other tools can help you with this:  check out [dbmate](https://github.com/amacneil/dbmate), for instance.

It also won't tell you how to structure your code. Zapatos doesn't deal in the 'model' classes beloved of traditional ORMs, just (fully-typed) [Plain Old JavaScript Objects](https://twitter.com/_ericelliott/status/831965087749533698?lang=en).


### How does that look?

#### Typescript schema

**A command-line tool speaks to your Postgres database and writes up a TypeScript schema of detailed types for every table.**

Take this ultra-simple SQL schema for a single table, `authors`:

```sql
CREATE TABLE "authors" 
( "id" SERIAL PRIMARY KEY
, "name" TEXT NOT NULL
, "isLiving" BOOLEAN );
```

We run `npx zapatos` to generate a file named `schema.ts`, including table definitions like this one:

```typescript
export namespace authors {
  /* ... */
  export interface Selectable {
    id: number;
    name: string;
    isLiving: boolean | null;
  };
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    name: string | SQLFragment;
    isLiving?: boolean | null | DefaultType | SQLFragment;
  };
  export interface Updatable extends Partial<Insertable> { };
  export type Whereable = { [K in keyof Insertable]?: 
    Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  /* ... */
}
```

The types are, I hope, pretty self-explanatory. `authors.Selectable` is what I'll get back from a `SELECT` query on this table. `authors.Insertable` is what I can `INSERT`: similar to the `Selectable`, but any fields that are `NULL`able and/or have `DEFAULT` values are allowed to be missing, `NULL` or `DEFAULT`. `authors.Updatable` is what I can `UPDATE` the table with: like what I can `INSERT`, but all columns are optional: it's a simple `Partial<authors.Insertable>`. `authors.Whereable`, finally, is what I can use in a `WHERE` condition 

`schema.ts` includes a few other types that get used internally, including some handy type mappings, like this one:

```typescript
export type SelectableForTable<T extends Table> = {
  authors: authors.Selectable,
  books: books.Selectable,
  tags: tags.Selectable,
  /* ... */
}[T];
```

[Tell me more about the command line tool »](#detail1)

#### Arbitrary SQL

**Simple building blocks help you write arbitrary SQL and manually apply the right types to what goes in and what comes back.**

Let's insert something into that `authors` table for which we just generated the types. We'll write the SQL query ourselves, to show that we can (we'll see an easier way [in the next section](#everyday-crud)):

```typescript
import * as db from './zapatos/src';
import * as s from './zapatos/schema';
import { pool } from './pgPool';

const
  author: s.authors.Insertable = {
    name: 'Gabriel Garcia Marquez',
    isLiving: false,
  },
  [insertedAuthor] = await db.sql<s.authors.SQL, s.authors.Selectable[]>`
      INSERT INTO ${"authors"} (${db.cols(author)})
      VALUES(${db.vals(author)}) RETURNING *`
    .run(pool);

console.log(insertedAuthor.id);
```

We've applied the appropriate type to the object we're trying to insert (`s.authors.Insertable`), giving us type-checking and autocompletion on that object. And we've specified both which types are allowed as interpolated values in the template string (`s.authors.SQL`) and what type is going to be returned (`s.authors.Selectable[]`) when the query runs.

_The above code snippet is an embedded Monaco (VS Code) editor, so you can check those typings for yourself._ 

[Tell me more about writing arbitrary SQL »](#detail2)


#### Everyday CRUD

**Shortcut functions produce your everyday [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) queries with no fuss and no surprises, fully and automatically typed.**

So — writing SQL with Zapatos is nicer than constructing a query and all its input and output types from scratch. But for a totally bog-standard CRUD query like the `INSERT` above, it still involves quite a lot of boilerplate.

To eliminate the boilerplate, Zapatos supplies some simple functions to generate these sorts of queries, fully and automatically typed.

Let's use one of them — `insert` — to add two more authors:

```typescript
import * as db from './zapatos/src';
import { pool } from './pgPool';

const [doug, janey] = await db.insert('authors', [
  { name: 'Douglas Adams', isLiving: false },
  { name: 'Jane Austen', isLiving: false},
]).run(pool);

console.log(doug.id, janey.id);
```

The `insert` shortcut accepts a single `Insertable` or an `Insertable[]` array, and correspondingly returns a `Selectable` or a `Selectable[]` array. Since we specified `'authors'` as the first argument, and an array as the second, input and output will be checked and auto-completed as `authors.Insertable[]` and `authors.Selectable[]` respectively.

_Again, that code is in a Monaco (VS Code) editor, so you can play around with it and check those typings._ 

In addition to `insert`, there are shortcuts for `select`, `selectOne` and `count`, and for `update`, `upsert`, `delete` and `truncate`. 

[Tell me more about the shortcut functions »](#detail2)


#### JOINs as nested JSON

**Nested shortcut calls generate [LATERAL JOIN](https://www.postgresql.org/docs/12/queries-table-expressions.html#id-1.5.6.6.5.10.2) queries, resulting in arbitrarily complex nested JSON structures, still fully and automatically typed.**

CRUD is our bread and butter, but the power of SQL is that it's _relational_ — it's in the `JOIN`s. And Postgres has some powerful JSON features that can deliver us sensibly-structured `JOIN` results without any post-processing (that's `json_agg`, `json_build_object`, and so on).

To demonstrate, let's say that `authors` have `books` and `books` have `tags`, adding two new tables to our simple schema:

```sql
CREATE TABLE "books" 
( "id" SERIAL PRIMARY KEY
, "authorId" INTEGER NOT NULL REFERENCES "authors"("id")
, "title" TEXT
, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now() );

CREATE TABLE "tags"
( "tag" TEXT NOT NULL
, "bookId" INTEGER NOT NULL REFERENCES "books"("id") );

CREATE UNIQUE INDEX "tagsUniqueIdx" ON "tags"("tag", "bookId");
```

Now, let's say I want to show a list of books, each with its (one) author and (many) associated tags. We could knock up a manual query for this, of course, but it gets quite hairy. The `select` shortcut has an option called `lateral` that can nest other `select` queries and do it for us. 

Let's try it:

```typescript
import * as db from './zapatos/src';
import { pool } from './pgPool';

const bookAuthorTags = await db.select('books', db.all, {
  lateral: {
    author: db.selectOne('authors', { id: db.parent('authorId') }),
    tags: db.select('tags', { bookId: db.parent('id') }),
  }
}).run(pool);

bookAuthorTags.map(b => 
  `${b.author.name}: ${b.title} (${b.tags.map(t => t.tag).join(', ')})`);
```

This generates an efficient three-table `LATERAL JOIN` that returns a nested JSON structure directly from the database. Every nested element is again fully and automatically typed.

_Once again, the code above is in a Monaco (VS Code) editor, so you can play with it and and check that._ 

We can of course extend this to deeper nesting (e.g. query each author, with their books, with their tags); to self-joins (of a table with itself, e.g. employees to their managers in the same `employees` table); and to joins on relationships other than foreign keys (e.g. joining the nearest _N_ somethings using the PostGIS `<->` distance operator).

[Tell me more about nested select queries »](#detail2)


#### Transactions

...


## How do I use it?

Zapatos provides a command line tool, which is run like so:
    
    npx zapatos

This generates the TypeScript schema for your database in a folder named `zapatos/schema.ts`, and copies (or symlinks) the Zapatos source files into `zapatos/src`. 

**You *must* import the Zapatos source files from this copied/symlinked `zapatos/src` directory, *not* `from 'zapatos'` in the usual way (which would find them in `node_modules`).**

That's because the source files depend on themselves importing your custom-generated `schema.ts`, which they cannot do if they're imported in the usual way.

Of course, before you can run `npx zapatos`, you need to install and configure it.

### Installation

Install it with `npm`:

    npm install --save-dev zapatos

If you are copying the source files, which is the recommended default, you can make the library a `devDependency` with `--save-dev` (conversely, if you are symlinking them, which is not recommended, you will need the library as a standard `dependency` with plain old `--save`).

### Configuration

Add a top-level file `zapatosconfig.json` to your project. Here's an example:

```json
{
  "db": {
    "connectionString": "postgresql://localhost/example_db"
  },
  "outDir": "./src",
  "schemas": {
    "public": {
      "include": "*",
      "exclude": ["excluded_table_1", "excluded_table_2"]
    }
  }
}
```

This file has up to four top-level keys:

* `"db"` gives Postgres connection details. You can provide [anything that you'd pass](https://node-postgres.com/features/connecting#Programmatic) to `new pg.Pool(/* ... */)` here. This key is required.

* `"outDir"` defines where your `zapatos` folder will be created, relative to the project root. If not specified, it defaults to the project root, i.e. `"."`.

* `"srcMode"` can take the values `"copy"` (the default) or `"symlink"`, determining whether `zapatos/src` will be a copy of the folder `node_modules/zapatos/src` or just a symlink to it. The symlink option can cause enormous headaches with tools like `ts-node` and `ts-jest`, which refuse to compile anything inside `node_modules`, and is not recommended.

* `"schemas"` is an object that lets you define schemas and tables to include and exclude. Each key is a schema name, and each value is an object with keys `"include"` and `"exclude"`. Those keys can take the values `"*"` (for all tables in schema) or an array of table names. The `"exclude"` list takes precedence over the `"include"` list.

  Note that schemas are not fully supported by Zapatos, since they are not included in the output types, but they will work by using Postgres's search path if none of your table names is duplicated across different schemas.

  If not specified, the default value for `"schemas"` includes all tables in the `public` schema, i.e.:

  ```json
  "schemas": {
    "public": {
      "include": "*",
      "exclude: []
    }
  }
  ```

  One more example: if you use PostGIS, you'll likely want to exclude its system tables:

  ```json
  "schemas": {
    "public": {
      "include": "*",
      "exclude": [
        "geography_columns", 
        "geometry_columns", 
        "raster_columns", 
        "raster_overviews", 
        "spatial_ref_sys"
      ]
    }
  }
  ```

#### Environment variables

All values in `zapatosconfig.json` can have environment variables (`process.env.SOMETHING`) interpolated via [handlebars](https://handlebarsjs.com/)-style doubly-curly-brackets `{{variables}}`. 

This is likely most useful for the database connection details. For example, on Heroku you'd probably configure your database as:

```json
"db": {
  "connectionString": "{{DATABASE_URL}}"
}
```

## Full documentation

### `sql` template strings and their interpolation types

#### `String`s

#### `Array`s

#### `sql` template strings (`SQLFragment`)

#### `cols` (`ColumnNames`) and `vals` (`ColumnValues`)

#### `Whereable`

#### `self`

#### `param` (`Parameter`)

#### `default`

#### `parent('columnName')` (`ParentColumn`)


### Shortcut functions and lateral joins

#### insert

#### update

#### upsert

#### delete

#### truncate

#### select

#### selectOne

#### count


### Transactions


## Licence


<!--
What's happening here? First, we've applied the appropriate type to the object we're trying to insert: namely, `s.authors.Insertable`. This will give us type-checking and autocompletion on that object. 

Then we've used our [tagged template function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), `db.sql`, to put together the query. We've specified both which types are allowed as interpolated values in the template string (`s.authors.SQL`) and what type is going to be returned (`s.authors.Selectable[]`) when the query runs.

Within the query, we've interpolated the table name, `${"authors"}`. Only the `authors` table and its column names are allowed as interpolated strings with `s.authors.SQL` specified, so it's hard to get that wrong. And we've used two helper functions, `db.cols` and `db.vals`, which split our `Insertable` into matching-ordered column names and (`$1`, `$2`, ... parameterized) values.

Finally, we've run the query using a specific `pg` client or pool, and accessed the newly inserted record's serial `id` value.
-->
<!--
Let's try one more raw SQL query, and search for the record we just inserted:

```typescript
import * as db from './zapatos/src';
import * as s from './zapatos/schema';
import { pool } from './pgPool';

const 
  searchPattern = '%marquez%',  // could be untrusted 
  [firstFoundAuthor] = await db.sql<s.authors.SQL, s.authors.Selectable[]>`
    SELECT * FROM ${"authors"} WHERE ${{
      isLiving: false,
      name: db.sql<db.SQL>`${db.self} ILIKE ${db.param(searchPattern)}`,
    }}`
  .run(pool);

console.log(firstFoundAuthor?.name);
```

Much of this is familiar. What's new is the object we've interpolated in our `WHERE` clause, an `s.authors.Wherable` that compiles to the conjunction of the given conditions. 

You'll notice that a `Whereable` can take either primitive values, which are simply tested for equality, or a `SQLFragment` (the return type of `db.sql`), in which case we can do whatever we want, using the symbol `db.self` to refer to the keyed column name.
-->

