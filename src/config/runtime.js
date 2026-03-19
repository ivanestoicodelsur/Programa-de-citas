let sqlMode = "sql";
let mongoMode = "mongo";

export function setSqlMode(mode) {
  sqlMode = mode;
}

export function getSqlMode() {
  return sqlMode;
}

export function isMemorySqlMode() {
  return sqlMode === "memory";
}

export function setMongoMode(mode) {
  mongoMode = mode;
}

export function getMongoMode() {
  return mongoMode;
}

export function isMemoryMongoMode() {
  return mongoMode === "memory";
}
