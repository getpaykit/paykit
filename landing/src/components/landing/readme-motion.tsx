"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function ReadmeMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      className="flex w-full flex-col"
    >
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="p-5 pt-4 pb-0 lg:p-5 lg:pt-6">
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="no-scrollbar overflow-x-hidden overflow-y-auto pt-[30px] pb-0"
          >
            {children}
          </motion.article>
        </div>
      </div>
    </motion.div>
  );
}
