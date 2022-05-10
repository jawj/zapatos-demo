CREATE TABLE "identityTest"
( "id" INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "data" TEXT
);

CREATE TABLE "authors" 
( "id" SERIAL PRIMARY KEY
, "name" TEXT NOT NULL
, "isLiving" BOOLEAN
);
COMMENT ON COLUMN "authors"."name" IS 'Full name of author';

CREATE TABLE "books" 
( "id" SERIAL PRIMARY KEY
, "authorId" INTEGER NOT NULL REFERENCES "authors"("id")
, "title" TEXT
, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "tags"
( "tag" TEXT NOT NULL
, "bookId" INTEGER NOT NULL REFERENCES "books"("id")
);
CREATE UNIQUE INDEX "tagsUniqueIdx" ON "tags"("bookId", "tag");
CREATE INDEX "tagsBookIdIdx" ON "tags"("tag");

CREATE TABLE "emailAuthentication" 
( "email" TEXT PRIMARY KEY
, "consecutiveFailedLogins" INTEGER NOT NULL DEFAULT 0
, "lastFailedLogin" TIMESTAMPTZ
);

CREATE TYPE "appleEnvironment" AS ENUM 
( 'PROD'
, 'Sandbox'
);

CREATE TABLE "appleTransactions" 
( "environment" "appleEnvironment" NOT NULL
, "originalTransactionId" TEXT NOT NULL
, "accountId" INTEGER NOT NULL
, "latestReceiptData" TEXT
-- ... lots more fields ...
);

ALTER TABLE "appleTransactions" 
  ADD CONSTRAINT "appleTransPKey" 
  PRIMARY KEY ("environment", "originalTransactionId");

CREATE TABLE "employees"
( "id" SERIAL PRIMARY KEY
, "name" TEXT NOT NULL
, "managerId" INTEGER REFERENCES "employees"("id")
);

CREATE TABLE "bankAccounts" 
( "id" SERIAL PRIMARY KEY
, "balance" INTEGER NOT NULL DEFAULT 0 CHECK ("balance" > 0) 
);

CREATE EXTENSION postgis;
CREATE TABLE "stores"
( "id" SERIAL PRIMARY KEY
, "name" TEXT NOT NULL
, "geom" GEOMETRY NOT NULL
);
CREATE INDEX "storesGeomIdx" ON "stores" USING gist("geom");


CREATE DOMAIN "mySpecialJsonb" AS jsonb;
CREATE DOMAIN "mySpecialGeometry" AS geometry;
CREATE DOMAIN "illegal/characters.text" AS text;
CREATE DOMAIN "snake_cased_typename" AS text;
CREATE DOMAIN "continue" AS real;
CREATE DOMAIN "SQL" AS text;

CREATE TABLE "customTypes"
( "id" SERIAL PRIMARY KEY
, "structuredDocument" "mySpecialJsonb"
, "location" geometry
, "otherLocation" "mySpecialGeometry"
, "furtherLocations" "mySpecialGeometry"[] -- not supported until Postgres 11
, "name" "illegal/characters.text"
, "alsoName" "snake_cased_typename"
, "blah" "continue"  -- JS/TS reserved word
, "bar" "SQL" -- Zapatos object name clash
, "numbers" real[]
);

CREATE CAST (json AS geometry) WITH FUNCTION ST_GeomFromGeoJSON(json) AS ASSIGNMENT; -- json(b) input not supported until PostGIS 2.5
CREATE CAST (jsonb AS geometry) WITH FUNCTION ST_GeomFromGeoJSON(jsonb) AS ASSIGNMENT; -- ditto

CREATE SCHEMA "extra";
CREATE TABLE "extra"."tableInOtherSchema"
( "id" SERIAL PRIMARY KEY
, "details" TEXT
);

CREATE TABLE "dimensions" 
( "default_id" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "always_id" int GENERATED ALWAYS AS IDENTITY
, "millimetres" real NOT NULL
, "inches" real NOT NULL GENERATED ALWAYS AS ("millimetres" / 25.4) STORED  -- generated columns not supported until Postgres 12
, "metres" real NOT NULL
);

CREATE OR REPLACE FUNCTION calculate_metres() RETURNS trigger AS $$
BEGIN
  NEW."metres" := NEW."millimetres" / 1000;
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TRIGGER "dimensions_trigger"
BEFORE INSERT OR UPDATE ON "dimensions" 
FOR EACH ROW EXECUTE PROCEDURE calculate_metres();

CREATE TABLE "products" 
( "id" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "productName" text NOT NULL
);
CREATE TABLE "orders" 
( "id" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "userEmail" text NOT NULL
);
CREATE TABLE "orderProducts" 
( "orderId" int NOT NULL REFERENCES "orders"("id")
, "productId" int NOT NULL REFERENCES "products"("id") 
);

CREATE TABLE "photos" 
( "photoId" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "url" text NOT NULL
);
CREATE TABLE "subjects"
( "subjectId" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "name" text NOT NULL
);
CREATE TABLE "subjectPhotos"
( "subjectId" int NOT NULL REFERENCES "subjects"("subjectId")
, "photoId" int NOT NULL REFERENCES "photos"("photoId")
, CONSTRAINT userPhotosUnique UNIQUE ("subjectId", "photoId")
);

CREATE MATERIALIZED VIEW "matBooks" AS SELECT "name", "title" FROM "authors" JOIN "books" ON "books"."authorId" = "authors"."id";
CREATE MATERIALIZED VIEW "matCustom" AS SELECT * from "customTypes";
COMMENT ON COLUMN "matBooks"."title" IS 'Full title of book';

CREATE TABLE int8test (num int8);

CREATE TABLE "chat" (
  "telegram_chat_id" varchar(100) PRIMARY KEY,
  "created" TIMESTAMPTZ NOT NULL DEFAULT (now()),
  "updated" TIMESTAMPTZ NOT NULL DEFAULT (now())
);

CREATE TABLE "nameCounts" 
( "name" text primary key
, "count" integer
);

CREATE TABLE "files" 
( "id" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "created_at" timestamp with time zone NOT NULL
, "updated_at" timestamp with time zone NOT NULL
, "path" text not null UNIQUE
);

CREATE TABLE "images"
( "file_id" int UNIQUE REFERENCES "files"("id")
, "width" int not null
, "height" int not null
);

CREATE TABLE "numeric_test"
( "col" numeric(5,5)
);

CREATE TABLE "stringreturning"
( "date" date
, "arrdate" date[]
, "time" time
, "arrtime" time[]
, "timetz" timetz
, "arrtimetz" timetz[]
, "timestamp" timestamp
, "arrtimestamp" timestamp[]
, "timestamptz" timestamptz
, "arrtimestamptz" timestamptz[]
, "interval" interval
, "int4range" int4range
, "int8range" int8range
, "numrange" numrange
, "tsrange" tsrange
, "tstzrange" tstzrange
, "daterange" daterange
, "bytea" bytea
, "int8" int8
, "money" money
, "numeric" numeric
);

CREATE TABLE "chapters"
( "id" serial PRIMARY KEY
, "bookId" int NOT NULL REFERENCES "books"("id")
);
CREATE TABLE "paragraphs"
( "id" serial PRIMARY KEY
, "chapterId" int NOT NULL REFERENCES "chapters"("id")
);

CREATE VIEW testview AS (SELECT * FROM "authors");
CREATE VIEW testviewnoins AS (SELECT lower(name) FROM "authors");

CREATE EXTENSION file_fdw;
CREATE SERVER local_file FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE words (word text NOT NULL)
  SERVER local_file
  OPTIONS (filename '/usr/share/dict/words');

CREATE TABLE "bools" (
"value" boolean NOT NULL DEFAULT false 
);

ALTER DATABASE "zapatos_demo" SET search_path TO "$user", public, extra;


CREATE SCHEMA "us";
CREATE TYPE "us"."parties" AS ENUM
( 'Democrat'
, 'Republican'
, 'Green'
, 'Other'
);
CREATE TYPE "us"."legislatures" AS ENUM 
( 'Senate'
, 'Congress'
);
CREATE TABLE "us"."states"
( "stateId" text PRIMARY KEY
, "name" text NOT NULL
);
CREATE TABLE "us"."politicians"
( "politicianId" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "name" text NOT NULL
, "legislature" "us"."legislatures" NOT NULL
, "stateId" "us"."states" REFERENCES ("us"."states") NOT NULL
);

CREATE SCHEMA "uk";
CREATE TYPE "uk"."parties" AS ENUM
( 'Labour'
, 'Conservative'
, 'Green'
, 'Other'
);
CREATE TYPE "uk"."legislatures" AS ENUM 
( 'House of Commons'
, 'House of Lords'
);
CREATE TYPE "uk"."nations" AS ENUM
( 'Scotland'
, 'Wales'
, 'Northern Ireland'
, 'England'
);
CREATE TABLE "uk"."constituencies"
( "constituencyId" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "name" text NOT NULL
, "nation" "uk"."nations" NOT NULL
);
CREATE TABLE "uk"."politicians"
( "politicianId" int PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY
, "name" text NOT NULL
, "legislatures" "uk"."legislatures" NOT NULL
, "constituencyId" int REFERENCES ("uk"."constituencies")  -- NULL for House of Lords
);


