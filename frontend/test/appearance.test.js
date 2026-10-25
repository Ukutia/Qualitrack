import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, readAppearance, resolveTheme } from '../src/lib/appearance.js';

test('recupera preferencias válidas y se adapta al tema del sistema', () => {
  assert.deepEqual(readAppearance({ getItem: () => '{"theme":"dark","textSize":125}' }), { theme: 'dark', textSize: 125 });
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
});
test('almacenamiento bloqueado o inválido permite abrir la aplicación con valores seguros', () => {
  assert.deepEqual(readAppearance({ getItem() { throw new Error('Blocked'); } }), { theme: 'system', textSize: 100 });
  assert.deepEqual(readAppearance({ getItem: () => 'not JSON' }), { theme: 'system', textSize: 100 });
  assert.deepEqual(normalizeAppearance({ theme: 'invalid', textSize: NaN }), { theme: 'system', textSize: 100 });
});
test('el tamaño de texto respeta los límites incluyendo ampliación al 125%', () => {
  assert.equal(normalizeAppearance({ textSize: 900 }).textSize, 125);
  assert.equal(normalizeAppearance({ textSize: 20 }).textSize, 87.5);
});
