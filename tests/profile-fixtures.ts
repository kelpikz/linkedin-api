function text(value: string): unknown {
	return ["$", "p", null, { children: [value] }];
}

function entityItem(key: string, children: unknown[]): unknown {
	return [
		"$",
		"$L90",
		null,
		{
			componentKey: `entity-collection-item-${key}`,
			children: [
				...children,
				[
					"$",
					"$L91",
					null,
					{
						componentKey: "8811845c-b680-4eae-b6aa-477afb984500",
						children: [],
					},
				],
			],
		},
	];
}

function pagedItem(key: string, children: unknown[]): unknown {
	return ["$", "$L90", null, { componentKey: key, children }];
}

function sectionPayload(identifier: string, children: unknown[]): string {
	return [
		`1:${JSON.stringify([
			"$",
			"$L20",
			null,
			{
				observabilityIdentifier: `com.linkedin.sdui.impl.profile.components.${identifier}`,
				children: ["$", "$L21", null, { initialContent: "$L2" }],
			},
		])}`,
		`2:${JSON.stringify(["$", "section", null, { children }])}`,
	].join("\n");
}

function pagedSectionPayload(children: unknown[]): string {
	return `1:${JSON.stringify(["$", "div", null, { children }])}`;
}

export const pagePayload = [
	`0:${JSON.stringify(["$", "title", null, { children: "Satya Nadella | LinkedIn" }])}`,
	`1:${JSON.stringify([
		"$",
		"$L20",
		null,
		{
			observabilityIdentifier:
				"com.linkedin.sdui.impl.profile.components.topCard",
			children: ["$", "$L21", null, { initialContent: "$L2" }],
		},
	])}`,
	`2:${JSON.stringify([
		"$",
		"section",
		null,
		{
			children: [
				["$", "h2", null, { children: ["Satya Nadella"] }],
				text("Chairman and CEO at Microsoft"),
				text("Microsoft · University of Chicago, Booth School"),
				text("Redmond, Washington, United States"),
				[
					"$",
					"$L50",
					null,
					{
						shape: "circle",
						fetchPriority: "high",
						shouldUseImagePreload: true,
						renderPayload: {
							rootUrl:
								"https://media.licdn.com/profile-displayphoto-shrink_",
							imageRenditions: [
								{ width: 100, height: 100, suffixUrl: "small.jpg" },
								{ width: 560, height: 560, suffixUrl: "large.jpg" },
							],
						},
					},
				],
				[
					"$",
					"$L50",
					null,
					{
						shape: "circle",
						renderPayload: {
							rootUrl:
								"https://media.licdn.com/profile-displayphoto-",
							imageRenditions: [
								{
									width: 1200,
									height: 1200,
									suffixUrl: "unrelated.jpg",
								},
							],
						},
					},
				],
			],
		},
	])}`,
	`3:${JSON.stringify([
		"$",
		"$L20",
		null,
		{
			observabilityIdentifier:
				"com.linkedin.sdui.impl.profile.components.aboutSection",
			children: ["$", "$L21", null, { initialContent: "$L4" }],
		},
	])}`,
	`4:${JSON.stringify([
		"$",
		"section",
		null,
		{
			children: [
				text("About"),
				text(
					"As chairman and CEO of Microsoft, I work to empower every person and organization.",
				),
			],
		},
	])}`,
].join("\n");

export const pageHtml = `<!doctype html>
<html>
	<body>
		<img class="profile-photo" fetchPriority="high" alt="" src="https://media.licdn.com/profile-displayphoto-owner-small.jpg?expires=1&amp;signature=small" srcSet="https://media.licdn.com/profile-displayphoto-owner-small.jpg?expires=1&amp;signature=small 100w, https://media.licdn.com/profile-displayphoto-owner-large.jpg?expires=1&amp;signature=large 560w">
		<img class="related-profile" src="https://media.licdn.com/unrelated-large.jpg">
	</body>
</html>`;

const nestedMicrosoftRoles = entityItem("microsoft", [
	text("Microsoft"),
	text("Full-time"),
	entityItem("ceo", [
		text("Chairman and CEO"),
		text("Feb 2014 - Present · 12 yrs 7 mos"),
		text("Greater Seattle Area"),
	]),
	entityItem("evp", [
		text("Executive Vice President"),
		text("Jul 2013 - Feb 2014 · 8 mos"),
		text("Redmond, Washington, United States"),
	]),
]);

