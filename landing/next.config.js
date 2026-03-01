import { createMDX } from "fumadocs-mdx/next";
import "./src/env.js";

const withMDX = createMDX();

/** @type {import("next").NextConfig} */
const config = {};

export default withMDX(config);
