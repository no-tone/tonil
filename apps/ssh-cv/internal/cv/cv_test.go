package cv

import "testing"

func TestLoadEmbedded(t *testing.T) {
	byLang, langs, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(langs) < 2 {
		t.Fatalf("expected at least two languages, got %v", langs)
	}
	for _, lang := range langs {
		content := byLang[lang]
		if len(content.Experience) == 0 {
			t.Errorf("%s: no experience", lang)
		}
		if len(content.Skills) == 0 {
			t.Errorf("%s: no skills", lang)
		}
		if len(content.BestAt) == 0 {
			t.Errorf("%s: no bestAt", lang)
		}
		for _, exp := range content.Experience {
			if exp.Role == "" || exp.Period == "" {
				t.Errorf("%s: experience entry missing role or period: %+v", lang, exp)
			}
		}
	}
}

// The CV is generated from the site's content module; if the two ever drift
// out of sync this is the test that should notice, because the languages
// must stay symmetric.
func TestLanguagesAreSymmetric(t *testing.T) {
	byLang, langs, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	first := byLang[langs[0]]
	for _, lang := range langs[1:] {
		other := byLang[lang]
		if len(other.Experience) != len(first.Experience) {
			t.Errorf("%s has %d experience entries, %s has %d",
				lang, len(other.Experience), langs[0], len(first.Experience))
		}
		if len(other.Skills) != len(first.Skills) {
			t.Errorf("%s has %d skill groups, %s has %d",
				lang, len(other.Skills), langs[0], len(first.Skills))
		}
	}
}
