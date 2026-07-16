// Pin the in-memory MongoDB version: deterministic across machines/CI, and
// the ~64MB 7.x binary avoids the download corruption seen with 8.x (~300MB).
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';
