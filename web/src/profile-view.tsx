import {
	AlertTriangle,
	Award,
	BookOpen,
	BriefcaseBusiness,
	ExternalLink,
	Languages,
	MapPin,
	Sparkles,
	UserRound,
	type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
	Certification,
	Education,
	Experience,
	Language,
	Profile,
	ProfileSection,
} from "../../src/core/schema.ts";
import { profileImageSource } from "@/api";

const sectionLabels: Record<ProfileSection, string> = {
	identity: "Identity",
	about: "About",
	experience: "Experience",
	education: "Education",
	skills: "Skills",
	certifications: "Certifications",
	languages: "Languages",
};

interface ProfileViewProps {
	profile: Profile;
}

interface SectionProps {
	children: ReactNode;
	className?: string;
	icon: LucideIcon;
	title: string;
}

/** Keeps every profile section consistent without hiding empty data. */
function Section({ children, className = "", icon: Icon, title }: SectionProps) {
	return (
		<section
			className={`rounded-3xl border border-ink/10 bg-paper p-5 shadow-[0_20px_60px_-48px_rgba(22,60,54,0.55)] sm:p-7 ${className}`}
		>
			<div className="mb-5 flex items-center gap-3 border-b border-ink/10 pb-4">
				<span className="grid size-9 place-items-center rounded-xl bg-forest/8 text-forest">
					<Icon className="size-4.5" aria-hidden="true" />
				</span>
				<h3 className="font-display text-2xl tracking-[-0.02em]">{title}</h3>
			</div>
			{children}
		</section>
	);
}

/** Joins only present values so partial LinkedIn rows remain readable. */
function DetailLine({ values }: { values: Array<string | null> }) {
	const text = values.filter(Boolean).join(" · ");
	return text ? <p className="mt-1 text-sm leading-6 text-ink/55">{text}</p> : null;
}

function EmptySection() {
	return <p className="text-sm text-ink/45">No entries listed.</p>;
}

/** Renders all dates, durations, and locations returned for each role. */
function ExperienceList({ entries }: { entries: Experience[] | null }) {
	if (!entries?.length) return <EmptySection />;
	return (
		<ol className="space-y-5">
			{entries.map((entry, index) => (
				<li
					className="relative border-l border-clay/30 pl-5"
					key={`${entry.title}-${entry.company}-${index}`}
				>
					<span className="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 border-paper bg-clay" />
					<h4 className="font-semibold text-ink">{entry.title ?? "Untitled role"}</h4>
					<p className="mt-1 text-sm font-medium text-forest">
						{entry.company ?? "Company not listed"}
					</p>
					<DetailLine values={[entry.employmentType, entry.dateRange, entry.duration]} />
					<DetailLine values={[entry.location]} />
				</li>
			))}
		</ol>
	);
}

/** Renders each education record even when LinkedIn omits some fields. */
function EducationList({ entries }: { entries: Education[] | null }) {
	if (!entries?.length) return <EmptySection />;
	return (
		<ul className="space-y-5">
			{entries.map((entry, index) => (
				<li key={`${entry.school}-${index}`}>
					<h4 className="font-semibold">{entry.school ?? "School not listed"}</h4>
					<DetailLine values={[entry.degree, entry.field]} />
					<DetailLine values={[entry.dateRange]} />
				</li>
			))}
		</ul>
	);
}

/** Renders certification names with issuer and issue date when available. */
function CertificationList({ entries }: { entries: Certification[] | null }) {
	if (!entries?.length) return <EmptySection />;
	return (
		<ul className="space-y-5">
			{entries.map((entry, index) => (
				<li key={`${entry.name}-${index}`}>
					<h4 className="font-semibold">
						{entry.name ?? "Certification not listed"}
					</h4>
					<DetailLine values={[entry.issuer, entry.issueDate]} />
				</li>
			))}
		</ul>
	);
}

