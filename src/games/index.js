const icarus = require('./icarus');
const cs2 = require('./cs2');
const minecraft = require('./minecraft');
const factorio = require('./factorio');
const terraria = require('./terraria');

const adapters = { icarus, cs2, minecraft, factorio, terraria };

function get(gameId) {
  return adapters[gameId] || null;
}

function list() {
  return Object.values(adapters);
}

function isSupported(gameId) {
  return gameId in adapters;
}

module.exports = { get, list, isSupported };
