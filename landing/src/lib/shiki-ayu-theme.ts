import type { ThemeRegistrationRaw } from "shiki";

/**
 * Ayu Dark theme for Shiki, converted from the VS Code "Ayu" theme.
 * @see https://github.com/ayu-theme/vscode-ayu
 */
const ayuDark: ThemeRegistrationRaw = {
  name: "ayu-dark",
  type: "dark",
  colors: {
    "editor.background": "#10141c",
    "editor.foreground": "#bfbdb6",
  },
  settings: [
    {
      settings: { foreground: "#bfbdb6", background: "#10141c" },
    },
    {
      name: "Comment",
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#5a6673", fontStyle: "italic" },
    },
    {
      name: "String",
      scope: ["string", "constant.other.symbol"],
      settings: { foreground: "#aad94c" },
    },
    {
      name: "Regular Expressions and Escape Characters",
      scope: ["string.regexp", "constant.character", "constant.other"],
      settings: { foreground: "#95e6cb" },
    },
    {
      name: "Number",
      scope: ["constant.numeric"],
      settings: { foreground: "#d2a6ff" },
    },
    {
      name: "Built-in constants",
      scope: ["constant.language"],
      settings: { foreground: "#d2a6ff" },
    },
    {
      name: "Variable",
      scope: ["variable", "variable.parameter.function-call"],
      settings: { foreground: "#bfbdb6" },
    },
    {
      name: "Member Variable",
      scope: ["variable.member"],
      settings: { foreground: "#f07178" },
    },
    {
      name: "Language variable",
      scope: ["variable.language"],
      settings: { foreground: "#39bae6", fontStyle: "italic" },
    },
    {
      name: "Storage",
      scope: ["storage"],
      settings: { foreground: "#ff8f40" },
    },
    {
      name: "Keyword",
      scope: ["keyword"],
      settings: { foreground: "#ff8f40" },
    },
    {
      name: "Operators",
      scope: ["keyword.operator"],
      settings: { foreground: "#f29668" },
    },
    {
      name: "Separators like ; or ,",
      scope: ["punctuation.separator", "punctuation.terminator"],
      settings: { foreground: "#bfbdb6b3" },
    },
    {
      name: "Punctuation",
      scope: ["punctuation.section"],
      settings: { foreground: "#bfbdb6" },
    },
    {
      name: "Accessor",
      scope: ["punctuation.accessor"],
      settings: { foreground: "#f29668" },
    },
    {
      name: "JavaScript/TypeScript interpolation punctuation",
      scope: ["punctuation.definition.template-expression"],
      settings: { foreground: "#ff8f40" },
    },
    {
      name: "Interpolation text",
      scope: ["meta.embedded"],
      settings: { foreground: "#bfbdb6" },
    },
    {
      name: "Lambda arrow",
      scope: ["storage.type.function"],
      settings: { foreground: "#ff8f40" },
    },
    {
      name: "Function name",
      scope: ["entity.name.function"],
      settings: { foreground: "#ffb454" },
    },
    {
      name: "Function arguments",
      scope: ["variable.parameter", "meta.parameter"],
      settings: { foreground: "#d2a6ff" },
    },
    {
      name: "Function call",
      scope: [
        "variable.function",
        "variable.annotation",
        "meta.function-call.generic",
        "support.function.go",
      ],
      settings: { foreground: "#ffb454" },
    },
    {
      name: "Library function",
      scope: ["support.function", "support.macro"],
      settings: { foreground: "#f07178" },
    },
    {
      name: "Imports and packages",
      scope: ["entity.name.import", "entity.name.package"],
      settings: { foreground: "#aad94c" },
    },
    {
      name: "Entity name",
      scope: ["entity.name"],
      settings: { foreground: "#59c2ff" },
    },
    {
      name: "Tag",
      scope: ["entity.name.tag", "meta.tag.sgml"],
      settings: { foreground: "#39bae6" },
    },
    {
      name: "JSX Component",
      scope: ["support.class.component"],
      settings: { foreground: "#59c2ff" },
    },
    {
      name: "Tag start/end",
      scope: [
        "punctuation.definition.tag.end",
        "punctuation.definition.tag.begin",
        "punctuation.definition.tag",
      ],
      settings: { foreground: "#39bae680" },
    },
    {
      name: "Tag attribute",
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#ffb454" },
    },
    {
      name: "Library constant",
      scope: ["support.constant"],
      settings: { foreground: "#f29668", fontStyle: "italic" },
    },
    {
      name: "Library class/type",
      scope: ["support.type", "support.class", "source.go storage.type"],
      settings: { foreground: "#39bae6" },
    },
    {
      name: "Decorators/annotation",
      scope: [
        "meta.decorator variable.other",
        "meta.decorator punctuation.decorator",
        "storage.type.annotation",
        "entity.name.function.decorator",
      ],
      settings: { foreground: "#e6c08a" },
    },
    {
      name: "Invalid",
      scope: ["invalid"],
      settings: { foreground: "#d95757" },
    },
    {
      name: "Markup heading",
      scope: ["markup.heading", "markup.heading entity.name"],
      settings: { foreground: "#aad94c", fontStyle: "bold" },
    },
    {
      name: "Markup links",
      scope: ["markup.underline.link", "string.other.link"],
      settings: { foreground: "#39bae6" },
    },
    {
      name: "Markup Italic",
      scope: ["markup.italic"],
      settings: { foreground: "#f07178", fontStyle: "italic" },
    },
    {
      name: "Markup Bold",
      scope: ["markup.bold"],
      settings: { foreground: "#f07178", fontStyle: "bold" },
    },
    {
      name: "Markup added",
      scope: ["markup.inserted"],
      settings: { foreground: "#70bf56" },
    },
    {
      name: "Markup modified",
      scope: ["markup.changed"],
      settings: { foreground: "#73b8ff" },
    },
    {
      name: "Markup removed",
      scope: ["markup.deleted"],
      settings: { foreground: "#f26d78" },
    },
    {
      name: "CSS Properties",
      scope: ["support.type.property-name"],
      settings: { foreground: "#39bae6", fontStyle: "normal" },
    },
    {
      name: "Variable other constant",
      scope: ["variable.other.constant"],
      settings: { foreground: "#ffb454" },
    },
    {
      name: "Variable other object",
      scope: ["variable.other.object"],
      settings: { foreground: "#bfbdb6" },
    },
    {
      name: "Object literal key",
      scope: ["meta.object-literal.key"],
      settings: { foreground: "#bfbdb6" },
    },
    {
      name: "String punctuation",
      scope: ["punctuation.definition.string.begin", "punctuation.definition.string.end"],
      settings: { foreground: "#aad94c" },
    },
  ],
};

export { ayuDark };
