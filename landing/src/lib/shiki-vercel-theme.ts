import type { ThemeRegistrationRaw } from "shiki";

/**
 * Vercel Dark theme for Shiki, converted from the VS Code "Vercel" theme.
 * @see https://github.com/natemcgrady/vercel-vscode-theme
 */
const vercelDark: ThemeRegistrationRaw = {
  name: "vercel-dark",
  type: "dark",
  colors: {
    "editor.background": "#000000",
    "editor.foreground": "#eeeeee",
  },
  settings: [
    {
      settings: { foreground: "#eeeeee", background: "#000000" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#a0a0a0" },
    },
    {
      scope: ["keyword", "storage.modifier", "storage.type", "keyword.control"],
      settings: { foreground: "#ff4d8d", fontStyle: "" },
    },
    {
      scope: ["keyword.operator"],
      settings: { foreground: "#ff4d8d" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "punctuation.definition.string.begin",
        "punctuation.definition.string.end",
      ],
      settings: { foreground: "#00cb50" },
    },
    {
      scope: ["constant.character", "variable.language.this"],
      settings: { foreground: "#A6B5FF" },
    },
    {
      scope: ["constant.language"],
      settings: { foreground: "#ffffff" },
    },
    {
      scope: ["variable.other.constant"],
      settings: { foreground: "#47a8ff" },
    },
    {
      scope: ["variable.other.readwrite"],
      settings: { foreground: "#eeeeee" },
    },
    {
      scope: ["variable.other.object"],
      settings: { foreground: "#47a8ff" },
    },
    {
      scope: ["variable.other.readwrite.alias"],
      settings: { foreground: "#eeeeee" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#c473fc", fontStyle: "" },
    },
    {
      scope: ["variable.parameter"],
      settings: { foreground: "#eeeeee", fontStyle: "" },
    },
    {
      scope: ["entity.name.tag"],
      settings: { foreground: "#00cb50" },
    },
    {
      scope: ["support.class.component"],
      settings: { foreground: "#47a8ff" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#c473fc", fontStyle: "" },
    },
    {
      scope: ["string.regexp", "string.interpolated"],
      settings: { foreground: "#00cb50" },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "punctuation.definition.tag.begin",
        "punctuation.definition.tag.end",
        "punctuation.definition.tag",
      ],
      settings: { foreground: "#eeeeee" },
    },
    {
      scope: ["constant.numeric", "constant.numeric.decimal"],
      settings: { foreground: "#ffffff" },
    },
    {
      scope: ["support.variable.property", "variable.other.property"],
      settings: { foreground: "#eeeeee" },
    },
    {
      scope: ["support.type.primitive", "support.type"],
      settings: { foreground: "#47a8ff", fontStyle: "" },
    },
    {
      scope: [
        "entity.name.type.tsx",
        "meta.type.annotation.tsx",
        "meta.var-single-variable.expr.tsx",
        "entity.name",
      ],
      settings: { foreground: "#C473FC" },
    },
    {
      scope: [
        "punctuation.separator.key-value.tsx",
        "meta.object.member.tsx",
        "meta.objectliteral.tsx",
        "meta.var.expr.tsx",
        "source.tsx",
      ],
      settings: { foreground: "#FF4D8D" },
    },
    {
      scope: ["meta.object-literal.key.tsx"],
      settings: { foreground: "#eeeeee" },
    },
    {
      scope: [
        "punctuation.definition.string.template.begin.tsx",
        "punctuation.definition.string.template.end.tsx",
        "string.template.tsx",
        "meta.embedded.expression.tsx",
        "meta.tag.attributes.tsx",
        "meta.tag.tsx",
        "meta.jsx.children.tsx",
        "meta.block.tsx",
        "meta.function.expression.tsx",
        "meta.export.default.tsx",
        "source.tsx",
      ],
      settings: { foreground: "#00CB50" },
    },
    {
      scope: [
        "punctuation.definition.template-expression.begin.tsx",
        "punctuation.definition.template-expression.end.tsx",
        "meta.template.expression.tsx",
        "string.template.tsx",
        "meta.embedded.expression.tsx",
        "meta.tag.attributes.tsx",
        "meta.tag.tsx",
        "meta.jsx.children.tsx",
        "meta.block.tsx",
        "meta.function.expression.tsx",
        "meta.export.default.tsx",
        "source.tsx",
      ],
      settings: { foreground: "#FF4D8D" },
    },
    {
      scope: [
        "string.template.tsx",
        "meta.embedded.expression.tsx",
        "meta.tag.attributes.tsx",
        "meta.tag.tsx",
        "meta.jsx.children.tsx",
        "meta.block.tsx",
        "meta.function.expression.tsx",
        "meta.export.default.tsx",
        "source.tsx",
      ],
      settings: { foreground: "#00CB50" },
    },
    {
      scope: ["markup.underline.link", "string.other.link"],
      settings: { foreground: "#00cb50" },
    },
    {
      scope: ["markup.bold"],
      settings: { foreground: "#ff4d8d", fontStyle: "bold" },
    },
    {
      scope: ["markup.italic"],
      settings: { fontStyle: "italic" },
    },
    {
      scope: ["markup.heading", "entity.name.section"],
      settings: { foreground: "#c473fc", fontStyle: "bold" },
    },
    {
      scope: ["markup.deleted"],
      settings: { foreground: "#ff8c85" },
    },
    {
      scope: ["markup.inserted"],
      settings: { foreground: "#70d9a8" },
    },
    {
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#ff0000" },
    },
    {
      scope: ["meta.tag.sgml.doctype", "meta.tag.metadata"],
      settings: { foreground: "#a0a0a0" },
    },
    {
      scope: ["support.type.property-name.json"],
      settings: { foreground: "#FF4D8D" },
    },
  ],
};

export { vercelDark };
