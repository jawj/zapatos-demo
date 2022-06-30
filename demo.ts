#!/usr/bin/env ts-node --files

import * as pg from 'pg';
import * as debug from 'debug';
import * as db from 'zapatos/db';
import { conditions as dc } from 'zapatos/db';
import * as s from 'zapatos/schema';
import type * as c from 'zapatos/custom';

import * as moment from 'moment';
import { DateTime } from 'luxon';
import { DateString, TimestampString, TimestampTzString } from 'zapatos/db';


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
  castArrayParamsToJson: true,
  castObjectParamsToJson: true,
});

const
  connectionString = process.env.DB_URL,
  pool = new pg.Pool({ connectionString });

(async () => {
  await (async () => {

    // setup (uses shortcut functions)
    const allTables: s.AllBaseTables = ["appleTransactions", "authors", "bankAccounts", "books", "bools", "chapters", "chat", "customTypes", "dimensions", "emailAuthentication", "employees", "files", "identityTest", "images", "int8test", "nameCounts", "numeric_test", "orderProducts", "orders", "paragraphs", "photos", "products", "stores", "stringreturning", "subjectPhotos", "subjects", "tableWithColumnWithSpaces", "tags", "extra.tableInOtherSchema", "UK.constituencies", "UK.mps", "US.districts", "US.representatives", "US.states"];
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

    const now = new Date('2021-05-25T23:25:12.987Z');
    console.log('toTimestampTzString:', db.toString(now, 'timestamptz'));
    console.log('toLocalTimestampString:', db.toString(now, 'timestamp:local'));
    console.log('toUTCTimestampString:', db.toString(now, 'timestamp:UTC'));
    console.log('toLocalDateString:', db.toString(now, 'date:local'));
    console.log('toUTCDateString:', db.toString(now, 'date:UTC'));

    const dateStr = '2020-01-01T12:00:01Z' as db.TimestampTzString;
    const dateStrOrNull = Math.random() < 0.5 ? dateStr : null;

    const d1: null = db.toDate(null);
    const d2: Date = db.toDate(dateStr);
    const d3: Date | null = db.toDate(dateStrOrNull);
    void d1, d2, d3;

    const ds1 = db.toString(d1, 'timestamptz');
    const ds2 = db.toString(d2, 'timestamptz');
    const ds3 = db.toString(d3, 'timestamptz');
    void ds1, ds2, ds3;

    const
      td1: null = db.toDate(null, 'local'),
      td2: Date = db.toDate('2012-10-09T03:34Z'),
      td3: Date = db.toDate('2012-10-09T03:34', 'local'),
      td4: Date = db.toDate('2012-10-09', 'UTC'),
      td5: Date | null = db.toDate(Math.random() < 0.5 ? null : '2012-10-09T03:34Z'),
      td6: Date | null = db.toDate(Math.random() < 0.5 ? null : '2012-10-09T03:34', 'local'),
      td7: Date | null = db.toDate(Math.random() < 0.5 ? null : '2012-10-09', 'UTC'),
      td8: Date | null = db.toDate(Math.random() < 0.5 ? null : Math.random() < 0.5 ? '2012-10-09' : '2012-10-09T03:34', 'UTC');

    void td1, td2, td3, td4, td5, td6, td7, td8;

    const
      d = new Date(),
      ts1: null = db.toString(null, 'timestamptz'),
      ts2: TimestampTzString = db.toString(d, 'timestamptz'),
      ts3: TimestampString = db.toString(d, 'timestamp:local'),
      ts4: DateString = db.toString(d, 'date:UTC'),
      ts5: TimestampTzString | null = db.toString(Math.random() < 0.5 ? null : d, 'timestamptz'),
      ts6: TimestampString | null = db.toString(Math.random() < 0.5 ? null : d, 'timestamp:UTC'),
      ts7: DateString | null = db.toString(Math.random() < 0.5 ? null : d, 'date:local');

    void ts1, ts2, ts3, ts4, ts5, ts6, ts7;

    // moment
    const toMoment = db.strict<db.TimestampTzString, moment.Moment>(moment);

    const m1: null = toMoment(null);
    const m2: moment.Moment = toMoment(dateStr);
    const m3: moment.Moment | null = toMoment(dateStrOrNull);
    void m1, m2, m3;

    // Luxon
    const toDateTime = db.strict<db.TimestampTzString, DateTime>(DateTime.fromISO);

    const dt1: null = toDateTime(null);
    const dt2: DateTime = toDateTime(dateStr);
    const dt3: DateTime | null = toDateTime(dateStrOrNull);
    void dt1, dt2, dt3;

    const toTimestampTzString = db.strict((d: DateTime | Date) =>
      d instanceof DateTime ? d.toISO() as db.DateString : db.toString(d, 'timestamptz'));

    const ds = toTimestampTzString(DateTime.fromISO('1900-01-10T14:45:56.789Z'));
    console.log('toDateString: DateTime', ds);

    const nulled = toTimestampTzString(null);
    console.log('toDateString: null', nulled);

    const dsOrNull = toTimestampTzString(Math.random() < 0.5 ? DateTime.fromISO('1900-01-10T14:45:56.789Z') : null);
    console.log('toDateString: DateString | null', dsOrNull);

    const
      oneBooks: s.books.Selectable[] =
        await db.sql<s.books.SQL>`SELECT * FROM ${"books"} LIMIT 1`.run(pool),
      oneBook = oneBooks[0],
      someActualDate = oneBook.createdAt;

    console.log(someActualDate.constructor, someActualDate);

    const
      book = await db.selectOne('books', db.all, { columns: ['createdAt'] }).run(pool),
      someSoCalledDate = book!.createdAt,
      someConvertedDate = db.toDate(someSoCalledDate),
      someConvertedDateTime = toDateTime(someSoCalledDate),
      someConvertedMoment = toMoment(someSoCalledDate);

    console.log(
      '\nconstructor:', someSoCalledDate.constructor,
      '\nDateString:', someSoCalledDate,
      '\nDate:', someConvertedDate,
      '\nDate via DateTime:', someConvertedDateTime.toJSDate(),
      '\nDate via Moment:', someConvertedMoment.toDate()
    );

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

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    const transferMoney = (sendingAccountId: number, receivingAccountId: number, amount: number, txnClientOrQueryable: db.Queryable | db.TxnClientForSerializable) =>
      db.serializable(txnClientOrQueryable, txnClient => Promise.all([
        db.update('bankAccounts',
          { balance: db.sql`${db.self} - ${db.param(amount)}` },
          { id: sendingAccountId }).run(txnClient),
        db.update('bankAccounts',
          { balance: db.sql`${db.self} + ${db.param(amount)}` },
          { id: receivingAccountId }).run(txnClient),
      ]));

    console.log('Transfer attempt 1');
    let caught1 = false;

    try {
      await transferMoney(accountA.id, accountB.id, 60, pool);

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught1 = true;

    } finally {
      if (!caught1) throw new Error("Uh-oh: we should have caught an error");
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    console.log('Transfer attempt 2');
    let caught2 = false;

    try {
      await db.serializable(pool, txnClient => Promise.all([
        transferMoney(accountA.id, accountB.id, 40, txnClient),
        transferMoney(accountA.id, accountC.id, 40, txnClient)
      ]));

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught2 = true;

    } finally {
      if (!caught2) throw new Error("Uh-oh: we should have caught an error");
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));
  })();

  await (async () => {
    console.log('\n=== Passing a PoolClient to transaction helper ===\n');

    const [accountA, accountB, accountC] = await db.insert('bankAccounts',
      [{ balance: 50 }, { balance: 50 }, { balance: 50 }]).run(pool);

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    const transferMoney = (sendingAccountId: number, receivingAccountId: number, amount: number, txnClientOrQueryable: db.Queryable | db.TxnClientForSerializable) =>
      db.serializable(txnClientOrQueryable, txnClient => Promise.all([
        db.update('bankAccounts',
          { balance: db.sql`${db.self} - ${db.param(amount)}` },
          { id: sendingAccountId }).run(txnClient),
        db.update('bankAccounts',
          { balance: db.sql`${db.self} + ${db.param(amount)}` },
          { id: receivingAccountId }).run(txnClient),
      ]));

    console.log('Transfer attempt 1');
    let caught1 = false;
    const client1 = await pool.connect();

    try {
      await transferMoney(accountA.id, accountB.id, 60, client1);

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught1 = true;

    } finally {
      if (!caught1) throw new Error("Uh-oh: we should have caught an error");
      client1.release();
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    console.log('Transfer attempt 2');
    let caught2 = false;
    const client2 = await pool.connect();

    try {
      await db.serializable(client2, txnClient => Promise.all([
        transferMoney(accountA.id, accountB.id, 40, txnClient),
        transferMoney(accountA.id, accountC.id, 40, txnClient)
      ]));

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught2 = true;

    } finally {
      if (!caught2) throw new Error("Uh-oh: we should have caught an error");
      client2.release();
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));
  })();

  await (async () => {
    console.log('\n=== Passing a plain Client to transaction helper ===\n');

    const [accountA, accountB, accountC] = await db.insert('bankAccounts',
      [{ balance: 50 }, { balance: 50 }, { balance: 50 }]).run(pool);

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    const transferMoney = (sendingAccountId: number, receivingAccountId: number, amount: number, txnClientOrQueryable: db.Queryable | db.TxnClientForSerializable) =>
      db.serializable(txnClientOrQueryable, txnClient => Promise.all([
        db.update('bankAccounts',
          { balance: db.sql`${db.self} - ${db.param(amount)}` },
          { id: sendingAccountId }).run(txnClient),
        db.update('bankAccounts',
          { balance: db.sql`${db.self} + ${db.param(amount)}` },
          { id: receivingAccountId }).run(txnClient),
      ]));

    console.log('Transfer attempt 1');
    let caught1 = false;
    const client1 = new pg.Client({ connectionString });
    await client1.connect();

    try {
      await transferMoney(accountA.id, accountB.id, 60, client1);

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught1 = true;

    } finally {
      if (!caught1) throw new Error("Uh-oh: we should have caught an error");
      await client1.end();
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));

    console.log('Transfer attempt 2');
    let caught2 = false;
    const client2 = new pg.Client({ connectionString });
    await client2.connect();

    try {
      await db.serializable(client2, txnClient => Promise.all([
        transferMoney(accountA.id, accountB.id, 40, txnClient),
        transferMoney(accountA.id, accountC.id, 40, txnClient)
      ]));

    } catch (err: any) {
      console.log(err.message, '/', err.detail);
      caught2 = true;

    } finally {
      if (!caught2) throw new Error("Uh-oh: we should have caught an error");
      await client2.end();
    }

    console.log('Balances', await db.select('bankAccounts', db.all).run(pool));
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

    console.log(fullResult.$action);

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
    await db.upsert("chat", [{ telegram_chat_id: "new_id", created: new Date() }], "telegram_chat_id").run(pool);

    const
      r1 = await db.upsert("chat", { telegram_chat_id: "test_id", created: new Date() }, "telegram_chat_id", { updateColumns: [] }).run(pool),
      r2 = await db.upsert("chat", [{ telegram_chat_id: "test_id", created: new Date() }], "telegram_chat_id", { updateColumns: [] }).run(pool);

    console.log('do nothing single insert result', r1);
    console.log('do nothing array insert result', r2);

    const
      x = await db.upsert("chat", { telegram_chat_id: "another_id" }, db.constraint("chat_pkey"), { reportAction: 'suppress' }).run(pool),
      y = await db.upsert("chat", { telegram_chat_id: "another_id" }, db.constraint("chat_pkey"), { updateColumns: [] }).run(pool),
      z = await db.upsert("chat", { telegram_chat_id: "another_id" }, db.constraint("chat_pkey"), { updateColumns: db.doNothing }).run(pool);

    // @ts-expect-error -- $action is undefined
    console.log(x.$action);
    try {
      // @ts-expect-error -- y may be undefined
      console.log(y.$action);
    } catch { }
    try {
      // @ts-expect-error -- z may be undefined
      console.log(z.$action);
    } catch { }
  })();

  await (async () => {
    console.log('\n=== upsert with updateValues ===\n');

    for (let i = 0; i < 2; i++) await db.upsert("nameCounts",
      { name: "George", count: 1 }, "name",
      { updateValues: { count: db.sql`${"nameCounts"}.${"count"} + 1` } }
    ).run(pool);

    for (let i = 0; i < 2; i++) await db.upsert("nameCounts",
      [{ name: "George", count: 1 }, { name: "Bob", count: 1 }], "name",
      { updateValues: { count: db.sql`${"nameCounts"}.${"count"} + 1` } }
    ).run(pool);

    await db.select("nameCounts", db.all).run(pool);
  })();

  await (async () => {
    console.log('\n=== type vs interface (issue #85) ===\n');

    type UnknownObject = Record<string, unknown>;

    const myFunction = <T extends UnknownObject>(arg: T): void => {
      console.log(arg);
    }
    const processDb = (): s.files.Insertable => {
      return { path: '/', created_at: new Date(), updated_at: new Date() };
    }
    const someInsertable = processDb();

    // fix 1
    myFunction({ ...someInsertable });

    // fix 2
    type MyInsertableTypeAlias = { [s in keyof s.files.Insertable]: s.files.Insertable[s] };

    const processDbAlt = (): MyInsertableTypeAlias => {
      return { path: '/', created_at: new Date(), updated_at: new Date() };
    }
    const someTypeAlias = processDbAlt();
    myFunction(someTypeAlias);
  })();

  await (async () => {
    console.log('\n=== Prepared statements (issue #78) ===\n');

    const q1 = db.select('authors', db.all).prepared();
    await q1.run(pool);
    await q1.run(pool);

    const q2 = db.select('books', db.all).prepared('myprepped');
    await q2.run(pool);
    await q2.run(pool);

    const q3 = db.select('files', db.all).prepared();
    await q3.run(pool);
    await q3.run(pool);
  })();

  await (async () => {
    console.log('\n=== string-valued extras for column aliasing ===\n');

    const firstBookTitle = await db.selectOne("books", db.all, {
      order: { by: 'title', direction: 'ASC' },
      extras: {
        bookTitle1: db.sql<s.books.SQL, string | null>`${"title"}`,  // old way
        bookTitle2: "title",  // new way
        bookId1: db.sql<s.books.SQL, number>`${"id"}`,  // old way
        bookId2: "id",  // new way
      }
    }).run(pool);

    console.log(firstBookTitle!.bookTitle2, firstBookTitle!.bookId2);

    const
      author = await db.selectOne('authors', db.all).run(pool),
      book = await db.insert('books', {
        authorId: author!.id,
        title: 'Some book or other',
        createdAt: dc.now,
      }, {
        returning: ['id'],
        extras: {
          aliasedTitle: "title",
          upperTitle: db.sql<s.books.SQL, string>`upper(${"title"})`,
        },
      }).run(pool);

    console.log(book.upperTitle);
  })();

  await (async () => {
    console.log('\n=== JSON string returning types ===\n');

    await db.sql`SET datestyle TO 'postgres'`.run(pool);
    await db.sql`SET intervalstyle TO 'postgres'`.run(pool);

    db.setConfig({ castArrayParamsToJson: false });

    await db.insert('stringreturning', [{
      date: '2020-01-01',
      arrdate: ['2020-01-01', '1945-08-08'],
      time: '18:23:12.345',
      arrtime: ['18:23:12.345', '19:23:12.345'],
      timetz: '18:23:56.190+02:15',
      arrtimetz: ['18:23:56.190+02:15', '19:23:56.190+02:15'],
      timestamp: '2020-01-01T18:23:03.123',
      arrtimestamp: ['2020-01-01T18:23:03.123', '2020-01-02T18:23:03.123'],
      timestamptz: '2020-01-01T18:23:03.123Z',
      arrtimestamptz: ['2020-01-01T18:23:03.123Z', '2020-01-03T18:23:03.123Z'],
      daterange: '["2020-01-01","2021-01-03")',
      int4range: '(0, 10]',
      int8range: '(0, 10]',
      numrange: '(0, 10]',
      tsrange: '["2020-01-01T18:23:03.123",2020-01-01T19:23:03.123)',
      tstzrange: '("2020-01-01T18:23:03.123",2020-01-01T19:23:03.123]',
      interval: 'P1Y2M3DT4H5M6S',
      bytea: `\\x${Buffer.from('abc'.repeat(100)).toString('hex')}` as db.ByteArrayString,
      int8: 123,
      money: 123.4,
      numeric: 123.4,
    }, {
      date: '2020-01-01',
      time: '18:23',
      timetz: '18:23+02',
      timestamp: '2020-01-01T18:23:03.123',
      timestamptz: '2020-01-01T18:23:03.123Z',
      daterange: '[,"2021-01-03")',
      int4range: '(0,]',
      int8range: '(0, 10]',
      numrange: '(0, 10]',
      tsrange: '["2020-01-01T18:23:03.123",infinity)',
      tstzrange: '("2020-01-01T18:23:03.123",)',
      bytea: Buffer.from('abc'),
    }]).run(pool);

    await db.sql`SET datestyle TO 'postgres'`.run(pool);
    await db.sql`SET intervalstyle TO 'postgres'`.run(pool);

    const sr = await db.sql<s.stringreturning.SQL, s.stringreturning.Selectable>`SELECT * FROM ${'stringreturning'}`.run(pool);
    console.log('raw pg:', sr);

    const srjson = await db.select('stringreturning', db.all).run(pool);
    console.log('json:', srjson);

    await db.sql`SET datestyle TO 'iso'`.run(pool);
    await db.sql`SET intervalstyle TO 'iso_8601'`.run(pool);

    const sriso = await db.sql`SELECT * FROM ${'stringreturning'}`.run(pool);
    console.log('raw pg:', sriso);

    const srisojson = await db.select('stringreturning', db.all).run(pool);
    console.log('json:', srisojson);

    console.log(db.toBuffer(srisojson[0].bytea));
  })();

  await (async () => {
    console.log('\n=== LIMIT, FETCH FIRST and OFFSET (issue #89) ===\n');

    await db.select('books', db.all, { limit: 2 }).run(pool);
    await db.select('books', db.all, { limit: 2, offset: 1 }).run(pool);
    await db.select('books', db.all, { limit: 2, offset: 1, order: { by: 'authorId', direction: 'ASC' } }).run(pool);
    await db.select('books', db.all, { limit: 1, withTies: true, order: { by: 'authorId', direction: 'ASC' } }).run(pool);
    await db.select('books', db.all, { limit: 1, offset: 2, withTies: true, order: { by: 'authorId', direction: 'ASC' } }).run(pool);

  })();

  await (async () => {
    console.log('\n=== joins with counts and sums (issue #96) ===\n');

    const
      [book1, book2] = await db.select('books', db.all, { limit: 2, order: { by: 'id', direction: 'ASC' } }).run(pool),
      [ch1, ch2, ch3] = await db.insert('chapters', [{ bookId: book1.id }, { bookId: book1.id }, { bookId: book2.id }]).run(pool),
      [para1, para2, para3] = await db.insert('paragraphs', [
        { chapterId: ch1.id }, { chapterId: ch1.id },
        { chapterId: ch2.id }, { chapterId: ch2.id }, { chapterId: ch2.id },
        { chapterId: ch3.id },
      ]).run(pool);

    void para1, para2, para3;

    const chcounts = await db.select('books', db.all, {
      columns: ['title'],
      lateral: {
        chapterParaCounts: db.select('chapters', { bookId: db.parent('id') }, {
          lateral: db.count('paragraphs', { chapterId: db.parent('id') })
        })
      }
    }).run(pool);

    console.dir(chcounts, { depth: 10 });

    const pcounts = await db.select('books', db.all, {
      columns: ['title'],
      lateral: {
        chapterParaCounts: db.select('chapters', { bookId: db.parent('id') }, {
          lateral: db.sql`SELECT sum(result) AS result FROM (${db.count('paragraphs', { chapterId: db.parent('id') })}) AS sq`
        })
      }
    }).run(pool);

    console.dir(pcounts, { depth: 10 });

    const paracounts = await db.select('books', db.all, {
      columns: ['title'],
      lateral: {
        paraCount: db.sql<s.chapters.SQL>`
          SELECT sum("my_join"."result") AS "result" FROM "chapters"
          LEFT JOIN LATERAL (${db.count('paragraphs', { chapterId: db.sql`${db.self} = ${"chapters"}.${"id"}` })})
          AS "my_join" ON TRUE
          WHERE ${{ bookId: db.parent('id') }}`
      }
    }).run(pool);

    console.log(paracounts);

    const paracounts3 = await db.select('books', db.all, {
      columns: ['title'],
      lateral: {
        paraCount: db.sum('chapters', { bookId: db.parent('id') }, {
          columns: ['result' as any],
          lateral: {
            count: db.count('paragraphs', { chapterId: db.parent('id') })
          }
        })
      }
    }).run(pool);

    console.log(paracounts3);

  })();

  await (async () => {
    console.log('\n=== order by lateral result (issue #108) ===\n');

    const bookAuthors = await db.select('books', db.all, {
      lateral: {
        author: db.selectOne('authors', { id: db.parent('authorId') })
      },
      order: { by: db.sql`result->'author'->'name'`, direction: 'ASC' },
      extras: { authorName: db.sql`result->'author'->'name'` }
    }).run(pool);

    console.log(bookAuthors);
  })();


  await (async () => {
    console.log('\n=== undefined problems (issue #97) ===\n');

    await db.select('authors', {}).run(pool);  // {} is treated as TRUE

    // @ts-expect-error
    await db.select('authors', { name: undefined }).run(pool);

    try {
      // @ts-expect-error
      await db.insert('bools', { value: undefined }).run(pool);

    } catch (err: any) {
      console.error('Error caught as intended: ', err.message);
    }

    function defined<T extends Record<string | number | symbol, any>>(obj: T) {
      return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as
        { [k in keyof T as T[k] extends undefined ? never : k]: T[k] };
    }

    const z = defined({ x: 12, y: undefined });
    console.log('z (should have no y property): ', z);

    await db.select('authors', defined({ name: undefined })).run(pool);
  })();

  await (async () => {
    console.log('\n=== issue #105: OR ===\n');

    const cond1 = [
      db.sql`${"name"} = ${db.param('Jane Austen')}`,
      db.sql`${"name"} = ${db.param('Ernest Hemingway')}`,
    ];

    //await db.select('authors', dc.or(...cond1)).run(pool);
    void cond1;

    const cond2 = [
      { name: 'Jane Austen' },
      { name: 'Ernest Hemingway' },
    ];

    //await db.select('authors', dc.or(...cond2)).run(pool);
    void cond2;
  })();

  await (async () => {
    console.log('\n=== multi-schema stuff ===\n');

    const [brighton, handstp] = await db.insert("UK.constituencies", [
      { constituencyName: 'Brighton Pavilion', nation: 'England' },
      { constituencyName: 'Holborn and St Pancras', nation: 'England' },
    ]).run(pool);

    await db.insert("UK.mps", [
      { mpName: 'Caroline Lucas', party: 'Green', constituencyId: brighton.constituencyId },
      { mpName: 'Keir Starmer', party: 'Labour', constituencyId: handstp.constituencyId },
    ]).run(pool);

    const [ny, ga] = await db.insert("US.states", [
      { stateId: 'NY', stateName: 'New York' },
      { stateId: 'GA', stateName: 'Georgia' },
    ]).run(pool);

    const ca = await db.upsert("US.states", { stateId: 'CA', stateName: 'Cauliflower' }, "stateId").run(pool);
    await db.update("US.states", { stateName: 'California' }, { stateId: ca.stateId }).run(pool);

    const [ny14, ga5] = await db.insert("US.districts", [
      { stateId: ny.stateId, ordinality: 14 },
      { stateId: ga.stateId, ordinality: 5 },
    ]).run(pool);

    await db.insert("US.representatives", [
      { representativeName: 'Alexandria Ocasio-Cortez', districtId: ny14.districtId, party: 'Democrat' },
      { representativeName: 'Nikema Williams', districtId: ga5.districtId, party: 'Democrat' },
    ]).run(pool);

    const reps = await db.select("US.representatives", db.all, {
      lateral: {
        district: db.selectExactlyOne("US.districts", { districtId: db.parent() }, {
          lateral: {
            state: db.selectExactlyOne("US.states", { stateId: db.parent() })
          }
        })
      }
    }).run(pool);

    console.dir(reps, { depth: null });

    const mps = await db.sql
      <s.UK.mps.SQL | s.UK.constituencies.SQL, (s.UK.mps.Selectable & s.UK.constituencies.Selectable)[]>
      `SELECT * FROM ${"UK.mps"}
       JOIN ${"UK.constituencies"} USING (${"constituencyId"})
       WHERE ${"party"} = ${db.param('Green')}`.run(pool);

    console.dir(mps.map(mp => [mp.mpName, mp.constituencyName]));

  })();

  await (async () => {
    console.log('\n=== issues #115 and #116: SQLFragment in Whereable and Updatable ===\n');

    const authorQuery = db.sql<s.authors.SQL, s.authors.Selectable[]>`
  SELECT ${'id'} FROM ${'authors'} WHERE ${{ name: 'Douglas Adams' }}`;

    const bookQuery = db.sql<s.books.SQL, s.books.Selectable[]>`
  SELECT * FROM ${'books'} WHERE ${{ authorId: db.sql`${db.self} = (${authorQuery})` }}`;

    await bookQuery.run(pool);

    const altBookQuery = db.sql<s.books.SQL, s.books.Selectable[]>`
  SELECT * FROM ${'books'} WHERE ${'authorId'} = (${authorQuery})`;

    await altBookQuery.run(pool);

    const lateralBookQuery = db.selectOne('authors', { name: 'Douglas Adams' }, {
      lateral: db.select('books', { authorId: db.parent('id') })
    });

    await lateralBookQuery.run(pool);

    const author = { name: 'Jane Austen' };

    await db.sql<s.authors.SQL, []>`
      UPDATE ${'authors'}
      SET (${db.cols(author)}) = ROW(${db.vals(author)})
      WHERE false
    `.run(pool);

    await db.update('authors', author, db.sql<s.authors.SQL | s.books.SQL>`
      ${'id'} = (SELECT ${'authorId'} FROM ${'books'} WHERE ${'title'} = ${db.param('Pride and Prejudice')})
    `).run(pool);

    await db.update('authors', author, {
      id: db.sql<s.authors.SQL | s.books.SQL>`
        ${db.self} = (SELECT ${'authorId'} FROM ${'books'} WHERE ${'title'} = ${db.param('Pride and Prejudice')})`
    }).run(pool);

  })();

  await (async () => {
    console.log('\n=== SELECT locking clauses in alternate schemas (issue #118) ===\n');
    const
      cons1 = await db.select("UK.constituencies", db.all, { lock: { for: "NO KEY UPDATE" } }).run(pool),
      cons2 = await db.select("UK.constituencies", db.all, { alias: "uc", lock: { for: "UPDATE", of: "uc", wait: "NOWAIT" } }).run(pool),
      cons3 = await db.select("UK.constituencies", db.all, { lock: { for: "UPDATE", of: "constituencies", wait: "NOWAIT" } }).run(pool);

    // @ts-expect-error
    console.log(db.select("UK.constituencies", db.all, { lock: { for: "UPDATE", of: "UK.constituencies" } }).compile());
    // @ts-expect-error
    console.log(db.select("UK.constituencies", db.all, { alias: "cons", lock: { for: "UPDATE", of: "con" } }).compile());

    void cons1, cons2, cons3;  // no warnings, please
  })();

  await (async () => {
    console.log('\n=== Column names with spaces (issue #122) ===\n');
    const
      cons1 = await db.insert("tableWithColumnWithSpaces", { "column name has spaces": 'which is probably a Bad Idea' }).run(pool),
      cons2 = await db.select("tableWithColumnWithSpaces", db.all).run(pool),
      cons3 = await db.selectOne("tableWithColumnWithSpaces", db.all, { columns: ['column name has spaces'] }).run(pool);

    void cons1, cons2, cons3;  // no warnings, please
  })();

  await pool.end();
})();
