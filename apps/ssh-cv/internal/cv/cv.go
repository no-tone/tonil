// Package cv holds the CV content served over SSH.
//
// cv.json is generated from packages/content/src/cv.ts by
// scripts/generate-content.ts and committed, so `go build` works in a
// checkout with no Bun installed. It is embedded rather than read from disk
// so the binary is self-contained: dropping it on a host is the whole
// install.
package cv

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed cv.json
var raw []byte

// Experience is one role. Org is described by what it does rather than named,
// matching the website - see packages/content/src/cv.ts.
type Experience struct {
	Role    string   `json:"role"`
	Org     string   `json:"org"`
	Period  string   `json:"period"`
	Place   string   `json:"place"`
	Bullets []string `json:"bullets"`
}

type Education struct {
	Title   string   `json:"title"`
	Period  string   `json:"period"`
	Bullets []string `json:"bullets"`
}

// BestAt is a ranked "what I'm best at" row: a short key and its expansion.
type BestAt struct {
	K string `json:"k"`
	V string `json:"v"`
}

type SkillGroup struct {
	Label string   `json:"label"`
	Items []string `json:"items"`
}

// Content is the CV in one language.
type Content struct {
	BestAt     []BestAt     `json:"bestAt"`
	Experience []Experience `json:"experience"`
	Education  []Education  `json:"education"`
	Skills     []SkillGroup `json:"skills"`
	Spoken     []string     `json:"spoken"`
	Interests  []string     `json:"interests"`
}

type document struct {
	Langs  []string           `json:"langs"`
	ByLang map[string]Content `json:"byLang"`
}

// Load parses the embedded CV.
//
// Returns an error rather than panicking on init so main can fail with a
// useful message instead of a stack trace, and so tests can assert the
// embedded document is well-formed.
func Load() (map[string]Content, []string, error) {
	var doc document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, nil, fmt.Errorf("parse embedded cv.json: %w", err)
	}
	if len(doc.Langs) == 0 {
		return nil, nil, fmt.Errorf("embedded cv.json declares no languages")
	}
	for _, lang := range doc.Langs {
		content, ok := doc.ByLang[lang]
		if !ok {
			return nil, nil, fmt.Errorf("cv.json declares language %q with no content", lang)
		}
		if len(content.Experience) == 0 {
			return nil, nil, fmt.Errorf("cv.json language %q has no experience entries", lang)
		}
	}
	return doc.ByLang, doc.Langs, nil
}
