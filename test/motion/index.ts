import * as assert from 'assert';
import { get } from '../../store';
import { spring, tweened } from '../../motion';
import { now, raf, set_now, set_raf } from '../../internal';


describe('motion', () => {
	describe('spring', () => {
		let now_value = 0;
		let raf_callbacks = [];
		function af(duration, repeat = 1) {
			for ( let i = 0; i < repeat; ++i ) {
				const cb = raf_callbacks;
				now_value += duration;
				raf_callbacks = [];
				cb.forEach( c => c( now_value ) );
			}
		}

		before('patch internal.raf() and internal.now()', () => {
			set_now( () => now_value );
			set_raf( v => raf_callbacks.push(v) );
		});

		after('unpatch', () => {
			set_now( now );
			set_raf( raf );
		});

		it('handles initially undefined values', () => {
			const size = spring();
			size.set(100);
			assert.equal(get(size), 100);
		});

		/*
		it('changes when not at rest', () => {
			const v = spring(0);
			v.set(100);
			af(50);
			assert.notEqual(get(v), 100);
		});

		it('will not change during a 0ms duration frame', () => { //fixed!
			const v = spring(0);
			v.set(100);
			af(10);
			const v1 = get(v);
			af(0);
			const v2 = get(v);
			assert.equal(v1, v2);
		});
*/
		//will accelerate towards target

		//will accelerate proportionally to distance from target

		it('when undamped will not be dependent on frame rate (frame length less than config.tick=17)', () => {  //fix

			let v = spring(0, {damping:0});
			v.set(100);
			af(1, 20);
			const v1 = get(v);

			v = spring(0, {damping:0});
			v.set(100);
			af(2, 10);
			const v2 = get(v);

			console.log(v1, v2)

			assert.ok(v2 / v1 > 0.95, 'decreased too much');
			assert.ok(v2 / v1 < 1.05, 'increased too much');
		})

		it('will not be significantly effected by a slightly different frame rate (frame length less than config.tick=17)', () => {  //fix
			//let v = spring(0, {damping:0});
			//let v = spring(0);
			let v = spring(0, {damping:0.4, stiffness:0.02});
			v.set(100);
			for(let i=0; i<20; ++i){
				af(1000/60);
				//console.log(`${i} x 1 = ${get(v)}`)
				console.log(`${get(v)}`)
			}
			//af(1, 10);
			const v1 = get(v);

			//v = spring(0, {damping:0});
			//v = spring(0);
			v = spring(0, {damping:0});
			v.set(100);

			for(let i=0; i<10; ++i){
				af(2);
				console.log(`${i} x 2 = ${get(v)}`)
				//console.log(`${i}`)
			}
			//af(2, 5);
			const v2 = get(v);

			console.log(v1, v2);

			assert.ok(v2 / v1 > 0.90, 'decreased too much');
			assert.ok(v2 / v1 < 1.10, 'increased too much');
		});
/*
		it('will not be significantly effected by a medium change in frame rate (frame length between config.tick=17 and config.limit=1000)', () => {  //fix
			let v = spring(0, {stiffness:0.001, tick:17});
			v.set(100);
			af(17, 25);
			const v1 = get(v);
			
			v = spring(0, {stiffness:0.001, tick:17});
			v.set(100);
			af(85, 5);
			const v2 = get(v);
			
			assert.ok(v1 == v2);
		});
		
		it('will limit the computed elapsed time to config.limit for large frame length increases (over config.limit=1000)', () => {
			let v = spring(0, {stiffness:0.001, tick:17, limit:10});
			v.set(100);
			af(10000);
			const v1 = get(v);

			v = spring(0, {stiffness:0.001, tick:17, limit:10});
			v.set(100);
			af(170);
			const v2 = get(v);

			assert.ok(v1 == v2);
		});
				
		it('will not significantly change in accuracy when the frame length fluctuates', () => {  //fix
			let v = spring(0, {stiffness:0.001});
			v.set(100);
			for (let i = 0; i < 20; ++i) {
				af(2);
				af(8);
			}
			const v1 = get(v);

			v = spring(0, {stiffness:0.001});
			v.set(100);
			for (let i = 0; i < 20; ++i) {
				af(10);
			}
			const v2 = get(v);

			assert.ok(v2 / v1 > 0.9, 'decreased too much');
			assert.ok(v2 / v1 < 1.1, 'increased too much');
		});
*/

	});

	describe('tweened', () => {
		it('handles initially undefined values', () => {
			const size = tweened();

			size.set(100);
			assert.equal(get(size), 100);
		});

		it('sets immediately when duration is 0', () => {
			const size = tweened(0);

			size.set(100, { duration : 0 });
			assert.equal(get(size), 100);
		});
	});
});
