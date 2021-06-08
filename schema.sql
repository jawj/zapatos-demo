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
);

ALTER DATABASE "zapatos_demo" SET search_path TO "$user", public, extra;
