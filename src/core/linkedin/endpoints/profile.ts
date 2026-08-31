import type {
	LinkedInHttp,
	LinkedInPaginationBody,
	LinkedInPageContext,
	LinkedInPaginationRequest,
	LinkedInPrefetchBody,
} from "../http.ts";

const DETAIL_SCREEN_NAMES: Record<string, string> = {
	experience: "Experience",
	education: "Education",
	skills: "Skill",
	certifications: "Certification",
	languages: "Language",
};

function prefetchBody(payload: Record<string, unknown>): LinkedInPrefetchBody {
	return {
		requestedArguments: {
			payload,
			states: [],
			requestMetadata: { $type: "proto.sdui.common.RequestMetadata" },
			screenId: "",
			knownTemplateIds: [],
		},
		isPrefetch: true,
	};
}

/** Creates the parent span ID expected by LinkedIn's RSC action route. */
function parentSpanId(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString(
		"base64",
	);
}

export function fetchProfilePage(
	http: LinkedInHttp,
	vanityName: string,
	signal?: AbortSignal,
): Promise<string> {
	const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/`;
	return http.post({
		path,
		pageKey: "d_flagship3_profile_view_base",
		refererPath: path,
		body: prefetchBody({ vanityName, isVanityNameResolved: true }),
		signal,
	});
}

/** Fetches the rendered profile HTML used as the authoritative image source. */
export function fetchProfilePageHtml(
	http: LinkedInHttp,
	vanityName: string,
	signal?: AbortSignal,
): Promise<string> {
	if (!http.get) return Promise.reject(new Error("LinkedIn GET is unavailable"));
	const path = `/in/${encodeURIComponent(vanityName)}/`;
	return http.get({ path, refererPath: path, signal });
}

export function fetchProfileSection(
	http: LinkedInHttp,
	vanityName: string,
	section: string,
	signal?: AbortSignal,
	context?: LinkedInPageContext,
): Promise<string> {
	const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/details/${encodeURIComponent(section)}/`;
	return http.post({
		path,
		pageKey: `d_flagship3_profile_view_base_${section}_details`,
		refererPath: path,
		body: prefetchBody({
			vanityName,
			isVanityNameResolved: true,
			sectionType: section,
		}),
		signal,
		context,
	});
}

/** Sends the pagination request embedded in a profile detail response. */
export function fetchProfileSectionPage(
	http: LinkedInHttp,
	vanityName: string,
	section: string,
	paginationRequest: LinkedInPaginationRequest,
	signal?: AbortSignal,
	context?: LinkedInPageContext,
): Promise<string> {
	const { pagerId, requestedArguments } = paginationRequest;
	const actionUrl = new URL(
		"/flagship-web/rsc-action/actions/pagination",
		"https://www.linkedin.com",
	);
	actionUrl.searchParams.set("sduiid", pagerId);
	actionUrl.searchParams.set("parentSpanId", parentSpanId());
	const refererPath = `/in/${encodeURIComponent(vanityName)}/details/${encodeURIComponent(section)}/`;
	const states: [] = [];
	const screenName = DETAIL_SCREEN_NAMES[section];
	const body: LinkedInPaginationBody = {
		pagerId,
		clientArguments: {
			...requestedArguments,
			states,
			screenId: screenName
				? `com.linkedin.sdui.flagshipnav.profile.Profile${screenName}Details`
				: "com.linkedin.sdui.flagshipnav.profile.Profile",
			knownTemplateIds: [],
		},
		paginationRequest,
	};

	return http.post({
		path: `${actionUrl.pathname}${actionUrl.search}`,
		pageKey: `d_flagship3_profile_view_base_${section}_details`,
		refererPath,
		body,
		signal,
		context,
	});
}
