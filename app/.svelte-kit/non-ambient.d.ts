
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/appendix" | "/appendix/distributions" | "/appendix/{distributions,inequalities,notation}" | "/part-1" | "/part-1/chapter-1" | "/part-1/chapter-2" | "/part-1/chapter-3" | "/part-1/chapter-4" | "/part-1/chapter-5" | "/part-1/chapter-6" | "/part-1/chapter-{2,3,4,5,6}" | "/part-2" | "/part-2/chapter-10" | "/part-2/chapter-11" | "/part-2/chapter-7" | "/part-2/chapter-8" | "/part-2/chapter-9" | "/part-2/chapter-{7,8,9,10,11}" | "/part-3" | "/part-3/chapter-12" | "/part-3/chapter-13" | "/part-3/chapter-14" | "/part-3/chapter-15" | "/part-3/chapter-{12,13,14,15}" | "/part-4" | "/part-4/chapter-16" | "/part-4/chapter-17" | "/part-4/chapter-18" | "/part-4/chapter-19" | "/part-4/chapter-20" | "/part-4/chapter-21" | "/part-4/chapter-22" | "/part-4/chapter-{16,17,18,19,20,21,22}" | "/part-5" | "/part-5/chapter-23" | "/part-5/chapter-24" | "/part-5/chapter-25" | "/part-5/chapter-26" | "/part-5/chapter-27" | "/part-5/chapter-28" | "/part-5/chapter-{23,24,25,26,27,28}";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/appendix": Record<string, never>;
			"/appendix/distributions": Record<string, never>;
			"/appendix/{distributions,inequalities,notation}": Record<string, never>;
			"/part-1": Record<string, never>;
			"/part-1/chapter-1": Record<string, never>;
			"/part-1/chapter-2": Record<string, never>;
			"/part-1/chapter-3": Record<string, never>;
			"/part-1/chapter-4": Record<string, never>;
			"/part-1/chapter-5": Record<string, never>;
			"/part-1/chapter-6": Record<string, never>;
			"/part-1/chapter-{2,3,4,5,6}": Record<string, never>;
			"/part-2": Record<string, never>;
			"/part-2/chapter-10": Record<string, never>;
			"/part-2/chapter-11": Record<string, never>;
			"/part-2/chapter-7": Record<string, never>;
			"/part-2/chapter-8": Record<string, never>;
			"/part-2/chapter-9": Record<string, never>;
			"/part-2/chapter-{7,8,9,10,11}": Record<string, never>;
			"/part-3": Record<string, never>;
			"/part-3/chapter-12": Record<string, never>;
			"/part-3/chapter-13": Record<string, never>;
			"/part-3/chapter-14": Record<string, never>;
			"/part-3/chapter-15": Record<string, never>;
			"/part-3/chapter-{12,13,14,15}": Record<string, never>;
			"/part-4": Record<string, never>;
			"/part-4/chapter-16": Record<string, never>;
			"/part-4/chapter-17": Record<string, never>;
			"/part-4/chapter-18": Record<string, never>;
			"/part-4/chapter-19": Record<string, never>;
			"/part-4/chapter-20": Record<string, never>;
			"/part-4/chapter-21": Record<string, never>;
			"/part-4/chapter-22": Record<string, never>;
			"/part-4/chapter-{16,17,18,19,20,21,22}": Record<string, never>;
			"/part-5": Record<string, never>;
			"/part-5/chapter-23": Record<string, never>;
			"/part-5/chapter-24": Record<string, never>;
			"/part-5/chapter-25": Record<string, never>;
			"/part-5/chapter-26": Record<string, never>;
			"/part-5/chapter-27": Record<string, never>;
			"/part-5/chapter-28": Record<string, never>;
			"/part-5/chapter-{23,24,25,26,27,28}": Record<string, never>
		};
		Pathname(): "/" | "/appendix/distributions" | "/part-1/chapter-1" | "/part-1/chapter-2" | "/part-1/chapter-3" | "/part-1/chapter-4" | "/part-1/chapter-5" | "/part-1/chapter-6" | "/part-2/chapter-10" | "/part-2/chapter-11" | "/part-2/chapter-7" | "/part-2/chapter-8" | "/part-2/chapter-9" | "/part-3/chapter-12" | "/part-3/chapter-13" | "/part-3/chapter-14" | "/part-3/chapter-15" | "/part-4/chapter-16" | "/part-4/chapter-17" | "/part-4/chapter-18" | "/part-4/chapter-19" | "/part-4/chapter-20" | "/part-4/chapter-21" | "/part-4/chapter-22" | "/part-5/chapter-23" | "/part-5/chapter-24" | "/part-5/chapter-25" | "/part-5/chapter-26" | "/part-5/chapter-27" | "/part-5/chapter-28";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}