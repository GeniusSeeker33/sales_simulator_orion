const db = global.db || {
  clients: [],
  employees: [],
  contacts: [],
  imports: []
};

if (!global.db) {
  global.db = db;
}

export default db;