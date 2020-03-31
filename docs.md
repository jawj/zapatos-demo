
# Zapatos: _Zero-Abstraction Postgres for TypeScript_


## What does it do?

[Postgres](https://www.postgresql.org/) and [TypeScript](https://www.typescriptlang.org/) are
independently awesome. Zapatos is a simple library that aims to make them awesome together. To achieve that, it does these five things:

**(1) Typescript schema** &nbsp; A command-line tool speaks to your Postgres database and writes up a TypeScript schema of detailed types for every table. This enables things 2 – 4. [Show me »](#thing1)

**(2) Arbitrary SQL** &nbsp; Simple building blocks help you write arbitrary SQL and manually apply the right types to what goes in and what comes back. [Show me »](#thing2)

**(3) Everyday CRUD** &nbsp; Shortcut functions produce your everyday [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) queries with no fuss and no surprises, fully and automatically typed. [Show me »](#thing3)

**(4) JOINs as nested JSON** &nbsp; Nested shortcut calls generate [LATERAL JOIN](https://www.postgresql.org/docs/12/queries-table-expressions.html#id-1.5.6.6.5.10.2) queries, resulting in arbitrarily complex nested JSON structures, still fully and automatically typed. [Show me »](#thing4)

**(5) Transactions** &nbsp; A transaction function helps with managing and retrying transactions. [Show me »](#thing5)


## Why does it do that?

In the first place, it's a stylised fact that [ORMs aren't very good with databases](https://en.wikipedia.org/wiki/Object-relational_impedance_mismatch). 

I understand Postgres and SQL, and I really like them. In my experience, abstractions that obscure how SQL works, or that prioritise ease of switching to another database tomorrow over effective use of _this_ database _today_, are a source of misery. I'm afraid I count Sequelize and TypeORM among these.

I'm also a total convert to TypeScript. VS Code's type checking and autocomplete speed development, prevent bugs, and simplify refactoring. Especially when they _just happen_, they bring joy.

Zapatos aims to minimise the misery of abstraction and intensify the joy of types. It's a credible alternative to ORMs.


## How does that look?

<a name="thing1"></a>

### **(1) Typescript schema** &nbsp; A command-line tool speaks to your Postgres database and writes up a TypeScript schema of detailed types for every table.

Take this ultra-simple SQL schema for a single table, `authors`:

```sql
CREATE TABLE "authors" 
( "id" SERIAL PRIMARY KEY
, "name" TEXT NOT NULL
, "isLiving" BOOLEAN );
```

We create a short config file, then run `npx zapatos` to generate a file named `zapatos/schema.ts`. It includes table definitions like this one:

```typescript
export namespace authors {
  export type Table = "authors";
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
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  /* ... */
}
```

The types are, I hope, pretty self-explanatory. `authors.Selectable` is what I'll get back from a `SELECT` query on this table. `authors.Insertable` is what I can `INSERT`: similar to the `Selectable`, but any fields that are `NULL`able and/or have `DEFAULT` values are allowed to be missing, `NULL` or `DEFAULT`. `authors.Updatable` is what I can `UPDATE` the table with: like what I can `INSERT`, but all columns are optional: it's a simple `Partial<authors.Insertable>`. `authors.Whereable`, finally, is what I can use in a `WHERE` condition 

`schema.ts` includes a few other types that get used internally, including some conditional type mappings, such as:

```typescript
export type SelectableForTable<T extends Table> = 
  T extends authors.Table ? authors.Selectable :
  T extends books.Table ? books.Selectable :
  T extends tags.Table ? tags.Selectable :
  Selectable;  // (the union of the per-table Selectables)
```

[Tell me more about the command line tool »](#detail1)

<a name="thing2"></a>

### **(2) Arbitrary SQL** &nbsp; Simple building blocks help you write arbitrary SQL and manually apply the right types to what goes in and what comes back.

Let's insert something into that `authors` table we just generated the types for. We'll write the SQL query ourselves, just to show that we can (we'll see an easier way [in the next section](thing3)):

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


<a name="thing3"></a>

### **(3) Everyday CRUD** &nbsp; Shortcut functions produce your everyday [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) queries with no fuss and no surprises, fully and automatically typed.

So — writing SQL with Zapatos is nicer than constructing a query and all its input and output types from scratch. But for a totally bog-standard CRUD query like the `INSERT` above, it still involves quite a lot of boilerplate.

To eliminate the boilerplate, Zapatos supplies some simple functions to generate these sorts of queries, fully and automatically typed.

Let's use one of them — `insert` — to add some more authors:

```typescript
import * as db from './zapatos/src';
import { pool } from './pgPool';

const [doug, janey] = await db.insert('authors', [
  { name: 'Douglas Adams', isLiving: false },
  { name: 'Jane Austen', isLiving: false},
]).run(pool);

console.log(doug.id, janey.id);
```

The `insert` shortcut accepts a single `Insertable` or an `Insertable[]` array, and correspondingly returns a `Selectable` or a `Selectable[]` array. Since we specified `'authors'` as the first argument, and an array as the second, they'll be checked and auto-completed as `authors.Insertable[]` and `authors.Selectable[]`.  

_Again, that code is in a Monaco (VS Code) editor, so you can play around and check those typings._ 

In addition to `insert`, there are shortcuts for `select`, `selectOne` and `count`, and for `update`, `upsert`, `delete` and `truncate`. 

[Tell me more about the shortcut functions »](#detail2)

<a name="thing4"></a>

### **(4) JOINs as nested JSON** &nbsp; Nested shortcut calls generate [LATERAL JOIN](https://www.postgresql.org/docs/12/queries-table-expressions.html#id-1.5.6.6.5.10.2) queries, resulting in arbitrarily complex nested JSON structures, still fully and automatically typed.

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

Now, let's say I want to show a list of books, each with its (one) author and (many) associated tags. I could knock up a manual query for this, but it gets quite hairy, and the `select` shortcut has an option called `lateral` that can do most of it for us. 

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

We can of course extend this to deeper nesting (e.g. query each author, with their books, with their tags); to self-joins (of a table with itself, e.g. employees to their managers); and to joins on relationships beyond foreign keys (e.g. joining the nearest _N_ somethings using the PostGIS `<->` distance operator).

[Tell me more about nested select queries »](#detail2)





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

## How do I use it?

