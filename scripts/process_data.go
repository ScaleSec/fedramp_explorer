package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strings"
)

// Simplified structures
type SimpleControl struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Prose       string            `json:"prose"`
	Parameters  []SimpleParameter `json:"params"`
	Related     []string          `json:"related"`
	Family      string            `json:"family"`
	Enhancement bool              `json:"enhancement"`
}

type SimpleParameter struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// OSCAL structures
type OSCALCatalog struct {
	Catalog OSCALData `json:"catalog"`
}

type OSCALData struct {
	Groups []OSCALGroup `json:"groups"`
}

type OSCALGroup struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Controls []OSCALControl `json:"controls"`
}

type OSCALControl struct {
	ID     string       `json:"id"`
	Title  string       `json:"title"`
	Props  []OSCALProp  `json:"props"`
	Links  []OSCALLink  `json:"links"`
	Parts  []OSCALPart  `json:"parts"`
	Params []OSCALParam `json:"params"`
}

type OSCALProp struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type OSCALLink struct {
	Rel  string `json:"rel"`
	Href string `json:"href"`
}

type OSCALPart struct {
	ID    string      `json:"id"`
	Name  string      `json:"name"`
	Prose string      `json:"prose"`
	Parts []OSCALPart `json:"parts"`
}

type OSCALParam struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

func main() {
	baselines := []string{"HIGH", "MODERATE", "LOW", "LI-SaaS"}
	for _, baseline := range baselines {
		inputFile := fmt.Sprintf("data/FedRAMP_rev5_%s-baseline-resolved-profile_catalog.json", baseline)
		outputFile := fmt.Sprintf("data/%s.json", strings.ToLower(baseline))

		fmt.Printf("Processing %s -> %s\n", inputFile, outputFile)

		byteValue, err := ioutil.ReadFile(inputFile)
		if err != nil {
			panic(err)
		}

		var catalog OSCALCatalog
		json.Unmarshal(byteValue, &catalog)

		var simpleControls []SimpleControl

		for _, group := range catalog.Catalog.Groups {
			for _, control := range group.Controls {
				var proseBuilder strings.Builder
				for _, part := range control.Parts {
					if part.Name == "statement" {
						buildProse(&proseBuilder, part)
					}
				}

				var simpleParams []SimpleParameter
				for _, param := range control.Params {
					simpleParams = append(simpleParams, SimpleParameter{
						ID:    param.ID,
						Label: param.Label,
					})
				}

				var relatedControls []string
				for _, link := range control.Links {
					if link.Rel == "related" {
						relatedControls = append(relatedControls, strings.TrimPrefix(link.Href, "#"))
					}
				}

				isEnhancement := false
				for _, prop := range control.Props {
					if prop.Name == "kind" && prop.Value == "enhancement" {
						isEnhancement = true
						break
					}
				}

				simpleControls = append(simpleControls, SimpleControl{
					ID:          control.ID,
					Title:       control.Title,
					Prose:       proseBuilder.String(),
					Parameters:  simpleParams,
					Related:     relatedControls,
					Family:      group.Title,
					Enhancement: isEnhancement,
				})
			}
		}

		file, _ := json.MarshalIndent(simpleControls, "", "  ")
		_ = ioutil.WriteFile(outputFile, file, 0644)
	}
}

func buildProse(builder *strings.Builder, part OSCALPart) {
	if part.Prose != "" {
		builder.WriteString(part.Prose)
	}
	for _, subPart := range part.Parts {
		buildProse(builder, subPart)
	}
}
