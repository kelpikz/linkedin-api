import { z } from "zod";
import {
	certificationSchema,
	educationSchema,
	experienceSchema,
	identitySchema,
	languageSchema,
	profileDetailSectionSchema,
	profileMetaSchema,
	profileSchema,
	profileSearchResponseSchema,
	profileSearchResultSchema,
	profileSectionSchema,
} from "../core/schema.ts";

function openApiSchema(schema: z.ZodType) {
	const { $schema, ...document } = z.toJSONSchema(schema);
	return document;
}

const bearerSecurity = [{ bearerAuth: [] }];

const errorResponse = {
	$ref: "#/components/schemas/Error",
};

const unauthorizedResponse = {
	description: "The request does not contain a configured bearer token.",
	content: {
		"application/json": {
			schema: errorResponse,
			example: { error: "Unauthorized" },
		},
	},
};

const rateLimitedResponse = {
	description:
		"The key spent its budget of ten requests a minute. Retry-After holds the seconds until a slot frees up.",
	headers: {
		"Retry-After": {
			description: "Seconds to wait before the next request.",
			schema: { type: "integer" },
		},
	},
	content: {
		"application/json": {
			schema: errorResponse,
			example: { error: "Rate limit exceeded" },
		},
	},
};

/** The public API contract rendered by Swagger UI and returned at /openapi.json. */
export const openApiDocument = {
	openapi: "3.1.0",
	info: {
		title: "LinkedIn Profile API",
		version: "0.1.0",
		description:
			"Read a LinkedIn profile as structured JSON. Profile data is collected from LinkedIn's private web endpoints with the configured personal session. Those upstream endpoints can change without notice.\n\nAll /api routes require an API key in the Authorization header. The service returns a partial profile when a section cannot be extracted. Check meta.missing before using an optional section. A default profile request makes about ten upstream calls, so use the sections query parameter when you need fewer sections.",
		license: {
			name: "Private project API",
		},
	},
	servers: [{ url: "/", description: "This service" }],
	tags: [
		{ name: "System", description: "Service status and API metadata." },
		{ name: "Profiles", description: "Search for and read LinkedIn profiles." },
		{ name: "Media", description: "Proxy signed LinkedIn profile images." },
	],
	paths: {
		"/health": {
			get: {
				tags: ["System"],
				summary: "Check service health",
				description: "Returns a small health response without loading LinkedIn credentials.",
				operationId: "getHealth",
				security: [],
				responses: {
					"200": {
						description: "The service is running.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Health" },
								example: { ok: true },
							},
						},
					},
				},
			},
		},
		"/openapi.json": {
			get: {
				tags: ["System"],
				summary: "Get the OpenAPI document",
				description: "Returns this API contract as JSON for Swagger UI and other clients.",
				operationId: "getOpenApiDocument",
				security: [],
				responses: {
					"200": {
						description: "The OpenAPI document.",
						content: {
							"application/json": {
								schema: { type: "object" },
							},
						},
					},
				},
			},
		},
		"/profile-images/{source}": {
			get: {
				tags: ["Media"],
				summary: "Proxy a LinkedIn profile image",
				description:
					"Fetches a profile image from media.licdn.com through this service. Encode the complete HTTPS image URL with base64url and pass the result as source. The proxy rejects other hosts and does not follow redirects.",
				operationId: "getProfileImage",
				security: [],
				parameters: [
					{
						name: "source",
						in: "path",
						required: true,
						description: "A base64url-encoded https://media.licdn.com image URL.",
						schema: { type: "string", minLength: 1 },
						example: "aHR0cHM6Ly9tZWRpYS5saWNkbi5jb20vcHJvZmlsZS5qcGc",
					},
				],
				responses: {
					"200": {
						description: "The profile image bytes.",
						content: {
							"image/*": {
								schema: { type: "string", format: "binary" },
							},
						},
					},
					"400": {
						description: "The encoded URL is invalid or targets a different host.",
						content: {
							"application/json": {
								schema: errorResponse,
								examples: {
									invalidUrl: { value: { error: "Invalid profile image URL" } },
								},
							},
						},
					},
					"502": {
						description: "LinkedIn did not return an image.",
						content: {
							"application/json": {
								schema: errorResponse,
								example: { error: "Profile image is unavailable" },
							},
						},
					},
				},
			},
		},
		"/api/search": {
			get: {
				tags: ["Profiles"],
				summary: "Search LinkedIn profiles by name",
				description:
					"Runs one LinkedIn typeahead search. It returns profile matches only. It does not fetch profile details until the caller selects a result and calls GET /api/profile.",
				operationId: "searchProfiles",
				security: bearerSecurity,
				parameters: [
					{
						name: "q",
						in: "query",
						required: true,
						description: "The name to search for. Leading and trailing whitespace is removed.",
						schema: { type: "string", minLength: 1, maxLength: 100 },
						example: "Satya Nadella",
					},
				],
				responses: {
					"200": {
						description: "Search results from LinkedIn.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ProfileSearchResponse" },
								example: {
									query: "Satya Nadella",
									count: 1,
									results: [
										{
											name: "Satya Nadella",
											vanityName: "satyanadella",
											url: "https://www.linkedin.com/in/satyanadella/",
											profileImageUrl: null,
										},
									],
								},
							},
						},
					},
					"400": {
						description: "The query is missing, empty, or longer than 100 characters.",
						content: {
							"application/json": {
								schema: errorResponse,
								example: { error: "q must contain between 1 and 100 characters" },
							},
						},
					},
					"401": unauthorizedResponse,
					"429": rateLimitedResponse,
				},
			},
		},
		"/api/profile": {
			get: {
				tags: ["Profiles"],
				summary: "Read one LinkedIn profile",
				description:
					"Fetches and combines the profile sections for a LinkedIn /in/ or /pub/ URL. By default it requests identity, About, experience, education, skills, certifications, and languages. Set sections to reduce the detail requests. A section that cannot be fetched or recognized is returned as null and listed in meta.missing.",
				operationId: "getProfile",
				security: bearerSecurity,
				parameters: [
					{
						name: "url",
						in: "query",
						required: true,
						description: "A complete LinkedIn profile URL, such as https://www.linkedin.com/in/williamhgates/.",
						schema: { type: "string", format: "uri" },
						example: "https://www.linkedin.com/in/williamhgates/",
					},
					{
						name: "sections",
						in: "query",
						required: false,
						description: "Optional comma-separated detail sections. Omit this parameter to request every detail section.",
						style: "form",
						explode: false,
							schema: {
								type: "array",
								uniqueItems: true,
								items: {
									$ref: "#/components/schemas/ProfileDetailSection",
								},
							},
						example: ["experience", "education"],
					},
				],
				responses: {
					"200": {
						description: "The normalized profile. Check meta.missing before reading nullable sections.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Profile" },
								example: {
									sourceUrl: "https://www.linkedin.com/in/williamhgates/",
									name: "Bill Gates",
									headline: "Co-chair, Bill & Melinda Gates Foundation",
									location: "Seattle, Washington, United States",
									about: null,
									profileImageUrl: null,
									experience: null,
									education: null,
									skills: null,
									certifications: null,
									languages: null,
									meta: {
										extracted: ["identity"],
										missing: [
											"about",
											"experience",
											"education",
											"skills",
											"certifications",
											"languages",
										],
									},
								},
							},
						},
					},
					"400": {
						description: "The URL or sections parameter is invalid.",
						content: {
							"application/json": {
								schema: errorResponse,
								examples: {
									missingUrl: { value: { error: "url is required" } },
									invalidUrl: { value: { error: "url must be a LinkedIn profile URL" } },
									invalidSections: {
										value: {
											error:
												"sections must contain experience, education, skills, certifications, or languages",
										},
									},
								},
							},
						},
					},
					"401": unauthorizedResponse,
					"429": rateLimitedResponse,
				},
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "API key",
			},
		},
		schemas: {
			Error: {
				type: "object",
				additionalProperties: false,
				required: ["error"],
				properties: {
					error: { type: "string" },
				},
				example: { error: "Unauthorized" },
			},
			Health: {
				type: "object",
				additionalProperties: false,
				required: ["ok"],
				properties: {
					ok: { type: "boolean" },
				},
			},
			Identity: openApiSchema(identitySchema),
			Experience: openApiSchema(experienceSchema),
			Education: openApiSchema(educationSchema),
			Certification: openApiSchema(certificationSchema),
			Language: openApiSchema(languageSchema),
			Profile: openApiSchema(profileSchema),
			ProfileMeta: openApiSchema(profileMetaSchema),
			ProfileSection: openApiSchema(profileSectionSchema),
			ProfileDetailSection: openApiSchema(profileDetailSectionSchema),
			ProfileSearchResult: openApiSchema(profileSearchResultSchema),
			ProfileSearchResponse: openApiSchema(profileSearchResponseSchema),
		},
	},
};

/** HTML shell for Swagger UI. Swagger UI reads the contract from /openapi.json. */
export const swaggerUiPage = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="description" content="Interactive documentation for the LinkedIn Profile API" />
		<title>LinkedIn Profile API documentation</title>
		<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.10/swagger-ui.css" />
	</head>
	<body>
		<div id="swagger-ui"></div>
		<noscript>JavaScript is required to view the API documentation.</noscript>
		<script src="https://unpkg.com/swagger-ui-dist@5.11.10/swagger-ui-bundle.js"></script>
		<script>
			window.ui = SwaggerUIBundle({
				url: "/openapi.json",
				dom_id: "#swagger-ui",
				deepLinking: true,
				presets: [SwaggerUIBundle.presets.apis],
				layout: "BaseLayout"
			});
		</script>
	</body>
</html>
`;
