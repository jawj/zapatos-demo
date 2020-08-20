/*
** DON'T EDIT THIS FILE **
It's been generated by Zapatos (v0.1.54), and is liable to be overwritten

Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 George MacKerron
Released under the MIT licence: see LICENCE file
*/

import type {
  JSONValue,
  JSONArray,
  DateString,
  SQLFragment,
  SQL,
  GenericSQLExpression,
  ColumnNames,
  ColumnValues,
  ParentColumn,
  DefaultType,
} from './src/core';

import type PgDomainContinue from './custom/PgDomainContinue';
import type PgDomainIllegal_characters_text from './custom/PgDomainIllegal_characters_text';
import type PgDomainMySpecialGeometry from './custom/PgDomainMySpecialGeometry';
import type PgDomainMySpecialJsonb from './custom/PgDomainMySpecialJsonb';
import type PgDomainSQL from './custom/PgDomainSQL';
import type PgTypeGeometry from './custom/PgTypeGeometry';
import type PgType_mySpecialGeometry from './custom/PgType_mySpecialGeometry';


/* === schema: extra === */

/* --- enums --- */


/* --- tables --- */

export namespace tableInOtherSchema {
  export type Table = 'tableInOtherSchema';
  export interface Selectable {
    id: number;
    details: string | null;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    details?: string | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'tableInOtherSchema_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}


/* === schema: public === */

/* --- enums --- */

export type appleEnvironment = 'PROD' | 'Sandbox';
export namespace every {
  export type appleEnvironment = ['PROD', 'Sandbox'];
}

/* --- tables --- */

export namespace appleTransactions {
  export type Table = 'appleTransactions';
  export interface Selectable {
    environment: appleEnvironment;
    originalTransactionId: string;
    accountId: number;
    latestReceiptData: string | null;
  }
  export interface Insertable {
    environment: appleEnvironment | SQLFragment;
    originalTransactionId: string | SQLFragment;
    accountId: number | SQLFragment;
    latestReceiptData?: string | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'appleTransPKey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace authors {
  export type Table = 'authors';
  export interface Selectable {
    id: number;
    name: string;
    isLiving: boolean | null;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    name: string | SQLFragment;
    isLiving?: boolean | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'authors_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace books {
  export type Table = 'books';
  export interface Selectable {
    id: number;
    authorId: number;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    authorId: number | SQLFragment;
    title?: string | null | DefaultType | SQLFragment;
    createdAt?: Date | DateString | DefaultType | SQLFragment;
    updatedAt?: Date | DateString | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'books_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace customTypes {
  export type Table = 'customTypes';
  export interface Selectable {
    id: number;
    structuredDocument: PgDomainMySpecialJsonb | null;
    location: PgTypeGeometry | null;
    otherLocation: PgDomainMySpecialGeometry | null;
    furtherLocations: PgType_mySpecialGeometry | null;
    name: PgDomainIllegal_characters_text | null;
    blah: PgDomainContinue | null;
    bar: PgDomainSQL | null;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    structuredDocument?: PgDomainMySpecialJsonb | null | DefaultType | SQLFragment;
    location?: PgTypeGeometry | null | DefaultType | SQLFragment;
    otherLocation?: PgDomainMySpecialGeometry | null | DefaultType | SQLFragment;
    furtherLocations?: PgType_mySpecialGeometry | null | DefaultType | SQLFragment;
    name?: PgDomainIllegal_characters_text | null | DefaultType | SQLFragment;
    blah?: PgDomainContinue | null | DefaultType | SQLFragment;
    bar?: PgDomainSQL | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'customTypes_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace emailAuthentication {
  export type Table = 'emailAuthentication';
  export interface Selectable {
    email: string;
    consecutiveFailedLogins: number;
    lastFailedLogin: Date | null;
  }
  export interface Insertable {
    email: string | SQLFragment;
    consecutiveFailedLogins?: number | DefaultType | SQLFragment;
    lastFailedLogin?: Date | DateString | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'emailAuthentication_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace employees {
  export type Table = 'employees';
  export interface Selectable {
    id: number;
    name: string;
    managerId: number | null;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    name: string | SQLFragment;
    managerId?: number | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'employees_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace identityTest {
  export type Table = 'identityTest';
  export interface Selectable {
    id: number;
    data: string | null;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    data?: string | null | DefaultType | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'identityTest_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace stores {
  export type Table = 'stores';
  export interface Selectable {
    id: number;
    name: string;
    geom: PgTypeGeometry;
  }
  export interface Insertable {
    id?: number | DefaultType | SQLFragment;
    name: string | SQLFragment;
    geom: PgTypeGeometry | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'stores_pkey';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

export namespace tags {
  export type Table = 'tags';
  export interface Selectable {
    tag: string;
    bookId: number;
  }
  export interface Insertable {
    tag: string | SQLFragment;
    bookId: number | SQLFragment;
  }
  export interface Updatable extends Partial<Insertable> { }
  export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
  export type JSONSelectable = { [K in keyof Selectable]:
    Date extends Selectable[K] ? Exclude<Selectable[K], Date> | DateString :
    Date[] extends Selectable[K] ? Exclude<Selectable[K], Date[]> | DateString[] :
    Selectable[K]
  };
  export type UniqueIndex = 'tagsUniqueIdx';
  export type Column = keyof Selectable;
  export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
  export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
  export type SQL = SQLExpression | SQLExpression[];
}

/* === cross-table types === */

export type Table = appleTransactions.Table | authors.Table | books.Table | customTypes.Table | emailAuthentication.Table | employees.Table | identityTest.Table | stores.Table | tableInOtherSchema.Table | tags.Table;
export type Selectable = appleTransactions.Selectable | authors.Selectable | books.Selectable | customTypes.Selectable | emailAuthentication.Selectable | employees.Selectable | identityTest.Selectable | stores.Selectable | tableInOtherSchema.Selectable | tags.Selectable;
export type Whereable = appleTransactions.Whereable | authors.Whereable | books.Whereable | customTypes.Whereable | emailAuthentication.Whereable | employees.Whereable | identityTest.Whereable | stores.Whereable | tableInOtherSchema.Whereable | tags.Whereable;
export type Insertable = appleTransactions.Insertable | authors.Insertable | books.Insertable | customTypes.Insertable | emailAuthentication.Insertable | employees.Insertable | identityTest.Insertable | stores.Insertable | tableInOtherSchema.Insertable | tags.Insertable;
export type Updatable = appleTransactions.Updatable | authors.Updatable | books.Updatable | customTypes.Updatable | emailAuthentication.Updatable | employees.Updatable | identityTest.Updatable | stores.Updatable | tableInOtherSchema.Updatable | tags.Updatable;
export type UniqueIndex = appleTransactions.UniqueIndex | authors.UniqueIndex | books.UniqueIndex | customTypes.UniqueIndex | emailAuthentication.UniqueIndex | employees.UniqueIndex | identityTest.UniqueIndex | stores.UniqueIndex | tableInOtherSchema.UniqueIndex | tags.UniqueIndex;
export type Column = appleTransactions.Column | authors.Column | books.Column | customTypes.Column | emailAuthentication.Column | employees.Column | identityTest.Column | stores.Column | tableInOtherSchema.Column | tags.Column;
export type AllTables = [appleTransactions.Table, authors.Table, books.Table, customTypes.Table, emailAuthentication.Table, employees.Table, identityTest.Table, stores.Table, tableInOtherSchema.Table, tags.Table];


export type SelectableForTable<T extends Table> = {
  appleTransactions: appleTransactions.Selectable;
  authors: authors.Selectable;
  books: books.Selectable;
  customTypes: customTypes.Selectable;
  emailAuthentication: emailAuthentication.Selectable;
  employees: employees.Selectable;
  identityTest: identityTest.Selectable;
  stores: stores.Selectable;
  tableInOtherSchema: tableInOtherSchema.Selectable;
  tags: tags.Selectable;
}[T];

export type WhereableForTable<T extends Table> = {
  appleTransactions: appleTransactions.Whereable;
  authors: authors.Whereable;
  books: books.Whereable;
  customTypes: customTypes.Whereable;
  emailAuthentication: emailAuthentication.Whereable;
  employees: employees.Whereable;
  identityTest: identityTest.Whereable;
  stores: stores.Whereable;
  tableInOtherSchema: tableInOtherSchema.Whereable;
  tags: tags.Whereable;
}[T];

export type InsertableForTable<T extends Table> = {
  appleTransactions: appleTransactions.Insertable;
  authors: authors.Insertable;
  books: books.Insertable;
  customTypes: customTypes.Insertable;
  emailAuthentication: emailAuthentication.Insertable;
  employees: employees.Insertable;
  identityTest: identityTest.Insertable;
  stores: stores.Insertable;
  tableInOtherSchema: tableInOtherSchema.Insertable;
  tags: tags.Insertable;
}[T];

export type UpdatableForTable<T extends Table> = {
  appleTransactions: appleTransactions.Updatable;
  authors: authors.Updatable;
  books: books.Updatable;
  customTypes: customTypes.Updatable;
  emailAuthentication: emailAuthentication.Updatable;
  employees: employees.Updatable;
  identityTest: identityTest.Updatable;
  stores: stores.Updatable;
  tableInOtherSchema: tableInOtherSchema.Updatable;
  tags: tags.Updatable;
}[T];

export type UniqueIndexForTable<T extends Table> = {
  appleTransactions: appleTransactions.UniqueIndex;
  authors: authors.UniqueIndex;
  books: books.UniqueIndex;
  customTypes: customTypes.UniqueIndex;
  emailAuthentication: emailAuthentication.UniqueIndex;
  employees: employees.UniqueIndex;
  identityTest: identityTest.UniqueIndex;
  stores: stores.UniqueIndex;
  tableInOtherSchema: tableInOtherSchema.UniqueIndex;
  tags: tags.UniqueIndex;
}[T];

export type ColumnForTable<T extends Table> = {
  appleTransactions: appleTransactions.Column;
  authors: authors.Column;
  books: books.Column;
  customTypes: customTypes.Column;
  emailAuthentication: emailAuthentication.Column;
  employees: employees.Column;
  identityTest: identityTest.Column;
  stores: stores.Column;
  tableInOtherSchema: tableInOtherSchema.Column;
  tags: tags.Column;
}[T];

export type SQLForTable<T extends Table> = {
  appleTransactions: appleTransactions.SQL;
  authors: authors.SQL;
  books: books.SQL;
  customTypes: customTypes.SQL;
  emailAuthentication: emailAuthentication.SQL;
  employees: employees.SQL;
  identityTest: identityTest.SQL;
  stores: stores.SQL;
  tableInOtherSchema: tableInOtherSchema.SQL;
  tags: tags.SQL;
}[T];

