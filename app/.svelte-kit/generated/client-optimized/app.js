export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25'),
	() => import('./nodes/26'),
	() => import('./nodes/27'),
	() => import('./nodes/28'),
	() => import('./nodes/29'),
	() => import('./nodes/30'),
	() => import('./nodes/31')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/appendix/distributions": [3],
		"/part-1/chapter-1": [4],
		"/part-1/chapter-2": [5],
		"/part-1/chapter-3": [6],
		"/part-1/chapter-4": [7],
		"/part-1/chapter-5": [8],
		"/part-1/chapter-6": [9],
		"/part-2/chapter-10": [10],
		"/part-2/chapter-11": [11],
		"/part-2/chapter-7": [12],
		"/part-2/chapter-8": [13],
		"/part-2/chapter-9": [14],
		"/part-3/chapter-12": [15],
		"/part-3/chapter-13": [16],
		"/part-3/chapter-14": [17],
		"/part-3/chapter-15": [18],
		"/part-4/chapter-16": [19],
		"/part-4/chapter-17": [20],
		"/part-4/chapter-18": [21],
		"/part-4/chapter-19": [22],
		"/part-4/chapter-20": [23],
		"/part-4/chapter-21": [24],
		"/part-4/chapter-22": [25],
		"/part-5/chapter-23": [26],
		"/part-5/chapter-24": [27],
		"/part-5/chapter-25": [28],
		"/part-5/chapter-26": [29],
		"/part-5/chapter-27": [30],
		"/part-5/chapter-28": [31]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';