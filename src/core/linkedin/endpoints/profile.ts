import type { LinkedInHttp, LinkedInPrefetchBody } from "../http.ts";

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

export function fetchProfilePage(
	http: LinkedInHttp,
	vanityName: string,
): Promise<string> {
	const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/`;
	return http.post({
		path,
		pageKey: "d_flagship3_profile_view_base",
		refererPath: path,
		body: prefetchBody({ vanityName, isVanityNameResolved: true }),
	});
}

export function fetchProfileSection(
	http: LinkedInHttp,
	vanityName: string,
	section: string,
): Promise<string> {
	const path = `/flagship-web/in/${encodeURIComponent(vanityName)}/details/${encodeURIComponent(section)}/`;
	return http.post({
		path,
		pageKey: "profile_view_base_details",
		refererPath: path,
		body: prefetchBody({
			vanityName,
			isVanityNameResolved: true,
			sectionType: section,
		}),
	});
}
