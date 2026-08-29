export interface SearchSuggestion {
  name: string;
  vanityName: string;
  profileId: string;
  url: string;
}

export interface ProfileSection {
  key: string;
  label: string;
  text: string[];
}

export interface LinkedInProfile {
  name: string | null;
  vanityName: string;
  profileId: string;
  headline: string | null;
  location: string | null;
  about: string | null;
  topCard: string[];
  sections: ProfileSection[];
  profileImageUrl: string | null;
  sourceUrl: string;
}
