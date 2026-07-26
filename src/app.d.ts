import type { createAuth } from '$lib/server/auth';

type AuthInstance = ReturnType<typeof createAuth>;
type AuthSession = AuthInstance['$Infer']['Session'];

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			user?: AuthSession['user'];
			session?: AuthSession['session'];
			auth: AuthInstance;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
