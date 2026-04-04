import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;
type RouteParams = {  };
type RouteId = '/';
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
export type Snapshot<T = any> = Kit.Snapshot<T>;
type PageParentData = EnsureDefined<LayoutData>;
type LayoutRouteId = RouteId | "/" | "/appendix/distributions" | "/part-1/chapter-1" | "/part-1/chapter-2" | "/part-1/chapter-3" | "/part-1/chapter-4" | "/part-1/chapter-5" | "/part-1/chapter-6" | "/part-2/chapter-10" | "/part-2/chapter-11" | "/part-2/chapter-7" | "/part-2/chapter-8" | "/part-2/chapter-9" | "/part-3/chapter-12" | "/part-3/chapter-13" | "/part-3/chapter-14" | "/part-3/chapter-15" | "/part-4/chapter-16" | "/part-4/chapter-17" | "/part-4/chapter-18" | "/part-4/chapter-19" | "/part-4/chapter-20" | "/part-4/chapter-21" | "/part-4/chapter-22" | "/part-5/chapter-23" | "/part-5/chapter-24" | "/part-5/chapter-25" | "/part-5/chapter-26" | "/part-5/chapter-27" | "/part-5/chapter-28" | null
type LayoutParams = RouteParams & {  }
type LayoutParentData = EnsureDefined<{}>;

export type PageServerData = null;
export type PageData = Expand<PageParentData>;
export type PageProps = { params: RouteParams; data: PageData }
export type LayoutServerData = null;
export type LayoutData = Expand<LayoutParentData>;
export type LayoutProps = { params: LayoutParams; data: LayoutData; children: import("svelte").Snippet }