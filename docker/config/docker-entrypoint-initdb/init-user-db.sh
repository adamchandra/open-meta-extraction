#!/bin/bash
set -e

# Initialization script, run once when postgres data dir is empty
# place under mount  at /docker-entrypoint-initdb.d

## Use this line to enable url hashing within database (currently disabled)
# CREATE EXTENSION IF NOT EXISTS pgcrypto;

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE watrworker;
    ALTER ROLE watrworker WITH PASSWORD 'watrpasswd';
    ALTER ROLE watrworker CREATEDB;
    ALTER ROLE watrworker LOGIN;

    ALTER SCHEMA public OWNER TO watrworker;

    CREATE DATABASE open_extraction;
    ALTER DATABASE open_extraction OWNER TO watrworker;
    GRANT ALL ON DATABASE open_extraction TO watrworker;

    CREATE DATABASE open_extraction_testdb;
    ALTER DATABASE open_extraction_testdb OWNER TO watrworker;
    GRANT ALL ON DATABASE open_extraction_testdb TO watrworker;
EOSQL
