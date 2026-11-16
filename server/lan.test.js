import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedHostSet, foreignWhy, publicLink, LOOPBACK } from './lan.js';

const req = (headers, method = 'GET') => ({ method, headers });
const lan = { allowed: allowedHostSet(['192.168.1.50', 'Ubuntu-Server']), port: 7788 };

test('an allowed LAN host may use the hub, also for writes from its own origin', () => {
  assert.equal(foreignWhy(req({ host: '192.168.1.50:7788', 'sec-fetch-site': 'same-origin' }), lan), null);
  assert.equal(foreignWhy(req({ host: 'ubuntu-server:7788', origin: 'http://ubuntu-server:7788', 'sec-fetch-site': 'same-origin' }, 'POST'), lan), null);
  assert.equal(foreignWhy(req({ host: '127.0.0.1:7788' }, 'POST'), lan), null);   // the MCP tools: no Origin
});

test('a host that is not allowed is refused, and so is a write from another origin or port', () => {
  assert.equal(foreignWhy(req({ host: '192.168.1.99:7788' }), lan), 'host');
  assert.equal(foreignWhy(req({ host: '192.168.1.50:7788' }), { allowed: LOOPBACK, port: 7788 }), 'host');   // default: loopback only
  assert.equal(foreignWhy(req({ host: '192.168.1.50:7788', origin: 'http://evil.example' }, 'POST'), lan), 'origin');
  assert.equal(foreignWhy(req({ host: '192.168.1.50:7788', origin: 'http://192.168.1.50:9999' }, 'POST'), lan), 'origin');
  assert.equal(foreignWhy(req({ host: '192.168.1.50:7788', 'sec-fetch-site': 'cross-site' }), lan), 'site');
  assert.equal(allowedHostSet('oops').size, LOOPBACK.size);
});

test('publicLink builds the LAN link only from an http(s) publicUrl', () => {
  assert.equal(publicLink('http://192.168.1.50:7788/', '#/review/abc/~live'), 'http://192.168.1.50:7788/#/review/abc/~live');
  assert.equal(publicLink(null, '#/x'), null);
  assert.equal(publicLink('javascript:alert(1)', '#/x'), null);
});
