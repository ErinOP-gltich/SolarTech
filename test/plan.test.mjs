// Run: node test/plan.test.mjs. The road planner's picks for a few everyday roads.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ['assets/js/products.js', 'assets/js/plan.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const { plan, summary } = ctx.window.GSPlan;
const lights = ctx.window.GS_PRODUCTS.filter(p => /^si-\d+w$/.test(p.id));
const go = i => plan(i, lights);

let r = go({ length: 500, lanes: 1, road: 'village' });            // a village lane: the 10 m standard, one side
assert.equal(r.arrangement, 'one'); assert.equal(r.watt, 9); assert.equal(r.spacing, 10); assert.equal(r.poles, 51); assert.ok(r.bright && r.reach);
r = go({ length: 500, lanes: 2, road: 'village' });                 // two lanes: one side still, a taller pole
assert.equal(r.arrangement, 'one'); assert.equal(r.height, 6); assert.ok(r.bright && r.reach);
r = go({ length: 1000, lanes: 4, road: 'highway' });                // four-lane highway: both sides, big lights
assert.notEqual(r.arrangement, 'one'); assert.ok(r.watt >= 60 && r.bright && r.reach, summary(r));
r = go({ length: 500, lanes: 4, road: 'main', arrangement: 'one' });  // forced one side on 4 lanes: warned
assert.equal(r.arrangement, 'one'); assert.equal(r.reach, false); assert.match(r.notes[0], /far side/);
r = go({ length: 100, lanes: 2, road: 'street', arrangement: 'zigzag', spacing: 20 });
assert.equal(r.spacing, 20); assert.equal(r.sideA, 6); assert.equal(r.sideB, 5); assert.equal(r.poles, 11);
assert.equal(go({ length: 'x', lanes: 99, road: 'nope' }).lanes, 8); // junk input is clamped, not thrown
console.log('plan: ok —', summary(go({ length: 500, lanes: 2, road: 'main' })));
