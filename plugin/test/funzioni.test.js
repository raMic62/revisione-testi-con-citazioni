'use strict';
// Tests for the text functions (no Obsidian needed). Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// Minimal stand-in for the Obsidian API, enough to load main.js.
const carica = Module._load;
Module._load = function (nome) {
  if (nome === 'obsidian') {
    class Base {}
    return { Plugin: Base, ItemView: Base, Modal: Base, Notice: Base, MarkdownView: Base, debounce: function (f) { return f; } };
  }
  if (nome.indexOf('@codemirror/') === 0) throw new Error('not available in tests');
  return carica.apply(this, arguments);
};
const f = require('../main.js')._prova;

const testo = [
  '---',
  'title: example',
  '---',
  '%%NOTA 100 G | note on the whole text%%',
  '',
  'First ==highlighted passage==%%NOTA 200 | comment on the passage%% and more.',
  'A point %%NOTA 300 | note at a point%%here.',
  '==Two==%%NOTA 400 +%%',
  '==paragraphs==%%NOTA 400 | one note on two pieces%%'
].join('\n');

test('lists notes in order, one per id', function () {
  const note = f.elencoNote(testo);
  assert.deepStrictEqual(note.map(function (n) { return [n.id, n.tipo]; }),
    [['100', 'generale'], ['200', 'passo'], ['300', 'punto'], ['400', 'passo']]);
  assert.deepStrictEqual(note[3].passi, ['Two', 'paragraphs']);
  assert.strictEqual(note[3].nota, 'one note on two pieces');
});

test('deleting a note keeps the passage and removes the markers', function () {
  const dopo = f.applica(testo, f.modificheElimina(testo, '200'));
  assert.ok(dopo.indexOf('First highlighted passage and more.') >= 0);
  const dopo2 = f.applica(testo, f.modificheElimina(testo, '400'));
  assert.ok(dopo2.indexOf('Two\nparagraphs') >= 0);
});

test('editing a note changes only its text', function () {
  const c = f.modificaTestoNota(testo, '300', 'new text');
  const dopo = f.applica(testo, [c]);
  assert.ok(dopo.indexOf('A point %%NOTA 300 | new text%%here.') >= 0);
  assert.strictEqual(dopo.length - testo.length, 'new text'.length - 'note at a point'.length);
});

test('note text cannot contain line breaks or %%', function () {
  assert.strictEqual(f.ripulisciNota('a\nb %% c'), 'a / b % % c');
});

test('a point note is never attached to a highlight', function () {
  const riga = 'see ==this== now';
  assert.strictEqual(f.fuoriDalleEvidenziazioni(riga, 12), 13);
  assert.strictEqual(f.fuoriDalleEvidenziazioni('see ==this==', 12), -1);
});
