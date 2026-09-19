const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the actual game functions with lightweight DOM/network substitutes.
// This checks outgoing URLs, not visual rendering or browser interaction.
function gameContext(game, prefix) {
  const requests = [];
  const images = [];
  const errors = [];
  const elements = new Map();
  function element() {
    return {
      dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, removeAttribute() {}, replaceWith() {},
      cloneNode: element,
    };
  }
  const items = JSON.parse(fs.readFileSync(game.data, 'utf8')).slice(0, 2);
  const context = vm.createContext({
    document: {
      documentElement: { dataset: { appRoot: prefix } },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      querySelectorAll: () => [],
      body: element(),
    },
    window: { addEventListener() {}, location: { href: '' } },
    Image: class {
      set src(value) {
        images.push(value);
        queueMicrotask(() => this.onload?.());
      }
    },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => url.endsWith('/session') ? { session_id: 'url-test' }
          : url.endsWith('/submit') ? { ok: true } : items,
      };
    },
    console: { error: error => errors.push(error) },
    setTimeout: () => 0,
    clearTimeout() {},
  });
  const source = fs.readFileSync(`app/static/js/${game.file}`, 'utf8');
  assert.match(source, /start\(\);\s*$/);
  vm.runInContext(source.replace(/start\(\);\s*$/, ''), context);
  return { context, requests, images, errors, elements };
}

const games = [
  { name: 'Bot or Not', file: 'bot_or_not.js', api: '/api/bot-or-not',
    data: 'data/bot_or_not/images.json', dataset: 'images',
    start: 'loadGameData()',
    play: 'introActive = false; gameStarted = true; showCurrent()',
    submit: "revealAndSave('ai')", reflect: 'renderReflection()',
    finish: 'reflectIndex = reflectionSlides.length - 1; nextReflection()' },
  { name: 'Phrase Completion', file: 'phrase_completion.js', api: '/api/phrase',
    data: 'data/phrase_completion/items.json', dataset: 'items', start: 'start()',
    submit: "revealAndSave('ai')", reflect: 'showReflection()',
    finish: 'reflectIndex = reflections.length - 1; goReflectNext()' },
  { name: 'Image Sequence', file: 'image_sequence.js', api: '/api/image-sequence',
    data: 'data/image_sequence/items.json', dataset: 'items', start: 'start()',
    submit: "logAction('open')" },
];

for (const prefix of ['', '/genaisis']) {
  for (const game of games) {
    test(`${game.name} keeps requests, images and navigation under ${prefix || '/'}`, async () => {
      const { context, requests, images, errors, elements } = gameContext(game, prefix);
      for (const code of [game.start, game.play, game.submit, game.reflect, game.finish]) {
        if (code) await vm.runInContext(code, context);
      }
      assert.deepEqual(errors, []);
      for (const suffix of ['session', game.dataset, 'submit']) {
        assert.ok(requests.some(request => request.url === `${prefix}${game.api}/${suffix}`), suffix);
      }
      assert.ok(requests.every(request => request.url.startsWith(`${prefix}/api/`)));
      assert.ok(images.length > 0);
      assert.ok(images.every(url => url.startsWith(`${prefix}/static/images/`)));
      for (const el of elements.values()) {
        if (el.src) assert.ok(el.src.startsWith(`${prefix}/static/images/`), el.src);
      }
      if (game.finish) assert.equal(context.window.location.href, `${prefix}/`);
    });
  }
}