export const experiencePayload = sectionPayload("experienceDetailSection", [
	text("Experience"),
	nestedMicrosoftRoles,
	entityItem("trustee", [
		text("Member Board Of Trustees"),
		text("University of Chicago"),
		text("2018 – Present"),
	]),
]);

export const groupedExperiencePayload = sectionPayload(
	"experienceDetailSection",
	[
		entityItem("gates-foundation", [
			text("Gates Foundation"),
			text("3 yrs"),
			text("Co-chair"),
			text("Jan 2024 - Present · 2 yrs"),
			text("Board Member"),
			text("Jan 2023 - Dec 2023 · 1 yr"),
		]),
	],
);

export const educationPayload = pagedSectionPayload([
	pagedItem("ee65d873-c491-49ed-a402-c23b2264d42c", [
		text("Manipal Institute of Technology"),
		text("Bachelor of Engineering"),
		text("Electrical Engineering"),
		text("1984 – 1988"),
	]),
]);

export const certificationPayload = pagedSectionPayload([
	pagedItem("65cf17b7-ef7e-4d74-a081-a235febfe741", [
			text("Cloud Architecture"),
			text("Microsoft"),
			text("Issued January 2026"),
	]),
]);

export const combinedProfileCardsPayload = [
	`1:${JSON.stringify([
		"$",
		"$L20",
		null,
		{
			observabilityIdentifier:
				"com.linkedin.sdui.impl.profile.components.educationTopLevelSection",
			children: ["$", "$L21", null, { initialContent: "$L2" }],
		},
	])}`,
	`2:${JSON.stringify([
		"$",
		"section",
		null,
		{
			children: [
				text("Education"),
				entityItem("education-card", [
					text("Manipal Institute of Technology"),
					text("Bachelor of Engineering, Electrical Engineering"),
					text("1984 – 1988"),
				]),
			],
		},
	])}`,
	`3:${JSON.stringify([
		"$",
		"$L20",
		null,
		{
			observabilityIdentifier:
				"com.linkedin.sdui.impl.profile.components.certificationTopLevelSection",
			children: ["$", "$L21", null, { initialContent: "$L4" }],
		},
	])}`,
	`4:${JSON.stringify([
		"$",
		"section",
		null,
		{
			children: [
				text("Licenses & certifications"),
				entityItem("certification-card", [
					text("Azure Fundamentals"),
					text("Microsoft"),
					text("Issued January 2026"),
				]),
			],
		},
	])}`,
	`5:${JSON.stringify([
		"$",
		"$L20",
		null,
		{
			observabilityIdentifier:
				"com.linkedin.sdui.impl.profile.components.volunteerExperienceTopLevelSection",
			children: ["$", "$L21", null, { initialContent: "$L6" }],
		},
	])}`,
	`6:${JSON.stringify([
		"$",
		"section",
		null,
		{
			children: [
				entityItem("volunteer-card", [
					text("Volunteer"),
					text("Gates Foundation"),
					text("2025 – Present"),
				]),
			],
		},
	])}`,
].join("\n");

export const emptyCertificationPayload = sectionPayload(
	"certificationTopLevelSection",
	[],
);

export const skillsPayload = pagedSectionPayload([
	pagedItem("2172958d-0970-42fa-967c-c77e591b5f4f", [
		text("Leadership"),
		text("2 endorsements"),
		text("Cloud Computing"),
	]),
]);

export const detailShellPayload = pagedSectionPayload([]);

export const plainSkillsPage = pagedSectionPayload([
	text("Leadership"),
	text("3 endorsements"),
	text("Product Management"),
	text("Product Manager at Microsoft"),
	text("Strategy"),
	text("2 experiences at Microsoft and 1 other company"),
	text("Cloud Computing"),
	text("Endorsed by a colleague"),
]);

export const emptySkillsPayload = pagedSectionPayload([
	text("Nothing to see for now"),
	text("Skills that this member adds will appear here."),
]);

export const languagesPayload = pagedSectionPayload([
	pagedItem("716a136a-a62d-45e5-a6f7-364fe92b93b7", [
		text("English"),
		text("Native or bilingual proficiency"),
		text("Hindi"),
		text("Elementary proficiency"),
	]),
]);

export const plainLanguagesPage = pagedSectionPayload([
	text("Languages"),
	text("Spanish"),
	text("Professional working proficiency"),
	text("French"),
]);
