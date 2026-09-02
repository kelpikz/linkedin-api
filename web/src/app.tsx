import {
	ArrowLeft,
	ArrowRight,
	ExternalLink,
	Eye,
	EyeOff,
	LoaderCircle,
	Search,
	UserRoundSearch,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
	selectedUrl?: string | null;
	onSelect(url: string): void;
}

interface ProfileRevealTarget {
	focus(options?: FocusOptions): void;
	scrollIntoView(options?: boolean | ScrollIntoViewOptions): void;
}

/** Moves keyboard and visual context to a profile after it loads. */
export function revealProfile(
	target: ProfileRevealTarget | null,
	reducedMotion = false,
) {
	if (!target) return;
	target.focus({ preventScroll: true });
	target.scrollIntoView({
		behavior: reducedMotion ? "auto" : "smooth",
		block: "start",
	});
}

/** Shows each search match with its LinkedIn image when one was returned. */
export function ProfileSearchResults({
	response,
	busy,
	selectedUrl = null,
	onSelect,
}: ProfileSearchResultsProps) {
	return (
		<div className="mt-5 border-t border-ink/10 pt-5" aria-live="polite">
			<p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/45">
				{response.count === 0
					? "No profiles found"
					: `${response.count} ${response.count === 1 ? "profile" : "profiles"} found`}
			</p>
			{response.results.length ? (
				<ul className="mt-3 space-y-2">
					{response.results.map((result) => {
						const selected = result.url === selectedUrl;
						return (
							<li key={result.url}>
								<button
									className="group flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-canvas/45 px-3 py-3 text-left transition hover:border-sky-deep/30 hover:bg-sky-soft/55"
									type="button"
									onClick={() => onSelect(result.url)}
									disabled={busy}
									aria-busy={selected}
								>
									{result.profileImageUrl ? (
										<img
											className="size-10 shrink-0 rounded-full object-cover"
											src={profileImageSource(result.profileImageUrl)}
											alt={result.name}
											referrerPolicy="no-referrer"
										/>
									) : (
										<span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-soft text-sm font-semibold text-ink">
											{result.name.charAt(0).toUpperCase()}
										</span>
									)}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold">
											{result.name}
										</span>
										<span className="block truncate text-xs text-ink/45">
											{selected
												? "Loading profile..."
												: `linkedin.com/in/${result.vanityName}`}
										</span>
									</span>
									{selected ? (
										<LoaderCircle
											className="size-4 shrink-0 animate-spin text-ink/45"
											aria-hidden="true"
										/>
									) : (
										<ArrowRight
											className="size-4 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink"
											aria-hidden="true"
										/>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			) : null}
		</div>
	);
}

function ProfileReaderMark() {
	return (
		<span className="flex items-center gap-2.5">
			<svg
				className="h-4 w-5"
				viewBox="0 0 24 18"
				fill="none"
				aria-hidden="true"
			>
				<path d="M2 4.5 9 1l4.5 4.5-7 3.5L2 4.5Z" fill="#ff7657" />
				<path d="m6.5 9 7-3.5 4.5 4.5-7 3.5L6.5 9Z" fill="#327fdb" />
				<path d="m11 13.5 7-3.5 4 4-7 3.5-4-4Z" fill="#37a078" />
			</svg>
			<span className="text-[1.05rem] font-semibold tracking-[-0.035em]">Profile reader</span>
		</span>
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
	const [loadingProfileUrl, setLoadingProfileUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const profileTargetRef = useRef<HTMLDivElement>(null);
	const busy = searching || loadingProfile;

	useEffect(() => {
		if (!profile) return;
		const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		revealProfile(profileTargetRef.current, reducedMotion);
	}, [profile]);

	/** Loads details only after the user chooses a result or submits a URL. */
	async function openProfile(profileUrl: string) {
		const key = apiKey.trim();
		if (!key) {
			setError("Enter the API key.");
			return;
		}

		setLoadingProfile(true);
		setLoadingProfileUrl(profileUrl);
		setError(null);
		try {
			setProfile(await loadProfile(profileUrl, key));
		} catch (requestError) {
			setError(errorMessage(requestError));
		} finally {
			setLoadingProfile(false);
			setLoadingProfileUrl(null);
		}
	}

	function returnToSearch() {
		setProfile(null);
		window.requestAnimationFrame(() => {
			const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
			window.scrollTo({
				top: 0,
				behavior: reducedMotion ? "auto" : "smooth",
			});
		});
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
		<div className="site-shell relative flex min-h-screen flex-col overflow-hidden bg-canvas text-ink">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[52rem] overflow-hidden" aria-hidden="true">
				<div className="cloud cloud-left" />
				<div className="cloud cloud-right" />
				<div className="orbital-dot left-[7%] top-[26rem]" />
				<div className="orbital-dot right-[9%] top-[31rem]" />
			</div>

			<header className="relative z-10">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
					<a className="rounded-full px-1 py-2 text-ink" href="/">
						<ProfileReaderMark />
					</a>
					<nav className="flex items-center gap-1 sm:gap-3" aria-label="Utility navigation">
						<a
							className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/65 transition hover:text-ink sm:inline-flex"
							href="/docs"
							target="_blank"
							rel="noreferrer"
						>
							API docs
						</a>
						<a
							className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-ink/85"
							href="/health"
							target="_blank"
							rel="noreferrer"
						>
							API status
							<ExternalLink className="size-3" aria-hidden="true" />
						</a>
					</nav>
				</div>
			</header>

			<main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pb-14 sm:px-8 sm:pb-20 lg:px-10">
				{profile ? (
					<div
						ref={profileTargetRef}
						className="scroll-mt-4 pt-5 outline-none sm:pt-8"
						tabIndex={-1}
						aria-label="Profile details"
					>
						<button
							className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-ink/65 backdrop-blur transition hover:bg-white hover:text-ink"
							type="button"
							onClick={returnToSearch}
						>
							<ArrowLeft className="size-4" aria-hidden="true" />
							Back to search
						</button>
						<ProfileView profile={profile} />
					</div>
				) : (
					<>
				<section className="pb-5 pt-12 text-center sm:pb-8 sm:pt-20">
					<div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3.5 py-2 text-xs font-medium text-ink/70 shadow-[0_2px_2px_-1px_rgba(42,51,70,0.06)] backdrop-blur">
						<UserRoundSearch className="size-3.5" aria-hidden="true" />
						Structured LinkedIn data
					</div>
					<h1 className="mx-auto mt-7 max-w-5xl font-display text-[clamp(3rem,7.6vw,6.5rem)] leading-[0.94] tracking-[-0.045em]">
						Turn a LinkedIn profile
						<span className="block italic">into structured data</span>
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-ink/60 sm:text-base sm:leading-7">
						Search by name or paste a profile URL. Details load after you choose a person, so every upstream call has a purpose.
					</p>

					<div className="mx-auto mt-10 max-w-3xl rounded-[1.5rem] border border-white/80 bg-white/90 p-4 text-left shadow-[0_28px_80px_-48px_rgba(28,45,67,0.5)] backdrop-blur sm:p-6">
						<div className="mb-5 grid grid-cols-2 rounded-full bg-canvas p-1" aria-label="Profile lookup method">
							<button
								className={`rounded-full px-3 py-2.5 text-sm font-medium transition ${lookupMode === "search" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"}`}
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
								className={`rounded-full px-3 py-2.5 text-sm font-medium transition ${lookupMode === "url" ? "bg-ink text-white shadow-sm" : "text-ink/50 hover:text-ink"}`}
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
							<div className="mb-5">
								<label className="text-sm font-medium" htmlFor="api-key">
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
							<label className="text-sm font-medium" htmlFor="profile-lookup">
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
										className="h-12 shrink-0 px-6"
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
								selectedUrl={loadingProfileUrl}
								onSelect={openProfile}
							/>
						) : null}

						{error ? (
							<p
								className="mt-4 rounded-2xl border border-alert/15 bg-alert/7 px-3.5 py-3 text-sm text-alert"
								role="alert"
							>
								{error}
							</p>
						) : null}
					</div>
				</section>

					<section className="mt-8 grid gap-8 overflow-hidden rounded-[1.75rem] bg-ink px-6 py-8 text-white sm:px-9 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:px-12 lg:py-12">
						<div>
							<p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">One clean view</p>
							<h2 className="mt-3 max-w-xl font-display text-4xl leading-[1.02] tracking-[-0.035em] sm:text-5xl">
								Every available profile section, together.
							</h2>
						</div>
						<div className="border-t border-white/15 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
							<p className="text-sm leading-6 text-white/60">
								Experience, education, skills, certifications, and languages stay in one readable profile. Extraction gaps remain visible.
							</p>
						</div>
					</section>
					</>
				)}
			</main>

			<footer className="relative z-10 bg-black text-white">
				<div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
					<ProfileReaderMark />
					<div className="flex items-center gap-5 text-xs text-white/50">
						<a className="transition hover:text-white" href="/docs" target="_blank" rel="noreferrer">
							API docs
						</a>
						<a className="transition hover:text-white" href="/health" target="_blank" rel="noreferrer">
							API status
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
