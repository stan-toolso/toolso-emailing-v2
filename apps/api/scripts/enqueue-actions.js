#!/usr/bin/env node
/**
 * Insère dans la file d'actions (`ActionQueue`) des actions lues en NDJSON : une par ligne, soit une action `{ "type", "payload" }`,
 * soit un message SQS tel que renvoyé par `aws sqs receive-message` (`{ "Body": "<action JSON>", ... }`).
 * Sert à rejouer les messages restés dans la file SQS `actions_<uid>` au moment de la bascule (deploy/bin/replay-sqs-actions.sh).
 *   node scripts/enqueue-actions.js --file actions.ndjson
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const { parseArgs } = require('util');
const fs = require('fs');
const readline = require('readline');
const log = require('../src/util/log').getLogger('EnqueueActions');
const ActionType = require('../src/services/ActionType');

const { values } = parseArgs({ options: { file: { type: 'string' } } });
if (!values.file || !fs.existsSync(values.file)) {
  console.error('Usage: node scripts/enqueue-actions.js --file <actions.ndjson>');
  process.exit(2);
}

const parseLine = (line) => {
  const parsed = JSON.parse(line);
  const action = typeof parsed.Body === 'string' ? JSON.parse(parsed.Body) : parsed;
  if (!action || typeof action.type !== 'string') {
    throw new Error('action sans type');
  }
  return action;
};

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(2);
    const { ActionQueue } = sequelize.models;
    const rl = readline.createInterface({ input: fs.createReadStream(values.file), crlfDelay: Infinity });
    let rows = [];
    let inserted = 0;
    let invalid = 0;
    const flush = async () => {
      if (rows.length === 0) return;
      await ActionQueue.bulkCreate(rows);
      inserted += rows.length;
      rows = [];
    };
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const action = parseLine(line);
        rows.push({ queue: action.type === ActionType.export_contacts ? 'huge' : 'default', type: action.type, payload: action.payload ?? null });
      } catch (err) {
        invalid += 1;
        log.warn(`Ligne ignorée : ${err.message}`);
      }
      if (rows.length >= 500) await flush();
    }
    await flush();
    log.info(`${inserted} actions insérées dans la file, ${invalid} lignes ignorées`);
    console.log(JSON.stringify({ inserted, invalid }));
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    log.error('Insertion des actions échouée', err);
    process.exit(1);
  }
})();
