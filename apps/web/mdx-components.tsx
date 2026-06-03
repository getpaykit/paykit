import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { PackageCommandPre } from "@/components/docs/package-command-pre";

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    pre: PackageCommandPre,
    Callout,
    Card,
    Cards,
    Step,
    Steps,
    Tab,
    Tabs,
  };
}
