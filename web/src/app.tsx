import {
	ArrowRight,
	ExternalLink,
	Eye,
	EyeOff,
	LoaderCircle,
	Search,
	UserRoundSearch,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type {
	Profile,
	ProfileSearchResponse,
} from "../../src/core/schema.ts";
import { loadProfile, profileImageSource, searchProfiles } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileView } from "@/profile-view";

/** Turns unknown request failures into one message suitable for the form. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "The request failed. Try again.";
}

/** Reads the shared API key from a URL query string. */
export function apiKeyFromSearch(search: string): string {
	return new URLSearchParams(search).get("apiKey") ?? "";
}

function initialApiKey(): string {
	return typeof window === "undefined" ? "" : apiKeyFromSearch(window.location.search);
}

interface ProfileSearchResultsProps {
	response: ProfileSearchResponse;
	busy: boolean;
	onSelect(url: string): void;
}

/** Shows each search match with its LinkedIn image when one was returned. */
export function ProfileSearchResults({
	response,
	busy,
	onSelect,
}: ProfileSearchResultsProps) {
	return (
		<div className="mt-4 border-t border-ink/10 pt-4" aria-live="polite">
			<p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
				{response.count === 0
					? "No profiles found"
					: `${response.count} ${response.count === 1 ? "profile" : "profiles"} found`}
			</p>
			{response.results.length ? (
				<ul className="mt-2 space-y-2">
					{response.results.map((result) => (
						<li key={result.url}>
							<button
								className="group flex w-full items-center gap-3 rounded-xl border border-ink/10 px-3 py-3 text-left transition hover:border-forest/30 hover:bg-canvas"
								type="button"
								onClick={() => onSelect(result.url)}
								disabled={busy}
							>
								{result.profileImageUrl ? (
									<img
										className="size-10 shrink-0 rounded-xl object-cover"
										src={profileImageSource(result.profileImageUrl)}
										alt={result.name}
										referrerPolicy="no-referrer"
									/>
								) : (
									<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest/8 text-sm font-semibold text-forest">
										{result.name.charAt(0).toUpperCase()}
									</span>
								)}
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-semibold">{result.name}</span>
									<span className="block truncate text-xs text-ink/45">linkedin.com/in/{result.vanityName}</span>
								</span>
								<ArrowRight className="size-4 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-forest" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

export function App() {
	const [apiKey, setApiKey] = useState(initialApiKey);
	const [showApiKey, setShowApiKey] = useState(false);
	const [lookupMode, setLookupMode] = useState<"search" | "url">("search");
	const [query, setQuery] = useState("");
	const [url, setUrl] = useState("");
	const [searchResponse, setSearchResponse] =
		useState<ProfileSearchResponse | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [searching, setSearching] = useState(false);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const busy = searching || loadingProfile;

	/** Loads details only after the user chooses a result or submits a URL. */
	async function openProfile(profileUrl: string) {
		const key = apiKey.trim();
		if (!key) {
			setError("Enter the API key.");
			return;
		}

		setLoadingProfile(true);
		setError(null);
		try {
			setProfile(await loadProfile(profileUrl, key));
		} catch (requestError) {
			setError(errorMessage(requestError));
		} finally {
			setLoadingProfile(false);
		}
	}

	/** Searches for matches without making any profile-detail calls. */
	async function submitSearch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const key = apiKey.trim();
		if (!key) {
			setError("Enter the API key.");
			return;
		}
		const value = query.trim();
		if (!value) {
			setError("Enter a name to search.");
			return;
		}

		setSearching(true);
		setError(null);
		setSearchResponse(null);
		try {
			setSearchResponse(await searchProfiles(value, key));
		} catch (requestError) {
			setError(errorMessage(requestError));
		} finally {
			setSearching(false);
		}
	}

	/** Fetches one profile only after the user submits its URL. */
	async function submitUrl(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = url.trim();
		if (!value) {
			setError("Enter a LinkedIn profile URL.");
			return;
		}

		await openProfile(value);
	}

	return (
		<div className="min-h-screen bg-canvas text-ink">
			<header className="border-b border-ink/10 bg-canvas/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
					<a className="flex items-center gap-3 font-semibold tracking-tight" href="/">
						<span className="grid size-9 place-items-center rounded-xl bg-forest text-sm text-paper">
							PR
						</span>
						Profile Reader
					</a>
					<a
						className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-forest"
						href="/docs"
						target="_blank"
						rel="noreferrer"
					>
						API docs
						<ExternalLink className="size-3" aria-hidden="true" />
					</a>
					<a
						className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-forest"
						href="/health"
						target="_blank"
						rel="noreferrer"
					>
						API status
						<ExternalLink className="size-3" aria-hidden="true" />
					</a>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
				<section className="relative overflow-hidden rounded-[2rem] bg-forest px-5 py-7 text-paper sm:px-8 sm:py-9 lg:px-10">
					<div className="pointer-events-none absolute -right-28 -top-36 size-80 rounded-full border-[4rem] border-clay/20" />
					<div className="relative grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
						<div>
							<div className="inline-flex items-center gap-2 rounded-full border border-paper/15 bg-paper/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-paper/70">
								<UserRoundSearch className="size-3.5" aria-hidden="true" />
								Profile lookup
							</div>
							<h1 className="mt-5 max-w-lg font-display text-4xl leading-[1.02] tracking-[-0.035em] sm:text-5xl">
								Find a person. Read the complete profile.
							</h1>
							<p className="mt-4 max-w-lg text-sm leading-6 text-paper/65 sm:text-base">
								Search by name or paste a LinkedIn URL. Profile details load only after you choose a person.
							</p>
						</div>

						<div className="rounded-2xl bg-paper p-4 text-ink shadow-[0_24px_70px_-38px_rgba(0,0,0,0.65)] sm:p-5">
							<div className="mb-4 grid grid-cols-2 rounded-xl bg-canvas p-1" aria-label="Profile lookup method">
								<button
									className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${lookupMode === "search" ? "bg-paper text-forest shadow-sm" : "text-ink/50 hover:text-ink"}`}
									type="button"
									onClick={() => {
										setLookupMode("search");
										setError(null);
									}}
									aria-pressed={lookupMode === "search"}
								>
									Search by name
								</button>
								<button
									className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${lookupMode === "url" ? "bg-paper text-forest shadow-sm" : "text-ink/50 hover:text-ink"}`}
									type="button"
									onClick={() => {
										setLookupMode("url");
										setError(null);
									}}
									aria-pressed={lookupMode === "url"}
								>
									Use profile URL
								</button>
							</div>

							<form
								onSubmit={lookupMode === "search" ? submitSearch : submitUrl}
								aria-busy={busy}
							>
								<div className="mb-4">
									<label className="text-sm font-semibold" htmlFor="api-key">
										API key
									</label>
									<div className="relative mt-2.5">
										<Input
											className="pr-12"
											id="api-key"
											type={showApiKey ? "text" : "password"}
											value={apiKey}
											onChange={(event) => setApiKey(event.target.value)}
											autoComplete="off"
											spellCheck={false}
											disabled={busy}
											required
										/>
										<button
											className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/45 transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
											type="button"
											onClick={() => setShowApiKey((visible) => !visible)}
											aria-label={showApiKey ? "Hide API key" : "Show API key"}
											aria-pressed={showApiKey}
											disabled={busy}
										>
											{showApiKey ? (
												<EyeOff className="size-5" aria-hidden="true" />
											) : (
												<Eye className="size-5" aria-hidden="true" />
											)}
										</button>
									</div>
									<p className="mt-2 text-xs leading-5 text-ink/45">
										Kept in this page only and cleared when you refresh or close it.
									</p>
								</div>
								<label className="text-sm font-semibold" htmlFor="profile-lookup">
									{lookupMode === "search"
										? "Search LinkedIn profiles"
										: "LinkedIn profile URL"}
								</label>
								<div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
									<Input
										id="profile-lookup"
										type={lookupMode === "search" ? "search" : "url"}
										value={lookupMode === "search" ? query : url}
										onChange={(event) =>
											lookupMode === "search"
												? setQuery(event.target.value)
												: setUrl(event.target.value)
										}
										placeholder={lookupMode === "search" ? "Satya Nadella" : "https://www.linkedin.com/in/satyanadella/"}
										autoComplete={lookupMode === "search" ? "off" : "url"}
										disabled={busy}
										required
									/>
									<Button
										className="h-12 shrink-0 px-5"
										type="submit"
										disabled={busy}
									>
										{busy ? (
											<LoaderCircle className="animate-spin" aria-hidden="true" />
										) : (
											<Search aria-hidden="true" />
										)}
										{searching
											? "Searching"
											: loadingProfile
												? "Loading profile"
												: lookupMode === "search"
													? "Search profiles"
													: "View profile"}
									</Button>
								</div>
								{lookupMode === "url" ? (
									<p className="mt-2.5 text-xs leading-5 text-ink/45">
										Use a complete LinkedIn <span className="font-mono">/in/</span> or <span className="font-mono">/pub/</span> URL.
									</p>
								) : null}
							</form>

							{lookupMode === "search" && searchResponse ? (
								<ProfileSearchResults
									response={searchResponse}
									busy={busy}
									onSelect={openProfile}
								/>
							) : null}

							{error ? (
								<p
									className="mt-3 rounded-xl bg-clay/10 px-3 py-2.5 text-sm text-clay"
									role="alert"
								>
									{error}
								</p>
							) : null}
						</div>
					</div>
				</section>

				{profile ? (
					<ProfileView profile={profile} />
				) : (
					<section className="mt-8 grid gap-4 rounded-3xl border border-ink/10 bg-paper p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
						<div className="grid size-12 place-items-center rounded-2xl bg-forest/8 text-forest">
							<UserRoundSearch className="size-5" aria-hidden="true" />
						</div>
						<div>
							<h2 className="font-display text-2xl">The full profile appears here</h2>
							<p className="mt-1 text-sm leading-6 text-ink/55">
								Every returned section stays in one view. Extraction gaps are called out instead of being hidden.
							</p>
						</div>
					</section>
				)}
			</main>
		</div>
	);
}
