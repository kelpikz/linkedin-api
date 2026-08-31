export type ProfileError =
	| { type: "invalid_url"; message: string }
	| { type: "profile_not_found"; message: string }
	| { type: "linkedin_rate_limited"; message: string; retryAfter?: number }
	| { type: "linkedin_auth_expired"; message: string }
	| { type: "linkedin_challenge"; message: string }
	| { type: "upstream_unavailable"; message: string; status?: number };

export type ProfileResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: ProfileError };

export class LinkedInRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "LinkedInRequestError";
	}
}

export class InvalidProfileUrlError extends Error {
	constructor(message = "url must be a LinkedIn profile URL") {
		super(message);
		this.name = "InvalidProfileUrlError";
	}
}
