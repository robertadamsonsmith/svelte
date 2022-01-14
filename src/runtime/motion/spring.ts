import { Readable, writable } from 'svelte/store';
import { loop, now, Task } from 'svelte/internal';
import { is_date } from './utils';

interface TickContext<T> {
	inv_mass: number;
	dt: number;
	opts: Spring<T>;
	settled: boolean;
}

function tick_spring<T>(ctx: TickContext<T>, last_value: T, current_value: T, target_value: T): T {
	if (typeof current_value === 'number' || is_date(current_value)) {
		// @ts-ignore
		const delta = target_value - current_value;
		// @ts-ignore
		const velocity = (current_value - last_value) / (ctx.dt || 1 / 60); // guard div by 0
		const spring = ctx.opts.stiffness * delta;
		const damper = ctx.opts.damping * velocity;
		let acceleration = (spring - damper) * ctx.inv_mass;

		//console.log({delta, velocity, spring, damper, acceleration})

		/*
		delta is pixels
		velocity is pixels per frame (17ms)
		spring is pixels per frame per frame (acceleration)   (a force proportional to distance from target)
		damper is pixels per frame per frame (acceleration)   (a force proportional to velocity)


		a damping of 1 will remove all velocity in 1 frame
		a damping of 0 will never decelerate (so velocity w)

		a stiffness of 0 will never increase from 0
		a stiffness of 1 will jump from 0 to target in 1 frame

		For 100 diff:
			spring is 100*0.15 = 15
			damping is 0.8*velocity
			so terminal speed (at which damping = spring) = 15/0.8 = 18.75

		damping is the percentage of velocity that is 

		velocity += acceleration * ctx.dt
		d = velocity * ctx.dt

		dt is in frames (1/60s long each = ~17ms)

		with a*=dt:
		11.1917 - 11.2482

		without a*=dt:
		11.3069 - 11.2972

		fot defaults:
		without dt:
		67.7526 69.8029

		with dt:
		66.5355 69.6538

		for no damping:

		without dt:
		199.47 201.12

		with dt:
		169.23 177.26
		*/
		//acceleration *= ctx.dt;

		const d = (velocity + acceleration) * ctx.dt;

		if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
			return target_value; // settled
		} else {
			ctx.settled = false; // signal loop to keep ticking
			// @ts-ignore
			return is_date(current_value) ?
				new Date(current_value.getTime() + d) : current_value + d;
		}
	} else if (Array.isArray(current_value)) {
		// @ts-ignore
		return current_value.map((_, i) =>
			tick_spring(ctx, last_value[i], current_value[i], target_value[i]));
	} else if (typeof current_value === 'object') {
		const next_value = {};
		for (const k in current_value) {
			// @ts-ignore
			next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
		}
		// @ts-ignore
		return next_value;
	} else {
		throw new Error(`Cannot spring ${typeof current_value} values`);
	}
}

interface SpringOpts {
	stiffness?: number;
	damping?: number;
	precision?: number;
}

interface SpringUpdateOpts {
	hard?: any;
	soft?: string | number | boolean;
}

type Updater<T> = (target_value: T, value: T) => T;

export interface Spring<T> extends Readable<T>{
	set: (new_value: T, opts?: SpringUpdateOpts) => Promise<void>;
	update: (fn: Updater<T>, opts?: SpringUpdateOpts) => Promise<void>;
	precision: number;
	damping: number;
	stiffness: number;
}

export function spring<T=any>(value?: T, opts: SpringOpts = {}): Spring<T> {
	const store = writable(value);
	const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;

	//for per second: const { stiffness = 9, damping = 480, precision = 0.01 } = opts;

	//for framer motion: stiffness = 100, damping = 10

	let last_time: number;
	let task: Task;
	let current_token: object;
	let last_value: T = value;
	let target_value: T = value;

	let inv_mass = 1;
	let inv_mass_recovery_rate = 0;
	let cancel_task = false;

	function set(new_value: T, opts: SpringUpdateOpts = {}): Promise<void> {
		target_value = new_value;
		const token = current_token = {};

		if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
			cancel_task = true; // cancel any running animation
			last_time = now();
			last_value = new_value;
			store.set(value = target_value);
			return Promise.resolve();
		} else if (opts.soft) {
			const rate = opts.soft === true ? .5 : +opts.soft;
			inv_mass_recovery_rate = 1 / (rate * 60);
			inv_mass = 0; // infinite mass, unaffected by spring forces
		}

		if (!task) {
			last_time = now();
			cancel_task = false;

			task = loop(now => {

				if (cancel_task) {
					cancel_task = false;
					task = null;
					return false;
				}

				inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);

				const ctx: TickContext<T> = {
					inv_mass,
					opts: spring,
					settled: true, // tick_spring may signal false
					dt: (now - last_time) * 60 / 1000
				};
				const next_value = tick_spring(ctx, last_value, value, target_value);

				last_time = now;
				last_value = value;
				store.set(value = next_value);

				if (ctx.settled) {
					task = null;
				}
				return !ctx.settled;
			});
		}

		return new Promise(fulfil => {
			task.promise.then(() => {
				if (token === current_token) fulfil();
			});
		});
	}

	const spring: Spring<T> = {
		set,
		update: (fn, opts: SpringUpdateOpts) => set(fn(target_value, value), opts),
		subscribe: store.subscribe,
		stiffness,
		damping,
		precision
	};

	return spring;
}