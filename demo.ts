#!/usr/bin/env ts-node --files

import * as pg from 'pg';
import * as debug from 'debug';
import * as db from 'zapatos/db';
import { conditions as dc } from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type * as c from 'zapatos/custom';


const
  queryDebug = debug('db:query'),
  resultDebug = debug('db:result'),
  txnDebug = debug('db:transaction'),
  strFromTxnId = (txnId: number | undefined) => txnId === undefined ? '-' : String(txnId);

db.setConfig({
  queryListener: (query, txnId) =>
    queryDebug(`(%s) %s\n%o`, strFromTxnId(txnId), query.text, query.values),
  resultListener: (result, txnId, elapsedMs) =>
    resultDebug(`(%s, %dms) %O`, strFromTxnId(txnId), elapsedMs?.toFixed(1), result),
  transactionListener: (message, txnId) =>
    txnDebug(`(%s) %s`, strFromTxnId(txnId), message),
});

db.setConfig({
  castArrayParamsToJson: true,
  castObjectParamsToJson: true,
});

const pool = new pg.Pool({ connectionString: 'postgresql://localhost:5434/zapatos_demo' });

(async () => {
  await (async () => {

    // setup (uses shortcut functions)
    const allTables: s.AllTables = ["appleTransactions", "authors", "bankAccounts", "books", "chat", "customTypes", "dimensions", "emailAuthentication", "employees", "files", "identityTest", "images", "int8test", "numeric_test", "orderProducts", "orders", "photos", "products", "stores", "subjectPhotos", "subjects", "tableInOtherSchema", "tags"];
    await db.truncate(allTables, "CASCADE").run(pool);

    const insertedIdentityTest = await db.insert("identityTest", { data: 'Xyz' }).run(pool);

    console.log(insertedIdentityTest);

    const insertedAuthors = await db.insert("authors", [
      {
        id: 1,
        name: "Jane Austen",
        isLiving: false,
      }, {
        id: 123,
        name: "Gabriel Garcia Marquez",
        isLiving: false,
      }, {
        id: 456,
        name: "Douglas Adams",
        isLiving: false,
      }
    ]).run(pool);

    console.log(insertedAuthors);

    const insertedBooks = await db.insert("books", [
      {
        authorId: 1,
        title: "Pride and Prejudice",
      }, {
        authorId: 123,
        title: "Love in the Time of Cholera",
      }
    ]).run(pool);

    console.log(insertedBooks);

    const insertedTags = await db.insert("tags", [
      { tag: "Romance", bookId: insertedBooks[0].id },
      { tag: "19th century", bookId: insertedBooks[0].id },
      { tag: "Lovesickness", bookId: insertedBooks[1].id },
      { tag: "1980s", bookId: insertedBooks[1].id },
    ]).run(pool);

    console.log(insertedTags);
  })();

  await (async () => {
    console.log('\n=== Simple manual SELECT ===\n');

    const
      authorId = 1,
      query = db.sql<s.books.SQL>`
        SELECT * FROM ${"books"} WHERE ${{ authorId }}`,
      existingBooks: s.books.Selectable[] = await query.run(pool);

    console.log(existingBooks);
  })();

  await (async () => {
    console.log('\n=== SELECT with a SQLFragment in a Whereable ===\n');

    const
      authorId = 1,
      days = 7,
      query = db.sql<s.books.SQL>`
        SELECT * FROM ${"books"} 
        WHERE ${{
          authorId,
          createdAt: db.sql<s.books.SQL>`
            ${db.self} > now() - ${db.param(days)} * INTERVAL '1 DAY'`,
        }}`,
      existingBooks: s.books.Selectable[] = await query.run(pool);

    console.log(existingBooks);
  })();

  await (async () => {
    console.log('\n=== Simple manual INSERT ===\n');

    const
      newBook: s.books.Insertable = {
        authorId: 123,
        title: "One Hundred Years of Solitude",
      },
      query = db.sql<s.books.SQL>`
        INSERT INTO ${"books"} (${db.cols(newBook)})
        VALUES (${db.vals(newBook)})`,
      insertedBooks: s.books.Selectable[] = await query.run(pool);

    console.log(insertedBooks);
  })();

  await (async () => {
    console.log('\n=== Many-to-one join (each book with its one author) ===\n');

    type bookAuthorSQL = s.books.SQL | s.authors.SQL | "author";
    type bookAuthorSelectable = s.books.Selectable & { author: s.authors.Selectable };

    const
      query = db.sql<bookAuthorSQL>`
        SELECT ${"books"}.*, to_jsonb(${"authors"}.*) as ${"author"}
        FROM ${"books"} JOIN ${"authors"} 
          ON ${"books"}.${"authorId"} = ${"authors"}.${"id"}`,
      bookAuthors: bookAuthorSelectable[] = await query.run(pool);

    console.log(bookAuthors);
  })();

  await (async () => {
    console.log('\n=== One-to-many join (each author with their many books) ===\n');

    // selecting all fields is, logically enough, permitted when grouping by primary key;
    // see: https://www.postgresql.org/docs/current/sql-select.html#SQL-GROUPBY and
    // https://dba.stackexchange.com/questions/158015/why-can-i-select-all-fields-when-grouping-by-primary-key-but-not-when-grouping-b

    type authorBooksSQL = s.authors.SQL | s.books.SQL;
    type authorBooksSelectable = s.authors.Selectable & { books: s.books.Selectable[] };

    const
      query = db.sql<authorBooksSQL>`
        SELECT ${"authors"}.*, coalesce(json_agg(${"books"}.*) filter (where ${"books"}.* is not null), '[]') AS ${"books"}
        FROM ${"authors"} LEFT JOIN ${"books"} 
          ON ${"authors"}.${"id"} = ${"books"}.${"authorId"}
        GROUP BY ${"authors"}.${"id"}`,
      authorBooks: authorBooksSelectable[] = await query.run(pool);

    console.dir(authorBooks, { depth: null });
  })();

  await (async () => {
    console.log('\n=== Alternative one-to-many join (using LATERAL) ===\n');

    type authorBooksSQL = s.authors.SQL | s.books.SQL;
    type authorBooksSelectable = s.authors.Selectable & { books: s.books.Selectable[] };

    // note: for consistency, and to keep JSON ops in the DB, we could instead write:
    // SELECT coalesce(jsonb_agg(to_jsonb("authors".*) || to_jsonb(bq.*)), '[]') FROM ...

    const
      query = db.sql<authorBooksSQL>`
        SELECT ${"authors"}.*, bq.* 
        FROM ${"authors"} CROSS JOIN LATERAL (
          SELECT coalesce(json_agg(${"books"}.*), '[]') AS ${"books"}
          FROM ${"books"}
          WHERE ${"books"}.${"authorId"} = ${"authors"}.${"id"}
        ) bq`,
      authorBooks: authorBooksSelectable[] = await query.run(pool);

    console.dir(authorBooks, { depth: null });
  })();

  await (async () => {
    console.log('\n=== Multi-level one-to-many join (using LATERAL) ===\n');

    type authorBookTagsSQL = s.authors.SQL | s.books.SQL | s.tags.SQL;
    type authorBookTagsSelectable = s.authors.Selectable & {
      books: (s.books.Selectable & { tags: s.tags.Selectable['tag'] })[]
    };

    const
      query = db.sql<authorBookTagsSQL>`
        SELECT ${"authors"}.*, bq.*
        FROM ${"authors"} CROSS JOIN LATERAL (
          SELECT coalesce(jsonb_agg(to_jsonb(${"books"}.*) || to_jsonb(tq.*)), '[]') AS ${"books"}
          FROM ${"books"} CROSS JOIN LATERAL (
            SELECT coalesce(jsonb_agg(${"tags"}.${"tag"}), '[]') AS ${"tags"} 
            FROM ${"tags"}
            WHERE ${"tags"}.${"bookId"} = ${"books"}.${"id"}
          ) tq
          WHERE ${"books"}.${"authorId"} = ${"authors"}.${"id"}
        ) bq`,
      authorBookTags: authorBookTagsSelectable[] = await query.run(pool);

    console.dir(authorBookTags, { depth: null });
  })();

  await (async () => {
    console.log('\n=== Querying a subset of fields ===\n');

    const bookCols = <const>['id', 'title'];
    type BookDatum = s.books.OnlyCols<typeof bookCols>;

    const
      query = db.sql<s.books.SQL>`SELECT ${db.cols(bookCols)} FROM ${"books"}`,
      bookData: BookDatum[] = await query.run(pool);

    console.log(bookData);
  })();

  await (async () => {
    console.log('\n=== Shortcut functions ===\n');

    const
      authorId = 123,
      existingBooks = await db.select("books", { authorId }).run(pool);

    console.log(existingBooks);

    const allBookTitles = await db.select("books", db.all, { columns: ['title'] }).run(pool);

    console.log(allBookTitles);

    const lastButOneBook = await db.selectOne("books", { authorId }, {
      order: [{ by: "createdAt", direction: "DESC" }], offset: 1
    }).run(pool);

    console.log(lastButOneBook);

    const numberOfBooks = await db.count("books", db.all).run(pool);

    console.log(numberOfBooks);

    const noBooksAtAll = await db.select("books", { authorId: -1 }).run(pool);
    console.log(noBooksAtAll);

    const noBookAtAll = await db.selectOne("books", { authorId: -1 }).run(pool);
    console.log(noBookAtAll);

    const zeroBookCount = await db.count("books", { authorId: -1 }).run(pool);
    console.log(zeroBookCount);

    const savedBooks = await db.insert("books",
      [{
        authorId: 123,
        title: "News of a Kidnapping",
      }, {
        authorId: 456,
        title: "Cheerio, and Thanks for All the Fish",
      }]
    ).run(pool);

    console.log(savedBooks);

    const
      fishBookId = savedBooks[1].id,
      properTitle = "So Long, and Thanks for All the Fish",

      [updatedBook] = await db.update("books",
        { title: properTitle },
        { id: fishBookId }
      ).run(pool);

    console.log(updatedBook);

    const deleted = await db.deletes('books', { id: fishBookId }).run(pool);
    console.log(deleted);
  })();

  await (async () => {
    console.log('\n=== Shortcut UPDATE with a SQLFragment in an Updatable ===\n');

    const
      email = "me@privacy.net",
      insertedEmail = await db.insert("emailAuthentication", { email }).run(pool),
      updatedEmail = await db.update("emailAuthentication", {
        consecutiveFailedLogins: db.sql`${db.self} + 1`,
        lastFailedLogin: db.sql`now()`,
      }, { email }).run(pool);

    console.log(insertedEmail, updatedEmail);
  })();

  await (async () => {
    console.log('\n=== Shortcut UPSERT ===\n');

    await db.insert("appleTransactions", {
      environment: 'PROD',
      originalTransactionId: '123456',
      accountId: 123,
      latestReceiptData: "5Ia+DmVgPHh8wigA",
    }).run(pool);

    const
      newTransactions: s.appleTransactions.Insertable[] = [{
        environment: 'PROD',
        originalTransactionId: '123456',
        accountId: 123,
        latestReceiptData: "TWFuIGlzIGRpc3Rp",
      }, {
        environment: 'PROD',
        originalTransactionId: '234567',
        accountId: 234,
        latestReceiptData: "bmd1aXNoZWQsIG5v",
      }],
      result = await db.upsert("appleTransactions", newTransactions,
        ["environment", "originalTransactionId"]).run(pool);

    console.log(result);
  })();

  await (async () => {
    console.log('\n=== Shortcut one-to-many join ===\n');

    const q = await db.select('authors', db.all, {
      lateral: { books: db.select('books', { authorId: db.parent('id') }) }
    });
    const r = await q.run(pool);
    console.dir(r, { depth: null });
  })();

  await (async () => {
    console.log('\n=== Shortcut one-to-one plus one-to-many join ===\n');

    const bookAuthorTags = await db.select('books', db.all, {
      lateral: {
        author: db.selectOne('authors', { id: db.parent('authorId') }),
        tags: db.select('tags', { bookId: db.parent('id') }),
      }
    }).run(pool);

    bookAuthorTags.map(b => b.author?.name);

    console.dir(bookAuthorTags, { depth: null });
  })();

  await (async () => {
    console.log('\n=== Shortcut multi-level one-to-many join ===\n');

    const authorsBooksTags = await db.select('authors', db.all, {
      lateral: {
        books: db.select('books', { authorId: db.parent<s.authors.Column>('id') }, {
          lateral: {
            tags: db.select('tags', { bookId: db.parent('id') })
          }
        })
      }
    }).run(pool);

    console.dir(authorsBooksTags, { depth: null });
    // authorsBooksTags.map(a => a.books.map(b => b.tags.map(t => t.tag)));
  })();

  await (async () => {
    console.log('\n=== Shortcut self-joins requiring aliases ===\n');

    const
      anna = await db.insert('employees', { name: 'Anna' }).run(pool),
      [beth, charlie] = await db.insert('employees', [
        { name: 'Beth', managerId: anna.id },
        { name: 'Charlie', managerId: anna.id },
      ]).run(pool),
      dougal = await db.insert('employees', { name: 'Dougal', managerId: beth.id }).run(pool);

    const people = await db.select('employees', db.all, {
      columns: ['name'],
      order: { by: 'name', direction: 'ASC' },
      lateral: {
        lineManager: db.selectOne('employees', { id: db.parent('managerId') },
          { alias: 'managers', columns: ['name'] }),
        directReports: db.count('employees', { managerId: db.parent('id') },
          { alias: 'reports' }),
      },
    }).run(pool);

    console.dir(people, { depth: null });
    void charlie, dougal;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== Shortcut joins beyond foreign keys ===\n');

    const OSGB36Point = (mEast: number, mNorth: number) =>
      db.sql`ST_SetSRID(ST_Point(${db.param(mEast)}, ${db.param(mNorth)}), 27700)`;

    const [brighton] = await db.insert('stores', [
      { name: 'Brighton', geom: OSGB36Point(530587, 104192) },
      { name: 'London', geom: OSGB36Point(534927, 179382) },
      { name: 'Edinburgh', geom: OSGB36Point(323427, 676132) },
      { name: 'Newcastle', geom: OSGB36Point(421427, 563132) },
      { name: 'Exeter', geom: OSGB36Point(288427, 92132) },
    ]).run(pool);

    const localStore = await db.selectOne('stores', { id: brighton.id }, {
      columns: ['name'],
      lateral: {
        alternatives: db.select('stores', db.sql<s.stores.SQL>`${"id"} <> ${db.parent("id")}`, {
          alias: 'nearby',
          order: { by: db.sql<s.stores.SQL>`${"geom"} <-> ${db.parent("geom")}`, direction: 'ASC' },
          limit: 3,
          extras: {
            distance: db.sql<s.stores.SQL, number>`ST_Distance(${"geom"}, ${db.parent("geom")})`
          },
        })
      }
    }).run(pool);

    console.log(localStore);
    console.log(localStore?.alternatives.map(s => [s.geom.type, s.distance]));
  })();


  await (async () => {
    console.log('\n=== Joins with nothing returned ===\n');

    const authorWithNoBooks = await db.selectOne('authors', db.all, {
      lateral: { bearBooks: db.select('books', { authorId: db.parent('id'), title: db.sql`${db.self} LIKE '%bear%'` }) }
    }).run(pool);

    console.log(authorWithNoBooks);

    const authorWithZeroCountBooks = await db.selectOne('authors', db.all, {
      lateral: { bearBooks: db.count('books', { authorId: db.parent('id'), title: db.sql`${db.self} LIKE '%bear%'` }) }
    }).run(pool);

    console.log(authorWithZeroCountBooks);

    const bookWithNoAuthor = await db.selectOne('books', db.all, { lateral: { author: db.selectOne('authors', { id: -1 }) } }).run(pool);

    console.log(bookWithNoAuthor);
  })();

  await (async () => {
    console.log('\n=== Date complications ===\n');

    const
      oneBooks: s.books.Selectable[] =
        await db.sql<s.books.SQL>`SELECT * FROM ${"books"} LIMIT 1`.run(pool),
      oneBook = oneBooks[0],
      someActualDate = oneBook.createdAt;

    console.log(someActualDate.constructor, someActualDate);

    const
      book = await db.selectOne('books', db.all, { columns: ['createdAt'] }).run(pool),
      someSoCalledDate = book!.createdAt,
      someConvertedDate = new Date(someSoCalledDate);

    console.log(someSoCalledDate.constructor, someSoCalledDate, someConvertedDate);

    // this fails to find anything, because JS date conversion truncates μs to ms
    const bookDatedByDate = await db.selectOne('books', { createdAt: someActualDate }).run(pool);
    console.log(bookDatedByDate);

    // therefore this also fails
    const bookDatedByConvertedDate = await db.selectOne('books', { createdAt: someConvertedDate }).run(pool);
    console.log(bookDatedByConvertedDate);

    // but this works
    const bookDatedByTruncDate = await db.selectOne('books', { createdAt: db.sql`date_trunc('milliseconds', ${db.self}) = ${db.param(someActualDate)}` }).run(pool);
    console.log(bookDatedByTruncDate);

    // and this also works, more sanely
    const bookDatedByString = await db.selectOne('books', { createdAt: someSoCalledDate }).run(pool);
    console.log(bookDatedByString);
  })();

  await (async () => {
    console.log('\n=== Transaction ===\n');
    const
      email = "me@privacy.net",
      result = await db.transaction(pool, db.IsolationLevel.Serializable, async txnClient => {

        const emailAuth = await db.selectOne("emailAuthentication", { email }).run(txnClient);

        console.log(emailAuth);

        // do stuff with email record -- e.g. check a password, handle successful login --
        // but remember everything non-DB-related in this function must be idempotent
        // since it might be called several times in case of serialization failures

        return db.update("emailAuthentication", {
          consecutiveFailedLogins: db.sql`${db.self} + 1`,
          lastFailedLogin: db.sql`now()`,
        }, { email }).run(txnClient);
      });

    console.log(result);
  })();

  await (async () => {
    console.log('\n=== FOR UPDATE etc ===\n');
    const
      baseQuery = db.selectOne("authors", { id: 123 }),
      lockingQuery = db.sql<db.SQL, ReturnType<typeof baseQuery.run>>`${baseQuery} FOR UPDATE`,
      result = await lockingQuery.run(pool);

    void result;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== IN queries with vals ===\n');
    const
      ids = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12],
      authors = await db.select("authors", { id: db.sql`${db.self} IN (${db.vals(ids)})` }).run(pool);

    void authors;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== SELECT locking clauses ===\n');
    const
      authors1 = await db.select("authors", db.all, { lock: { for: "NO KEY UPDATE" } }).run(pool),
      authors2 = await db.select("authors", db.all, { lock: { for: "UPDATE", of: "authors", wait: "NOWAIT" } }).run(pool),
      // this next one is senseless but produces valid SQL
      authors3 = await db.select("authors", db.all, {
        lock: [
          { for: "UPDATE", of: ["authors", "books"], wait: "SKIP LOCKED" },
          { for: "SHARE", of: "tags" },
        ],
      }).compile();

    console.log(authors3);
    void authors1, authors2;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== INSERT/UPSERT nothing ===\n');
    const
      nothing = await db.insert("authors", []).run(pool),
      forcedNothing = await db.insert("authors", []).run(pool, true),
      upsertNothing = await db.upsert("authors", [], "id").run(pool),
      forcedUpsertNothing = await db.upsert("authors", [], "id").run(pool, true);

    void nothing, forcedNothing, upsertNothing, forcedUpsertNothing;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== SELECT column shenanigans ===\n');
    const
      noCols = await db.select("authors", db.all, { columns: [] }).run(pool),
      noColsExtras = await db.select("authors", db.all, {
        columns: [],
        extras: { idPlusPlus: db.sql<db.SQL, number>`${"id"} + 1` },
      }).run(pool),
      noColsLateral = await db.select("authors", db.all, {
        columns: [],
        lateral: { books: db.select("books", { authorId: db.parent("id") }) },
      }).run(pool),
      noColsExtrasLateral = await db.select("authors", db.all, {
        columns: [],
        extras: { idPlusPlus: db.sql<db.SQL, number>`${"id"} + 1` },
        lateral: { books: db.select("books", { authorId: db.parent("id") }) },
      }).run(pool);

    void noCols, noColsExtras, noColsLateral, noColsExtrasLateral;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== geometry and CASTs ===\n');
    const
      pointLocation: c.PgGeometry = { type: 'Point', coordinates: [1, 2] },
      inserted = await db.insert("customTypes", {
        structuredDocument: [1, 2, 3],
        location: pointLocation,
        otherLocation: db.param({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }, true),
        bar: '12',
        numbers: db.param([1, 2, 3], false),
      }).run(pool);

    console.log(inserted.otherLocation?.type);
  })();

  await (async () => {
    console.log('\n=== aggregates in select/selectOne ===\n');

    const x = await db.selectOne('books', db.all, {
      columns: [],
      extras: { meanTitleChars: db.sql<s.books.SQL, number>`avg(char_length(${"title"}))` },
    }).run(pool);

    void x;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== DISTINCT ===\n');

    const
      x = await db.selectOne('books', db.all, { distinct: true }).run(pool),
      y = await db.selectOne('books', db.all, { distinct: "title" }).run(pool),
      z = await db.selectOne('books', db.all, { distinct: ["title", "createdAt"] }).run(pool),
      a = await db.selectOne('books', db.all, { distinct: db.sql`upper(${"title"})` }).run(pool);

    void x, y, z, a;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== GROUP BY and HAVING ===\n');

    const
      x = await db.select('books', db.all, {
        columns: ['authorId'],
        extras: {
          longestTitle: db.sql<s.books.SQL, number>`max(char_length(${"title"}))`
        },
        groupBy: 'authorId',
      }).run(pool),
      y = await db.select('books', db.all, {
        columns: [],
        extras: {
          shortestTitle: db.sql<s.books.SQL, number>`min(char_length(${"title"}))`
        },
        groupBy: ['authorId', 'title'],
        having: { authorId: 1 },
      }).run(pool),
      z = await db.select('books', db.all, {
        columns: [],
        extras: {
          shortestTitle: db.sql<s.books.SQL, number>`min(char_length(${"title"}))`
        },
        groupBy: db.sql`${"authorId"} + 1`,
        having: db.sql`true`,
      }).run(pool);

    void x, y, z;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== Conditions ===\n');

    const
      isIn = (a: any[]) => db.sql`${db.self} IN (${db.vals(a)})`,
      authorIds = [1, 2, db.sql`3`],
      books = await db.select('books', { authorId: isIn(authorIds) }).run(pool);

    const moreBooks = await db.select('books', {
      authorId: dc.or(dc.isNotIn(authorIds), dc.isIn(authorIds)),  // yeah, all of them!
      id: dc.and(dc.gt(0), dc.lte(1000)),
      title: dc.ne('x'),
      createdAt: dc.lt(db.sql`NOW()`),
      updatedAt: dc.isNotNull,
    }).run(pool);

    const yetMoreBooks = await db.select('books', {
      title: dc.ilike('One%')
    }).run(pool);

    const andYetMoreBooks = await db.select('books', {
      title: dc.isIn([])
    }).run(pool);

    await db.update('emailAuthentication', { consecutiveFailedLogins: dc.add(1) }, { email: 'me@privacy.net' }).run(pool);

    void books, moreBooks, yetMoreBooks, andYetMoreBooks;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== Composable transactions ===\n');

    const [accountA, accountB, accountC] = await db.insert('bankAccounts',
      [{ balance: 50 }, { balance: 50 }, { balance: 50 }]).run(pool);

    const transferMoney = (sendingAccountId: number, receivingAccountId: number, amount: number, txnClientOrPool: pg.Pool | db.TxnClientForSerializable) =>
      db.serializable(txnClientOrPool, txnClient => Promise.all([
        db.update('bankAccounts',
          { balance: db.sql`${db.self} - ${db.param(amount)}` },
          { id: sendingAccountId }).run(txnClient),
        db.update('bankAccounts',
          { balance: db.sql`${db.self} + ${db.param(amount)}` },
          { id: receivingAccountId }).run(txnClient),
      ]));

    try {
      await transferMoney(accountA.id, accountB.id, 60, pool);

    } catch (err) {
      console.log(err.message, '/', err.detail);
    }

    try {
      await db.serializable(pool, txnClient => Promise.all([
        transferMoney(accountA.id, accountB.id, 40, txnClient),
        transferMoney(accountA.id, accountC.id, 40, txnClient)
      ]));

    } catch (err) {
      console.log(err.message, '/', err.detail);
    }

  })();

  await (async () => {
    console.log('\n=== RETURNING options ===\n');

    const book = await db.insert('books',
      { authorId: 1, title: 'Something very, very long (Volume I)' },
    ).run(pool);

    const { id } = await db.insert('books',
      { authorId: 1, title: 'Something very, very long (Volume II)' },
      { returning: ['id'] }
    ).run(pool);

    const nothing = await db.insert('books',
      { authorId: 1, title: 'Something very, very long (Volume III)' },
      { returning: [] }
    ).run(pool);

    const upperTitle = await db.insert('books',
      { authorId: 1, title: 'something originally lowercase' },
      { returning: [], extras: { upperTitle: db.sql<s.books.SQL, string>`upper(${"title"})` } }
    ).run(pool);

    const lowerTitles = await db.insert('books', [
      { authorId: 1, title: 'Case' },
      { authorId: 1, title: 'Sensitive' },
    ], { returning: ['id'], extras: { lowerTitle: db.sql<s.books.SQL, string>`lower(${"title"})` } }
    ).run(pool);

    void book, id, nothing, upperTitle, lowerTitles;

    const
      newTransaction: s.appleTransactions.Insertable = {
        environment: 'PROD',
        originalTransactionId: '123456',
        accountId: 123,
        latestReceiptData: "TWFuIGlzIGRpc3Rp",
      },
      otherNewTransaction = { ...newTransaction, ...{ originalTransactionId: '789' } },
      emptyResults = await db.upsert("appleTransactions", [newTransaction, otherNewTransaction],
        ["environment", "originalTransactionId"], { returning: [] }).run(pool),
      extraResult = await db.upsert("appleTransactions", newTransaction,
        ["environment", "originalTransactionId"], { returning: [], extras: { accX10: db.sql`${"accountId"} * 10` } }).run(pool),
      minimalResult = await db.upsert("appleTransactions", newTransaction,
        db.constraint('appleTransPKey'), { returning: ['originalTransactionId'] }).run(pool),
      fullResult = await db.upsert("appleTransactions", newTransaction,
        ["environment", "originalTransactionId"]).run(pool);

    void emptyResults, extraResult, minimalResult, fullResult;

    const updatedBookIds = await db.update('books',
      { updatedAt: new Date() },
      { authorId: 1 },
      { returning: ['id'], extras: { one: db.sql`1` } }).run(pool);

    const noBookData = await db.update('books',
      { updatedAt: new Date() },
      { authorId: 1 },
      { returning: [] }).run(pool);

    const extraBookData = await db.update('books',
      { updatedAt: new Date() },
      { authorId: 1 },
      { extras: { upperTitle: db.sql<db.SQL, string>`upper(${"title"})` } }).run(pool);

    void updatedBookIds, noBookData, extraBookData;

    const deletedTrans = await db.deletes('appleTransactions', {
      originalTransactionId: minimalResult.originalTransactionId
    }, {
      returning: ['accountId'],
      extras: { halfAccountId: db.sql<db.SQL, Date>`${"accountId"} / 2` }
    }).run(pool);

    const nothingAndNoColumn = await db.deletes('appleTransactions',
      { originalTransactionId: minimalResult.originalTransactionId },
      { returning: [] }).run(pool);

    void deletedTrans[0], nothingAndNoColumn;
  })();

  await (async () => {
    console.log('\n=== WITH TIES (requires Postgres 13+) ===\n');

    const
      firstAuthorBooks = await db.select('books', db.all, {
        order: [{ by: 'authorId', direction: 'ASC' }],
        limit: 1,
        withTies: true,
      }).run(pool);

    void firstAuthorBooks;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== undefined in Whereables ===\n');

    await db.select('authors', {}).run(pool);  // {} is treated as TRUE
    await db.select('authors', { name: undefined }).run(pool);  // this would ideally be a type error

  })();

  await (async () => {
    console.log('\n=== Many-to-many join ===\n');

    const
      [fg, jos, epc] = await db.insert('products', [
        { productName: 'Flushed grollings' },
        { productName: 'Jigged olive-spantles' },
        { productName: 'Embarrassed parping couplets' },
      ]).run(pool),
      savedOrder = await db.insert('orders', { userEmail: 'stephen@privacy.net' }).run(pool);

    await db.insert('orderProducts', [
      { orderId: savedOrder.id, productId: fg.id },
      { orderId: savedOrder.id, productId: jos.id },
      { orderId: savedOrder.id, productId: epc.id },
    ]).run(pool);

    const order1 = await db.selectOne('orders', { id: savedOrder.id }, {
      lateral: {
        orderProducts: db.select('orderProducts', { orderId: db.parent('id') }, {
          lateral: {
            product: db.selectExactlyOne('products', { id: db.parent('productId') })
          }
        })
      }
    }).run(pool);

    if (order1) console.log(`For ${order1.userEmail}:\n${order1.orderProducts.map(op => `- ${op.product.productName}`).join('\n')}`);

    const order2 = await db.selectOne('orders', { id: savedOrder.id }, {
      lateral: {
        products: db.select('orderProducts', { orderId: db.parent('id') }, {
          lateral: db.selectExactlyOne('products', { id: db.parent('productId') })
        })
      }
    }).run(pool);

    void order2;
    if (order2) console.log(`For ${order2.userEmail}:\n${order2.products.map(op => `- ${op.productName}`).join('\n')}`);


    const
      [alice, bobby, cathy] = await db.insert('subjects', [
        { name: 'Alice' }, { name: 'Bobby' }, { name: 'Cathy' },
      ]).run(pool),
      [photo1, photo2, photo3] = await db.insert('photos', [
        { url: 'photo1.jpg' }, { url: 'photo2.jpg' }, { url: 'photo3.jpg' },
      ]).run(pool);

    await db.insert('subjectPhotos', [
      { subjectId: alice.subjectId, photoId: photo1.photoId },
      { subjectId: alice.subjectId, photoId: photo2.photoId },
      { subjectId: bobby.subjectId, photoId: photo2.photoId },
      { subjectId: cathy.subjectId, photoId: photo1.photoId },
      { subjectId: cathy.subjectId, photoId: photo3.photoId },
    ]).run(pool);

    const photos = await db.select('photos', db.all, {
      lateral: {
        subjects: db.select('subjectPhotos', { photoId: db.parent('photoId') }, {
          lateral: db.selectExactlyOne('subjects', { subjectId: db.parent('subjectId') })
        })
      }
    }).run(pool);

    void photos;

  })();

  await (async () => {
    console.log('\n=== triggers and generated ===\n');

    await db.insert('dimensions', { millimetres: 100 }).run(pool);

    await db.insert('dimensions', {
      millimetres: 100,
      // metres: 0.2,  // (wrong and) gets overridden by trigger -- now disallowed
    }).run(pool);

    await db.insert('dimensions', {
      millimetres: 100,
      default_id: 100,  // allowed
      // always_id: 100,  // not allowed, is now a type error
    }).run(pool);

    await db.insert('dimensions', {
      millimetres: 100,
      // inches: 1,  // (wrong and) not allowed, is now a type error
    }).run(pool);
  })();

  await (async () => {
    console.log('\n=== issue #59 ===\n');

    const
      then = new Date('1989-01-21'),
      now = new Date(),
      file = await db.insert('files', { created_at: then, updated_at: then, path: '/imgs/a.jpg' }).run(pool);

    await db.upsert('files',
      { id: file.id, path: '/otherimgs/a.jpg', created_at: now, updated_at: now },
      'id',
      { updateColumns: ['path', 'updated_at'] }
    ).run(pool);
  })();

  await (async () => {
    console.log('\n=== issue #62 ===\n');

    const
      now = new Date(),
      then = new Date(Date.now() + 3600000),
      files = await db.insert('files', [
        { created_at: now, updated_at: now, path: '/imgs/a.jpg' },
        { created_at: then, updated_at: then, path: '/imgs/b.jpg' },
      ]).run(pool),
      images = await db.insert('images', [
        { file_id: files[0].id, height: 100, width: 200 },
        { file_id: files[1].id, height: 200, width: 100 },
      ]).run(pool);

    const sortedImages = await db.select('images', db.all, {
      lateral: { file: db.selectExactlyOne('files', { id: db.parent('file_id') }) },
      order: { by: db.sql`result->'created_at'`, direction: 'ASC' }
    }).run(pool);

    const matchingImages = await db.select('images', db.sql`result->>'path' = ${db.param('/imgs/b.jpg')}`, {
      lateral: { file: db.selectExactlyOne('files', { id: db.parent('file_id') }) }
    }).run(pool)

    void images, sortedImages, matchingImages;
  })();

  await (async () => {
    console.log('\n=== PR #68 ===\n');

    const insresult = await db.insert('int8test', { num: 12 }).run(pool);
    console.log(typeof insresult.num, insresult.num);  // number 12

    const selresult = await db.selectOne('int8test', db.all).run(pool);
    console.log(typeof selresult!.num, selresult!.num);  // number 12

    const manresult = await db.sql<s.int8test.SQL, s.int8test.Selectable[]>`SELECT * FROM ${"int8test"}`.run(pool);
    console.log(typeof manresult[0].num, manresult[0].num);  // string 12

    const jsonresult = await db.sql<s.int8test.SQL, { result: s.int8test.JSONSelectable[] }[]>`SELECT jsonb_agg(i.*) AS result FROM ${"int8test"} i`.run(pool);
    console.log(typeof jsonresult[0].result[0].num, jsonresult[0].result[0].num); // number 12
  })();

  await (async () => {
    console.log('\n=== issue #71 ===\n');
    for (let i = 0; i < 2; i++) await db.upsert("chat", { telegram_chat_id: "test_id" }, db.constraint("chat_pkey")).run(pool);
    await db.upsert("chat", [{ telegram_chat_id: "test_id" }, { telegram_chat_id: "extra_id" }], db.constraint("chat_pkey")).run(pool)


    for (let i = 0; i < 2; i++) await db.upsert("chat", { telegram_chat_id: "test_id" }, "telegram_chat_id").run(pool);
    await db.upsert("chat", [{ telegram_chat_id: "test_id" }, { telegram_chat_id: "other_id" }], "telegram_chat_id").run(pool);

    for (let i = 0; i < 2; i++) await db.upsert("chat", { telegram_chat_id: "new_id", created: new Date() }, "telegram_chat_id").run(pool);
    await db.upsert("chat", [{ telegram_chat_id: "new_id", created: new Date() }, { telegram_chat_id: "other_id", created: new Date() }], "telegram_chat_id").run(pool);
  })();

  /*
  await (async () => {
    console.log('\n=== CTEs (WITH) ===\n');

    await db.sql`
      WITH "bookAuthors" as (
        SELECT ${"books"}.*, to_jsonb(${"authors"}.*) as ${"author"}
        FROM ${"books"} JOIN ${"authors"} 
        ON ${"books"}.${"authorId"} = ${"authors"}.${"id"}) SELECT 
    `.run(pool);

  })();
  */

  /*
  import * as zu from './zapatos/src/utils';
   
  // ...
   
  await (async () => {
    console.log('\n=== multiVals ===\n');
   
    // turns out it's hard to make this work well without recreating the whole insert shortcut
   
    const multiVals = (insertables: s.Insertable[]) =>
      zu.mapWithSeparator(
        zu.completeKeysWithDefault(insertables),
        db.sql`, `,
        v => db.sql`(${db.vals(v)})`,
      );
   
    const authorData: s.authors.Insertable[] = [
      { name: 'William Shakespeare' },
      { name: 'Christopher Marlowe', isLiving: false },
    ];
    await db.sql`
      INSERT INTO ${"authors"} (${db.cols(authorData)}) 
      VALUES ${multiVals(authorData)}`.run(pool);
   
  })();
  */

  await pool.end();
})();
