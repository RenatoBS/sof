const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = {
  accounts: [],
  employees: [],
  services: [],
  appointments: [],
  checkoutSessions: [],
  whatsappSessions: [],
};

function loadFromDisk() {
  if (!fs.existsSync(DATA_FILE)) return structuredClone(EMPTY_DB);
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...structuredClone(EMPTY_DB), ...parsed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Falha ao ler db.json, iniciando um banco vazio.', err);
    return structuredClone(EMPTY_DB);
  }
}

let state = loadFromDisk();
let writeQueue = Promise.resolve();

function persist() {
  // Serializa as escritas para evitar corromper o arquivo em gravações concorrentes.
  writeQueue = writeQueue.then(() => new Promise((resolve, reject) => {
    fs.mkdir(DATA_DIR, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) return reject(mkdirErr);
      const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
      fs.writeFile(tmpFile, JSON.stringify(state, null, 2), (writeErr) => {
        if (writeErr) return reject(writeErr);
        fs.rename(tmpFile, DATA_FILE, (renameErr) => {
          if (renameErr) return reject(renameErr);
          resolve();
        });
      });
    });
  })).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[db] Falha ao gravar db.json', err);
  });
  return writeQueue;
}

function collection(name) {
  if (!state[name]) state[name] = [];
  return {
    all() {
      return [...state[name]];
    },
    find(predicate) {
      return state[name].find(predicate);
    },
    filter(predicate) {
      return state[name].filter(predicate);
    },
    insert(record) {
      state[name].push(record);
      persist();
      return record;
    },
    update(id, patch) {
      const idx = state[name].findIndex((item) => item.id === id);
      if (idx === -1) return null;
      state[name][idx] = { ...state[name][idx], ...patch, id };
      persist();
      return state[name][idx];
    },
    remove(id) {
      const before = state[name].length;
      state[name] = state[name].filter((item) => item.id !== id);
      if (state[name].length !== before) persist();
      return state[name].length !== before;
    },
  };
}

module.exports = {
  accounts: collection('accounts'),
  employees: collection('employees'),
  services: collection('services'),
  appointments: collection('appointments'),
  checkoutSessions: collection('checkoutSessions'),
  whatsappSessions: collection('whatsappSessions'),
};
