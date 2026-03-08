import type { MetadataRoute } from "next";

import { URLs } from "@/lib/consts";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const docsRoutes = source.generateParams().map(({ slug }) => ({
    url: `${URLs.site}/docs/${(slug ?? []).join("/")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: URLs.site,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...docsRoutes,
  ];
}
