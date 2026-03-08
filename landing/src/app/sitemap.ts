import type { MetadataRoute } from "next";

import { URLs } from "@/lib/consts";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: URLs.site,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
