import type { LinkedInHttp, LinkedInRequestBody } from "../http.ts";

const TYPEAHEAD_ACTION =
	"com.linkedin.sdui.search.requests.SearchGlobalTypeaheadRequestAction";
const MEMORY_NAMESPACE = "MemoryNamespace";

const searchStateKeys = [
	"SearchResultsGlobalTyahKeywordsBinding",
	"SearchResultsSearchVerticalBindingKey",
	"global_typeahead_and_search_homeTypeaheadSessionId",
	"global_typeahead_and_search_homeTypeaheadSessionShouldRefresh",
	"global_typeahead_and_search_homeTyahSearchId",
	"global_typeahead_and_search_homeTypeaheadDispatchTimestamp",
];

function randomBase64(byteLength: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	return Buffer.from(bytes).toString("base64");
}

function requestedStateKeys() {
	return searchStateKeys.map((id) => ({
		key: { value: { $case: "id", id } },
	}));
}

function searchState(
	key: string,
	value: string | boolean,
	originalProtoCase: "stringValue" | "booleanValue",
) {
	return {
		key,
		namespace: MEMORY_NAMESPACE,
		value,
		originalProtoCase,
		protoKey: {
			$type: "proto.sdui.Key",
			value: { $case: "id", id: key },
		},
	};
}

function searchBody(query: string): LinkedInRequestBody {
	const states = [
		searchState(
			"SearchResultsGlobalTyahKeywordsBinding",
			query,
			"stringValue",
		),
		searchState(
			"SearchResultsSearchVerticalBindingKey",
			"All",
			"stringValue",
		),
		searchState(
			"global_typeahead_and_search_homeTypeaheadSessionId",
			crypto.randomUUID(),
			"stringValue",
		),
		searchState(
			"global_typeahead_and_search_homeTypeaheadSessionShouldRefresh",
			true,
			"booleanValue",
		),
		searchState(
			"global_typeahead_and_search_homeTyahSearchId",
			randomBase64(16),
			"stringValue",
		),
	];
	const requestedArguments = {
		$type: "proto.sdui.actions.requests.RequestedArguments",
		requestedStateKeys: requestedStateKeys(),
		payload: {
			origin: "FLAGSHIP_TYPEAHEAD_V2_GLOBAL_DESKTOP",
			keywordsField: {
				key: "SearchResultsGlobalTyahKeywordsBinding",
				namespace: MEMORY_NAMESPACE,
			},
			resultsComponentRef: "GlobalTypeaheadResultsRef",
			currentVerticalField: {
				key: "SearchResultsSearchVerticalBindingKey",
				namespace: MEMORY_NAMESPACE,
			},
			sessionIdField: {
				key: "global_typeahead_and_search_homeTypeaheadSessionId",
				namespace: MEMORY_NAMESPACE,
			},
			sessionShouldRefreshField: {
				key: "global_typeahead_and_search_homeTypeaheadSessionShouldRefresh",
				namespace: MEMORY_NAMESPACE,
			},
			tyahSearchIdField: {
				key: "global_typeahead_and_search_homeTyahSearchId",
				namespace: MEMORY_NAMESPACE,
			},
			dispatchTimestampField: {
				key: "global_typeahead_and_search_homeTypeaheadDispatchTimestamp",
				namespace: MEMORY_NAMESPACE,
			},
		},
		requestMetadata: { $type: "proto.sdui.common.RequestMetadata" },
	};

	return {
		requestId: TYPEAHEAD_ACTION,
		serverRequest: {
			requestId: TYPEAHEAD_ACTION,
			requestedArguments,
			onClientRequestFailureAction: {
				actions: [
					{
						$type: "proto.sdui.actions.core.SetState",
						value: {
							state: {
								key: {
									key: {
										value: {
											$case: "id",
											id: "SearchResultsTyahLastFetchedKeywords",
										},
									},
								},
								value: { $case: "stringValue", stringValue: "" },
							},
						},
					},
				],
			},
			isApfcEnabled: false,
			isStreaming: false,
			rumPageKey: "search_global_typeahead_results",
		},
		states,
		requestedArguments: {
			...requestedArguments,
			states,
			screenId: "com.linkedin.sdui.flagshipnav.home.Home",
			knownTemplateIds: [],
		},
	};
}

export function fetchProfileSearch(
	http: LinkedInHttp,
	query: string,
): Promise<string> {
	const url = new URL(
		"/flagship-web/rsc-action/actions/server-request",
		"https://www.linkedin.com",
	);
	url.searchParams.set("sduiid", TYPEAHEAD_ACTION);
	url.searchParams.set("parentSpanId", randomBase64(8));

	return http.post({
		path: `${url.pathname}${url.search}`,
		pageKey: "d_flagship3_feed",
		refererPath: "/feed/",
		body: searchBody(query),
	});
}
