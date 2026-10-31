-- Private server-only schema; not exposed through the browser Data API.
BEGIN;
CREATE SCHEMA IF NOT EXISTS zuno;
REVOKE ALL ON SCHEMA zuno FROM PUBLIC, anon, authenticated;
SET LOCAL search_path TO zuno;

CREATE TABLE merchants(id TEXT PRIMARY KEY, shop TEXT NOT NULL, owner TEXT NOT NULL, opening BIGINT NOT NULL, language TEXT NOT NULL DEFAULT 'hinglish', setup BIGINT NOT NULL DEFAULT 0);

CREATE TABLE entries(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), kind TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount>0), name TEXT NOT NULL, method TEXT NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL, due_id TEXT REFERENCES entries(id), source TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE(merchant,request_key));

CREATE TABLE obligations(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), label TEXT NOT NULL, amount BIGINT NOT NULL, date TEXT NOT NULL);

CREATE TABLE proposals(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), payload TEXT NOT NULL, expires BIGINT NOT NULL, status TEXT NOT NULL);

CREATE TABLE audit(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),event TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL);

CREATE TABLE sessions(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),expires BIGINT NOT NULL);

CREATE TABLE entry_voids(entry_id TEXT PRIMARY KEY REFERENCES entries(id),merchant TEXT NOT NULL REFERENCES merchants(id),reason TEXT NOT NULL,request_key TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(merchant,request_key));

CREATE TABLE schedule(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),direction TEXT NOT NULL,label TEXT NOT NULL,amount BIGINT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,request_key TEXT NOT NULL, version BIGINT NOT NULL DEFAULT 1, kind TEXT NOT NULL DEFAULT 'sale', due_id TEXT,UNIQUE(merchant,request_key));

CREATE TABLE planning_initialized(merchant TEXT PRIMARY KEY REFERENCES merchants(id));

CREATE TABLE entry_schedule(entry_id TEXT PRIMARY KEY REFERENCES entries(id),schedule_id TEXT NOT NULL REFERENCES schedule(id));

CREATE TABLE demo_devices(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),expires BIGINT NOT NULL);

CREATE TABLE customers(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),name TEXT NOT NULL,legacy BIGINT NOT NULL DEFAULT 0);

CREATE TABLE entry_customers(entry_id TEXT PRIMARY KEY REFERENCES entries(id),customer_id TEXT NOT NULL REFERENCES customers(id));

CREATE TABLE workspace_access(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id));

CREATE TABLE schedule_requests(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(merchant,request_key));

CREATE TABLE due_terms(entry_id TEXT PRIMARY KEY REFERENCES entries(id),merchant TEXT NOT NULL REFERENCES merchants(id),due_date TEXT NOT NULL);

CREATE TABLE voice_drafts(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),version BIGINT NOT NULL,payload TEXT NOT NULL,stage TEXT NOT NULL,expires BIGINT NOT NULL);

CREATE TABLE voice_turns(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(merchant,request_key));

CREATE TABLE voice_audio_requests(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,input_hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(merchant,request_key));

CREATE TABLE payment_import_batches(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),payload TEXT NOT NULL,expires BIGINT NOT NULL,result TEXT);

CREATE TABLE imported_payments(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),batch_id TEXT NOT NULL REFERENCES payment_import_batches(id),reference TEXT NOT NULL,record_type TEXT NOT NULL,date TEXT NOT NULL,amount BIGINT NOT NULL,name TEXT NOT NULL,source TEXT NOT NULL,entry_id TEXT REFERENCES entries(id),decision TEXT,UNIQUE(merchant,record_type,reference));

CREATE UNIQUE INDEX payment_entry_link ON imported_payments(entry_id) WHERE entry_id IS NOT NULL;

COMMIT;