/** Keeps language proficiency attached to the matching language. */
function LanguageList({ entries }: { entries: Language[] | null }) {
	if (!entries?.length) return <EmptySection />;
	return (
		<ul className="grid gap-3 sm:grid-cols-2">
			{entries.map((entry, index) => (
				<li
					className="rounded-xl bg-canvas px-4 py-3"
					key={`${entry.name}-${index}`}
				>
					<p className="font-medium">{entry.name ?? "Language not listed"}</p>
					{entry.proficiency ? (
						<p className="mt-0.5 text-sm text-ink/55">{entry.proficiency}</p>
					) : null}
				</li>
			))}
		</ul>
	);
}

/** Displays the full response schema and calls out failed extraction. */
export function ProfileView({ profile }: ProfileViewProps) {
	const initials =
		profile.name
			?.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() ?? "PR";

	return (
		<div className="mt-8 space-y-6" aria-live="polite">
			<section className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-7 text-paper sm:px-8 sm:py-9">
				<div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full border-[3.5rem] border-paper/5" />
				<div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
					{profile.profileImageUrl ? (
						<img
							className="size-24 rounded-3xl border border-paper/15 object-cover shadow-xl sm:size-28"
							src={profileImageSource(profile.profileImageUrl)}
							alt={profile.name ? `${profile.name} profile` : "LinkedIn profile"}
							referrerPolicy="no-referrer"
						/>
					) : (
						<div className="grid size-24 place-items-center rounded-3xl bg-paper/10 font-display text-3xl sm:size-28">
							{initials}
						</div>
					)}
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/55">
							LinkedIn profile
						</p>
						<h2 className="mt-2 font-display text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">
							{profile.name ?? "Name unavailable"}
						</h2>
						{profile.headline ? (
							<p className="mt-3 max-w-3xl text-base leading-7 text-paper/75">
								{profile.headline}
							</p>
						) : null}
						<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-paper/60">
							{profile.location ? (
								<span className="inline-flex items-center gap-1.5">
									<MapPin className="size-4" aria-hidden="true" />
									{profile.location}
								</span>
							) : null}
							<a
								className="inline-flex items-center gap-1.5 underline decoration-paper/25 underline-offset-4 hover:text-paper"
								href={profile.sourceUrl}
								target="_blank"
								rel="noreferrer"
							>
								View source
								<ExternalLink className="size-3.5" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
			</section>

			{profile.meta.missing.length > 0 ? (
				<div
					className="flex gap-3 rounded-2xl border border-clay/25 bg-clay/8 px-4 py-3.5 text-sm text-ink"
					role="status"
				>
					<AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-clay" aria-hidden="true" />
					<p>
						{profile.meta.missing
							.map((section) => sectionLabels[section])
							.join(", ")} could not be extracted. The available sections are shown below.
					</p>
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-2">
				<Section className="lg:col-span-2" icon={UserRound} title="About">
					{profile.about ? (
						<p className="max-w-4xl whitespace-pre-line leading-7 text-ink/70">
							{profile.about}
						</p>
					) : (
						<EmptySection />
					)}
				</Section>

				<Section className="lg:col-span-2" icon={BriefcaseBusiness} title="Experience">
					<ExperienceList entries={profile.experience} />
				</Section>

				<Section icon={BookOpen} title="Education">
					<EducationList entries={profile.education} />
				</Section>

				<Section icon={Award} title="Certifications">
					<CertificationList entries={profile.certifications} />
				</Section>

				<Section className="lg:col-span-2" icon={Sparkles} title="Skills">
					{profile.skills?.length ? (
						<ul className="flex flex-wrap gap-2.5">
							{profile.skills.map((skill) => (
								<li
									className="rounded-full border border-forest/12 bg-forest/5 px-3.5 py-2 text-sm text-forest"
									key={skill}
								>
									{skill}
								</li>
							))}
						</ul>
					) : (
						<EmptySection />
					)}
				</Section>

				<Section className="lg:col-span-2" icon={Languages} title="Languages">
					<LanguageList entries={profile.languages} />
				</Section>
			</div>
		</div>
	);
}
