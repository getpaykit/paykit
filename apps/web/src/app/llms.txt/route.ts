import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";

export const revalidate = false;

const suffix = `

## AI Access

- Append \`.mdx\` to any documentation page URL to get raw Markdown content (e.g. \`/docs/introduction.mdx\`)
- Full documentation as a single file: \`/llms-full.txt\`
`;

export function GET() {
  return new Response(llms(source).index() + suffix);
}
