const TYPEAHEAD_ACTION = "com.linkedin.sdui.search.requests.SearchGlobalTypeaheadRequestAction";
const MEMORY_NAMESPACE = "MemoryNamespace";

const stateKeys = [
  "SearchResultsGlobalTyahKeywordsBinding",
  "SearchResultsSearchVerticalBindingKey",
  "global_typeahead_and_search_homeTypeaheadSessionId",
  "global_typeahead_and_search_homeTypeaheadSessionShouldRefresh",
  "global_typeahead_and_search_homeTyahSearchId",
  "global_typeahead_and_search_homeTypeaheadDispatchTimestamp",
];

function requestedStateKeys() {
  return stateKeys.map((id) => ({ key: { value: { $case: "id", id } } }));
}

function state(key: string, value: string | boolean, originalProtoCase: "stringValue" | "booleanValue") {
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

function randomBase64(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Buffer.from(bytes).toString("base64");
}

export function createParentSpanId(): string {
  return randomBase64(8);
}

export function buildTypeaheadBody(query: string) {
  const sessionId = crypto.randomUUID();
  const tyahSearchId = randomBase64(16);
  const states = [
    state("SearchResultsGlobalTyahKeywordsBinding", query, "stringValue"),
    state("SearchResultsSearchVerticalBindingKey", "All", "stringValue"),
    state("global_typeahead_and_search_homeTypeaheadSessionId", sessionId, "stringValue"),
    state("global_typeahead_and_search_homeTypeaheadSessionShouldRefresh", true, "booleanValue"),
    state("global_typeahead_and_search_homeTyahSearchId", tyahSearchId, "stringValue"),
  ];

  const requestedArguments = {
    $type: "proto.sdui.actions.requests.RequestedArguments",
    requestedStateKeys: requestedStateKeys(),
    payload: {
      origin: "FLAGSHIP_TYPEAHEAD_V2_GLOBAL_DESKTOP",
      keywordsField: { key: "SearchResultsGlobalTyahKeywordsBinding", namespace: MEMORY_NAMESPACE },
      resultsComponentRef: "GlobalTypeaheadResultsRef",
      currentVerticalField: { key: "SearchResultsSearchVerticalBindingKey", namespace: MEMORY_NAMESPACE },
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
                key: { key: { value: { $case: "id", id: "SearchResultsTyahLastFetchedKeywords" } } },
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

export function buildProfileBody(vanityName: string, profileId: string) {
  return {
    requestedArguments: {
      payload: {
        vanityName,
        isVanityNameResolved: true,
        vieweeProfileId: profileId,
      },
      states: [],
      requestMetadata: { $type: "proto.sdui.common.RequestMetadata" },
      screenId: "",
      knownTemplateIds: [],
    },
    isPrefetch: true,
  };
}

export { TYPEAHEAD_ACTION };
