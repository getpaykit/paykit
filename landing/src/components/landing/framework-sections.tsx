"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { DynamicCodeBlock } from "@/components/ui/dynamic-code-block";
import { useEarlyDevDialog } from "./early-dev-dialog";

export const providerIcons: Record<string, () => React.ReactNode> = {
  Google: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 56 56"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M28.458 5c6.167 0 11.346 2.2 15.368 5.804l.323.295l-6.62 6.464c-1.695-1.59-4.666-3.493-9.07-3.493c-6.204 0-11.47 4.093-13.372 9.749c-.47 1.46-.756 3.023-.756 4.64c0 1.615.287 3.18.782 4.639c1.877 5.656 7.142 9.748 13.345 9.748c3.347 0 5.928-.886 7.881-2.176l.251-.17l.307-.222c2.813-2.108 4.144-5.084 4.46-7.169l.03-.22h-12.93v-8.705h22.025c.339 1.46.495 2.867.495 4.795c0 7.142-2.554 13.163-6.985 17.255c-3.884 3.597-9.201 5.682-15.535 5.682c-9.031 0-16.85-5.102-20.772-12.57l-.184-.358l-.222-.457A23.45 23.45 0 0 1 5 28.458c0-3.6.827-7.01 2.28-10.073l.222-.457l.184-.357C11.608 10.1 19.426 5 28.458 5"
      />
    </svg>
  ),
  GitHub: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 15 15"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M7.5.25a7.25 7.25 0 0 0-2.292 14.13c.363.066.495-.158.495-.35c0-.172-.006-.628-.01-1.233c-2.016.438-2.442-.972-2.442-.972c-.33-.838-.805-1.06-.805-1.06c-.658-.45.05-.441.05-.441c.728.051 1.11.747 1.11.747c.647 1.108 1.697.788 2.11.602c.066-.468.254-.788.46-.969c-1.61-.183-3.302-.805-3.302-3.583a2.8 2.8 0 0 1 .747-1.945c-.075-.184-.324-.92.07-1.92c0 0 .61-.194 1.994.744A6.963 6.963 0 0 1 7.5 3.756A6.97 6.97 0 0 1 9.315 4c1.384-.938 1.992-.743 1.992-.743c.396.998.147 1.735.072 1.919c.465.507.745 1.153.745 1.945c0 2.785-1.695 3.398-3.31 3.577c.26.224.492.667.492 1.343c0 .97-.009 1.751-.009 1.989c0 .194.131.42.499.349A7.25 7.25 0 0 0 7.499.25"
        clipRule="evenodd"
      />
    </svg>
  ),
  Apple: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 20 20"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14.122 4.682c1.35 0 2.781.743 3.8 2.028c-3.34 1.851-2.797 6.674.578 7.963c-.465 1.04-.687 1.505-1.285 2.426c-.835 1.284-2.01 2.884-3.469 2.898c-1.295.012-1.628-.853-3.386-.843c-1.758.01-2.125.858-3.42.846c-1.458-.014-2.573-1.458-3.408-2.743C1.198 13.665.954 9.45 2.394 7.21C3.417 5.616 5.03 4.683 6.548 4.683c1.545 0 2.516.857 3.794.857c1.24 0 1.994-.858 3.78-.858M13.73 0c.18 1.215-.314 2.405-.963 3.247c-.695.902-1.892 1.601-3.05 1.565c-.21-1.163.332-2.36.99-3.167C11.43.755 12.67.074 13.73 0"
      />
    </svg>
  ),
  Microsoft: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M2 3h9v9H2zm9 19H2v-9h9zM21 3v9h-9V3zm0 19h-9v-9h9z"
      />
    </svg>
  ),
  Discord: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M18.59 5.89c-1.23-.57-2.54-.99-3.92-1.23c-.17.3-.37.71-.5 1.04c-1.46-.22-2.91-.22-4.34 0c-.14-.33-.34-.74-.51-1.04c-1.38.24-2.69.66-3.92 1.23c-2.48 3.74-3.15 7.39-2.82 10.98c1.65 1.23 3.24 1.97 4.81 2.46c.39-.53.73-1.1 1.03-1.69c-.57-.21-1.11-.48-1.62-.79c.14-.1.27-.21.4-.31c3.13 1.46 6.52 1.46 9.61 0c.13.11.26.21.4.31c-.51.31-1.06.57-1.62.79c.3.59.64 1.16 1.03 1.69c1.57-.49 3.17-1.23 4.81-2.46c.39-4.17-.67-7.78-2.82-10.98Zm-9.75 8.78c-.94 0-1.71-.87-1.71-1.94s.75-1.94 1.71-1.94s1.72.87 1.71 1.94c0 1.06-.75 1.94-1.71 1.94m6.31 0c-.94 0-1.71-.87-1.71-1.94s.75-1.94 1.71-1.94s1.72.87 1.71 1.94c0 1.06-.75 1.94-1.71 1.94"
      />
    </svg>
  ),
  Slack: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2447.6 2452.5"
      width="14"
      height="14"
    >
      <g fill="currentColor">
        <path d="m897.4 0c-135.3.1-244.8 109.9-244.7 245.2-.1 135.3 109.5 245.1 244.8 245.2h244.8v-245.1c.1-135.3-109.5-245.1-244.9-245.3.1 0 .1 0 0 0m0 654h-652.6c-135.3.1-244.9 109.9-244.8 245.2-.2 135.3 109.4 245.1 244.7 245.3h652.7c135.3-.1 244.9-109.9 244.8-245.2.1-135.4-109.5-245.2-244.8-245.3z" />
        <path d="m2447.6 899.2c.1-135.3-109.5-245.1-244.8-245.2-135.3.1-244.9 109.9-244.8 245.2v245.3h244.8c135.3-.1 244.9-109.9 244.8-245.3zm-652.7 0v-654c.1-135.2-109.4-245-244.7-245.2-135.3.1-244.9 109.9-244.8 245.2v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.3z" />
        <path d="m1550.1 2452.5c135.3-.1 244.9-109.9 244.8-245.2.1-135.3-109.5-245.1-244.8-245.2h-244.8v245.2c-.1 135.2 109.5 245 244.8 245.2zm0-654.1h652.7c135.3-.1 244.9-109.9 244.8-245.2.2-135.3-109.4-245.1-244.7-245.3h-652.7c-135.3.1-244.9 109.9-244.8 245.2-.1 135.4 109.4 245.2 244.7 245.3z" />
        <path d="m0 1553.2c-.1 135.3 109.5 245.1 244.8 245.2 135.3-.1 244.9-109.9 244.8-245.2v-245.2h-244.8c-135.3.1-244.9 109.9-244.8 245.2zm652.7 0v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.2v-653.9c.2-135.3-109.4-245.1-244.7-245.3-135.4 0-244.9 109.8-244.8 245.1 0 0 0 .1 0 0" />
      </g>
    </svg>
  ),
  Twitter: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 448 512"
    >
      <path
        fill="currentColor"
        d="M64 32C28.7 32 0 60.7 0 96v320c0 35.3 28.7 64 64 64h320c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64zm297.1 84L257.3 234.6L379.4 396h-95.6L209 298.1L123.3 396H75.8l111-126.9L69.7 116h98l67.7 89.5l78.2-89.5zm-37.8 251.6L153.4 142.9h-28.3l171.8 224.7h26.3z"
      />
    </svg>
  ),
  Facebook: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 64 64"
    >
      <path
        fill="currentColor"
        d="M59.5 1h-55C2.5 1 1 2.6 1 4.5v55c0 2 1.6 3.5 3.5 3.5h29.6V38.9h-8v-9.3h8v-6.9c0-8 4.8-12.4 12-12.4c2.4 0 4.8.1 7.2.4V19h-4.8c-3.8 0-4.6 1.8-4.6 4.5v5.9H53l-1.3 9.4h-8v23.8h15.8c2 0 3.5-1.5 3.5-3.5V4.5c-.1-2-1.7-3.5-3.5-3.5"
      />
    </svg>
  ),
  LinkedIn: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 448 512"
      fill="currentColor"
    >
      <path
        d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"
        fill="currentColor"
      />
    </svg>
  ),
  GitLab: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 32 32"
    >
      <path
        fill="currentColor"
        d="m28.568 12.893l-.037-.094l-3.539-9.235a.92.92 0 0 0-.364-.439a.95.95 0 0 0-1.083.058a.95.95 0 0 0-.314.477l-2.39 7.31h-9.675l-2.39-7.31a.93.93 0 0 0-.313-.478a.95.95 0 0 0-1.083-.058a.93.93 0 0 0-.365.438L3.47 12.794l-.035.093a6.57 6.57 0 0 0 2.18 7.595l.011.01l.033.022l5.39 4.037l2.668 2.019l1.624 1.226c.39.297.931.297 1.322 0l1.624-1.226l2.667-2.019l5.424-4.061l.013-.01a6.574 6.574 0 0 0 2.177-7.588Z"
      />
    </svg>
  ),
  Twitch: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M3.9 2.5a.9.9 0 0 0-.9.9v14.194a.9.9 0 0 0 .9.9h4.116v3.03a.7.7 0 0 0 1.194.494l3.525-3.524h4.643a.9.9 0 0 0 .636-.264l2.722-2.722a.9.9 0 0 0 .264-.636V3.4a.9.9 0 0 0-.9-.9zm7.319 5.2a.75.75 0 0 0-1.5 0v4.272a.75.75 0 1 0 1.5 0zm5.016 0a.75.75 0 0 0-1.5 0v4.272a.75.75 0 1 0 1.5 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Spotify: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 256 256"
      preserveAspectRatio="xMidYMid"
    >
      <path
        d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007l.001-.006Zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.981 7.981 0 0 1-9.552-6.007 7.968 7.968 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975Zm15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72v-.001Zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187h-.006Z"
        fill="currentColor"
      />
    </svg>
  ),
  Figma: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.00005 2.04999H5.52505C4.71043 2.04999 4.05005 2.71037 4.05005 3.52499C4.05005 4.33961 4.71043 4.99999 5.52505 4.99999H7.00005V2.04999ZM7.00005 1.04999H8.00005H9.47505C10.842 1.04999 11.95 2.15808 11.95 3.52499C11.95 4.33163 11.5642 5.04815 10.9669 5.49999C11.5642 5.95184 11.95 6.66836 11.95 7.475C11.95 8.8419 10.842 9.95 9.47505 9.95C8.92236 9.95 8.41198 9.76884 8.00005 9.46266V9.95L8.00005 11.425C8.00005 12.7919 6.89195 13.9 5.52505 13.9C4.15814 13.9 3.05005 12.7919 3.05005 11.425C3.05005 10.6183 3.43593 9.90184 4.03317 9.44999C3.43593 8.99814 3.05005 8.28163 3.05005 7.475C3.05005 6.66836 3.43594 5.95184 4.03319 5.5C3.43594 5.04815 3.05005 4.33163 3.05005 3.52499C3.05005 2.15808 4.15814 1.04999 5.52505 1.04999H7.00005ZM8.00005 2.04999V4.99999H9.47505C10.2897 4.99999 10.95 4.33961 10.95 3.52499C10.95 2.71037 10.2897 2.04999 9.47505 2.04999H8.00005ZM5.52505 8.94998H7.00005L7.00005 7.4788L7.00005 7.475L7.00005 7.4712V6H5.52505C4.71043 6 4.05005 6.66038 4.05005 7.475C4.05005 8.28767 4.70727 8.94684 5.5192 8.94999L5.52505 8.94998ZM4.05005 11.425C4.05005 10.6123 4.70727 9.95315 5.5192 9.94999L5.52505 9.95H7.00005L7.00005 11.425C7.00005 12.2396 6.33967 12.9 5.52505 12.9C4.71043 12.9 4.05005 12.2396 4.05005 11.425ZM8.00005 7.47206C8.00164 6.65879 8.66141 6 9.47505 6C10.2897 6 10.95 6.66038 10.95 7.475C10.95 8.28962 10.2897 8.95 9.47505 8.95C8.66141 8.95 8.00164 8.29121 8.00005 7.47794V7.47206Z"
        fill="currentColor"
      />
    </svg>
  ),
  Notion: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.28c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233l4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
      />
    </svg>
  ),
  Atlassian: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 256 256"
      preserveAspectRatio="xMidYMid"
    >
      <path
        d="M76 118c-4-4-10-4-13 1L1 245a7 7 0 0 0 6 10h88c3 0 5-1 6-4 19-39 8-98-25-133Z"
        fill="currentColor"
      />
      <path
        d="M122 4c-35 56-33 117-10 163l42 84c1 3 4 4 7 4h87a7 7 0 0 0 7-10L134 4c-2-5-9-5-12 0Z"
        fill="currentColor"
      />
    </svg>
  ),
  HuggingFace: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378c0 1.112.178 2.181.503 3.185c.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284c.278.173.48.408.71.694c.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542c.01.026.653 1.552 1.657 2.54c.616.605 1.01 1.223 1.082 1.912c.055.537-.096 1.059-.38 1.572c.637.121 1.294.187 1.967.187c.657 0 1.298-.063 1.921-.178c-.287-.517-.44-1.041-.384-1.581c.07-.69.465-1.307 1.081-1.913c1.004-.987 1.647-2.513 1.657-2.539c.021-.074.083-.285.233-.542c.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952c.23-.286.432-.52.71-.694c.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378"
      />
    </svg>
  ),
  Reddit: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 32 32"
    >
      <path
        d="M29.9999 12.0001C29.9998 11.2336 29.7793 10.4832 29.3649 9.8384C28.9505 9.19356 28.3595 8.68139 27.6623 8.36282C26.9652 8.04425 26.1911 7.93271 25.4324 8.04148C24.6736 8.15024 23.9621 8.47473 23.3824 8.97633C21.2887 7.86383 18.7874 7.19132 16.1749 7.03507L16.8237 3.13883L19.0387 3.47883C19.1511 4.17754 19.5068 4.81402 20.0431 5.27579C20.5794 5.73757 21.2616 5.99489 21.9693 6.00228C22.6769 6.00967 23.3644 5.76665 23.9102 5.31618C24.456 4.86571 24.825 4.23679 24.952 3.54058C25.0789 2.84437 24.9556 2.1257 24.604 1.51158C24.2523 0.897463 23.6948 0.427445 23.0301 0.184601C22.3654-0.0582438 21.6362-0.0582795 20.9715 0.1845C20.3067 0.42728 19.7492 0.897242 19.3974 1.51133L16.1474 1.01133C15.8874 0.971236 15.6221 1.03522 15.409 1.18941C15.1958 1.34361 15.052 1.57558 15.0087 1.83508L14.1499 7.02008C11.4199 7.13758 8.79744 7.81757 6.61744 8.97633C5.82132 8.30379 4.79416 7.96851 3.75457 8.04187C2.71499 8.11523 1.74508 8.59143 1.0513 9.36911C0.357515 10.1468-0.00535957 11.1645 0.0399123 12.2057C0.0851841 13.2469 0.535027 14.2293 1.29369 14.9438C1.09926 15.612 1.00036 16.3042 0.999944 17.0001C0.999944 19.7413 2.49994 22.2938 5.23869 24.1863C7.85994 26.0001 11.3262 27.0001 14.9999 27.0001C18.6737 27.0001 22.1399 26.0001 24.7612 24.1863C27.4999 22.2938 28.9999 19.7413 28.9999 17.0001C28.9995 16.3042 28.9006 15.612 28.7062 14.9438C29.1128 14.5686 29.4376 14.1135 29.6602 13.6069C29.8828 13.1004 29.9985 12.5534 29.9999 12.0001ZM7.99994 15.0001C7.99994 14.6045 8.11724 14.2178 8.337 13.8889C8.55677 13.56 8.86912 13.3037 9.23458 13.1523C9.60003 13.0009 10.0022 12.9613 10.3901 13.0385C10.7781 13.1157 11.1345 13.3062 11.4142 13.5859C11.6939 13.8656 11.8843 14.2219 11.9615 14.6099C12.0387 14.9979 11.9991 15.4 11.8477 15.7654C11.6963 16.1309 11.44 16.4433 11.1111 16.663C10.7822 16.8828 10.3955 17.0001 9.99994 17.0001C9.46951 17.0001 8.9608 16.7894 8.58573 16.4143C8.21066 16.0392 7.99994 15.5305 7.99994 15.0001ZM19.4687 21.8838C18.0927 22.6151 16.5582 22.9975 14.9999 22.9975C13.4417 22.9975 11.9072 22.6151 10.5312 21.8838C10.4151 21.8223 10.3123 21.7385 10.2287 21.6372C10.145 21.5359 10.0821 21.4191 10.0436 21.2935C10.005 21.1679 9.99162 21.036 10.0041 20.9052C10.0165 20.7744 10.0546 20.6474 10.1162 20.5313C10.1778 20.4153 10.2616 20.3125 10.3628 20.2288C10.4641 20.1451 10.5809 20.0822 10.7065 20.0437C10.8321 20.0052 10.964 19.9918 11.0948 20.0042C11.2256 20.0167 11.3526 20.0548 11.4687 20.1163C12.556 20.6944 13.7685 20.9967 14.9999 20.9967C16.2313 20.9967 17.4439 20.6944 18.5312 20.1163C18.6472 20.0548 18.7743 20.0167 18.9051 20.0042C19.0358 19.9918 19.1678 20.0052 19.2934 20.0437C19.419 20.0822 19.5358 20.1451 19.637 20.2288C19.7383 20.3125 19.8221 20.4153 19.8837 20.5313C19.9453 20.6474 19.9833 20.7744 19.9958 20.9052C20.0083 21.036 19.9948 21.1679 19.9563 21.2935C19.9178 21.4191 19.8549 21.5359 19.7712 21.6372C19.6875 21.7385 19.5847 21.8223 19.4687 21.8838ZM19.9999 17.0001C19.6044 17.0001 19.2177 16.8828 18.8888 16.663C18.5599 16.4433 18.3036 16.1309 18.1522 15.7654C18.0008 15.4 17.9612 14.9979 18.0384 14.6099C18.1155 14.2219 18.306 13.8656 18.5857 13.5859C18.8654 13.3062 19.2218 13.1157 19.6098 13.0385C19.9977 12.9613 20.3999 13.0009 20.7653 13.1523C21.1308 13.3037 21.4431 13.56 21.6629 13.8889C21.8826 14.2178 21.9999 14.6045 21.9999 15.0001C21.9999 15.5305 21.7892 16.0392 21.4142 16.4143C21.0391 16.7894 20.5304 17.0001 19.9999 17.0001Z"
        fill="currentColor"
      />
    </svg>
  ),
  TikTok: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"
      />
    </svg>
  ),
  PayPal: () => (
    <svg
      fill="currentColor"
      viewBox="-2 -2 24 24"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMinYMin"
      width="14"
      height="14"
    >
      <path d="M4.328 16.127l-.011.07a.899.899 0 0 1-.887.744H.9a.892.892 0 0 1-.88-1.04L2.57.745A.892.892 0 0 1 3.45 0h6.92a4.141 4.141 0 0 1 4.142 4.141c0 .273-.017.54-.05.804a3.629 3.629 0 0 1 1.53 2.962 5.722 5.722 0 0 1-5.72 5.722h-.583c-.653 0-1.211.472-1.32 1.117l-.314 1.87.314-1.87a1.339 1.339 0 0 1 1.32-1.117h.582a5.722 5.722 0 0 0 5.722-5.722 3.629 3.629 0 0 0-1.53-2.962 6.52 6.52 0 0 1-6.47 5.716H6.06a.969.969 0 0 0-.93.701l-1.155 6.862c-.08.48.289.916.775.916h2.214a.786.786 0 0 0 .775-.655l.315-1.87-.315 1.87a.786.786 0 0 1-.775.655H4.751a.782.782 0 0 1-.6-.278.782.782 0 0 1-.175-.638l.352-2.097z" />
    </svg>
  ),
  Dropbox: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 528 512"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M264.4 116.3l-132 84.3 132 84.3-132 84.3L0 284.1l132.3-84.3L0 116.3 132.3 32l132.1 84.3zM131.6 395.7l132-84.3 132 84.3-132 84.3-132-84.3zm132.8-111.6l132-84.3-132-83.6L395.7 32 528 116.3l-132.3 84.3L528 284.8l-132.3 84.3-131.3-85z"
      />
    </svg>
  ),
  Zoom: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 16 16"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M1.45 3.334C.648 3.334 0 3.982 0 4.783v4.986c0 1.6 1.298 2.898 2.898 2.898h6.986c.8 0 1.45-.649 1.45-1.45V6.233a2.9 2.9 0 0 0-2.899-2.899zM16 4.643v6.715c0 .544-.618.86-1.059.539l-2.059-1.498a1.33 1.33 0 0 1-.549-1.078V6.679c0-.427.204-.827.55-1.078l2.058-1.498a.667.667 0 0 1 1.059.54"
        clipRule="evenodd"
      />
    </svg>
  ),
  Vercel: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 256 222"
      fill="currentColor"
    >
      <path d="m128 0l128 221.705H0z" />
    </svg>
  ),
  Linear: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      width="14"
      height="14"
      viewBox="0 0 100 100"
    >
      <path
        fill="currentColor"
        d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465915 2.2686-.77832 4.5932-.92588465 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3367c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1855ZM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z"
      />
    </svg>
  ),
  Kick: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M9 3a1 1 0 0 1 1 1v3h1V6a1 1 0 0 1 .883-.993L12 5h1V4a1 1 0 0 1 .883-.993L14 3h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-.883.993L18 11h-1v2h1a1 1 0 0 1 .993.883L19 14v1h1a1 1 0 0 1 .993.883L21 16v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1h-1a1 1 0 0 1-.993-.883L11 18v-1h-1v3a1 1 0 0 1-.883.993L9 21H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      />
    </svg>
  ),
  Kakao: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 512 512"
    >
      <path
        fill="currentColor"
        d="M 511.5,203.5 C 511.5,215.5 511.5,227.5 511.5,239.5C 504.002,286.989 482.002,326.489 445.5,358C 390.216,402.375 326.882,424.209 255.5,423.5C 239.751,423.476 224.085,422.643 208.5,421C 174.34,444.581 140.006,467.914 105.5,491C 95.6667,493.167 91.8333,489.333 94,479.5C 101.833,450.667 109.667,421.833 117.5,393C 85.5639,376.077 58.0639,353.577 35,325.5C 15.8353,299.834 4.00193,271.167 -0.5,239.5C -0.5,227.5 -0.5,215.5 -0.5,203.5C 7.09119,155.407 29.4245,115.574 66.5,84C 121.53,39.9708 184.53,18.4708 255.5,19.5C 326.47,18.4708 389.47,39.9708 444.5,84C 481.575,115.574 503.909,155.407 511.5,203.5 Z"
      />
    </svg>
  ),
  Line: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"
      />
    </svg>
  ),
  VK: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 20 20"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M17.802 12.298s1.617 1.597 2.017 2.336a.1.1 0 0 1 .018.035q.244.409.123.645c-.135.261-.592.392-.747.403h-2.858c-.199 0-.613-.052-1.117-.4c-.385-.269-.768-.712-1.139-1.145c-.554-.643-1.033-1.201-1.518-1.201a.6.6 0 0 0-.18.03c-.367.116-.833.639-.833 2.032c0 .436-.344.684-.585.684H9.674c-.446 0-2.768-.156-4.827-2.327C2.324 10.732.058 5.4.036 5.353c-.141-.345.155-.533.475-.533h2.886c.387 0 .513.234.601.444c.102.241.48 1.205 1.1 2.288c1.004 1.762 1.621 2.479 2.114 2.479a.53.53 0 0 0 .264-.07c.644-.354.524-2.654.494-3.128c0-.092-.001-1.027-.331-1.479c-.236-.324-.638-.45-.881-.496c.065-.094.203-.238.38-.323c.441-.22 1.238-.252 2.029-.252h.439c.858.012 1.08.067 1.392.146c.628.15.64.557.585 1.943c-.016.396-.033.842-.033 1.367c0 .112-.005.237-.005.364c-.019.711-.044 1.512.458 1.841a.4.4 0 0 0 .217.062c.174 0 .695 0 2.108-2.425c.62-1.071 1.1-2.334 1.133-2.429c.028-.053.112-.202.214-.262a.5.5 0 0 1 .236-.056h3.395c.37 0 .621.056.67.196c.082.227-.016.92-1.566 3.016c-.261.349-.49.651-.691.915c-1.405 1.844-1.405 1.937.083 3.337"
        clipRule="evenodd"
      />
    </svg>
  ),
  Naver: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z"
      />
    </svg>
  ),
  Polar: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      fill="currentColor"
      viewBox="0 0 300 300"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M66.428 274.26c68.448 46.333 161.497 28.406 207.83-40.041 46.335-68.448 28.408-161.497-40.04-207.83C165.77-19.946 72.721-2.019 26.388 66.428-19.948 134.878-2.02 227.928 66.427 274.26ZM47.956 116.67c-17.119 52.593-11.412 105.223 11.29 139.703C18.04 217.361 7.275 150.307 36.943 92.318c18.971-37.082 50.622-62.924 85.556-73.97-31.909 18.363-59.945 53.466-74.544 98.322Zm127.391 166.467c36.03-10.531 68.864-36.752 88.338-74.815 29.416-57.497 19.083-123.905-21.258-163.055 21.793 34.496 27.046 86.275 10.204 138.02-15.016 46.134-44.246 81.952-77.284 99.85Zm8.28-16.908c24.318-20.811 44.389-55.625 53.308-97.439 14.098-66.097-4.384-127.592-41.823-148.113 19.858 26.718 29.91 78.613 23.712 136.656-4.739 44.391-18.01 83.26-35.197 108.896ZM63.717 131.844c-14.201 66.586 4.66 128.501 42.657 148.561-20.378-26.396-30.777-78.891-24.498-137.694 4.661-43.657 17.574-81.974 34.349-107.614-23.957 20.886-43.687 55.392-52.507 96.747Zm136.117 17.717c1.074 67.912-20.244 123.317-47.612 123.748-27.369.433-50.425-54.27-51.498-122.182-1.073-67.913 20.244-123.318 47.613-123.75 27.368-.432 50.425 54.271 51.497 122.184Z"
      />
    </svg>
  ),
  Roblox: () => (
    <svg viewBox="0 0 302.7 302.7" width="14" height="14" fill="currentColor">
      <path d="M120.5,271.7c-110.9-28.6-120-31-119.9-31.5C0.7,239.6,62.1,0.5,62.2,0.4c0,0,54,13.8,119.9,30.8S302.1,62,302.2,62c0.2,0,0.2,0.4,0.1,0.9c-0.2,1.5-61.5,239.3-61.7,239.5C240.6,302.5,186.5,288.7,120.5,271.7z M174.9,158c3.2-12.6,5.9-23.1,6-23.4c0.1-0.5-2.3-1.2-23.2-6.6c-12.8-3.3-23.5-5.9-23.6-5.8c-0.3,0.3-12.1,46.6-12,46.7c0.2,0.2,46.7,12.2,46.8,12.1C168.9,180.9,171.6,170.6,174.9,158L174.9,158z" />
    </svg>
  ),
  Salesforce: () => (
    <svg
      viewBox=".5 .5 999 699.242"
      width="14"
      height="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M416.224 76.763c32.219-33.57 77.074-54.391 126.682-54.391 65.946 0 123.48 36.772 154.12 91.361 26.626-11.896 56.098-18.514 87.106-18.514 118.94 0 215.368 97.268 215.368 217.247 0 119.993-96.428 217.261-215.368 217.261a213.735 213.735 0 0 1-42.422-4.227c-26.981 48.128-78.397 80.646-137.412 80.646-24.705 0-48.072-5.706-68.877-15.853-27.352 64.337-91.077 109.448-165.348 109.448-77.344 0-143.261-48.939-168.563-117.574-11.057 2.348-22.513 3.572-34.268 3.572C75.155 585.74.5 510.317.5 417.262c0-62.359 33.542-116.807 83.378-145.937-10.26-23.608-15.967-49.665-15.967-77.06C67.911 87.25 154.79.5 261.948.5c62.914 0 118.827 29.913 154.276 76.263"
      />
    </svg>
  ),
};

export const socialProviders = [
  "Google",
  "GitHub",
  "Apple",
  "Microsoft",
  "Discord",
  "Slack",
  "Twitter",
  "Facebook",
  "LinkedIn",
  "GitLab",
  "Twitch",
  "Spotify",
  "Figma",
  "Notion",
  "Atlassian",
  "Salesforce",
  "HuggingFace",
  "Roblox",
  "Reddit",
  "TikTok",
  "PayPal",
  "Dropbox",
  "Zoom",
  "Vercel",
  "Linear",
  "Kick",
  "Kakao",
  "Line",
  "VK",
  "Naver",
];

export const plugins = [
  { name: "Two Factor", category: "auth" },
  { name: "Passkey", category: "auth" },
  { name: "Magic Link", category: "auth" },
  { name: "Email OTP", category: "auth" },
  { name: "Username", category: "auth" },
  { name: "One Tap", category: "auth" },
  { name: "Phone Number", category: "auth" },
  { name: "Anonymous", category: "auth" },
  { name: "Bearer", category: "auth" },
  { name: "Generic OAuth", category: "auth" },
  { name: "One Time Token", category: "auth" },
  { name: "SIWE", category: "auth" },
  { name: "Organization", category: "org" },
  { name: "Admin", category: "org" },
  { name: "Multi Session", category: "org" },
  { name: "API Key", category: "org" },
  { name: "SSO", category: "enterprise" },
  { name: "OIDC Provider", category: "enterprise" },
  { name: "SCIM", category: "enterprise" },
  { name: "OAuth Proxy", category: "enterprise" },
  { name: "JWT", category: "security" },
  { name: "HIBP", category: "security" },
  { name: "Captcha", category: "security" },
  { name: "Stripe", category: "integration" },
  { name: "Polar", category: "integration" },
  { name: "Open API", category: "integration" },
  { name: "Dub", category: "integration" },
  { name: "Autumn", category: "integration" },
  { name: "Dodo Payments", category: "integration" },
  { name: "Creem", category: "integration" },
  { name: "MCP", category: "ai" },
  { name: "Device Auth", category: "auth" },
  { name: "Last Login", category: "auth" },
];

export const categoryLabels: Record<string, string> = {
  auth: "Authentication",
  org: "Organization",
  enterprise: "Enterprise",
  security: "Security",
  integration: "Integration",
  ai: "AI",
};

const _categoryColors: Record<string, string> = {
  auth: "text-violet-500/50 dark:text-violet-400/40",
  org: "text-sky-500/50 dark:text-sky-400/40",
  enterprise: "text-amber-500/50 dark:text-amber-400/40",
  security: "text-red-500/50 dark:text-red-400/40",
  integration: "text-emerald-500/50 dark:text-emerald-400/40",
  ai: "text-pink-500/50 dark:text-pink-400/40",
};

const codeExamples: Record<string, string> = {
  Checkout: `const checkout = await paykit.api.createCheckout({
  customerId: "cust_abc",
  amount: 9900, // $99.00
  description: "Lifetime License",
  successURL: "https://myapp.com/success",
  cancelURL: "https://myapp.com/cancel",
  attachMethod: true,
});

// redirect user to checkout.url`,
  Subscriptions: `const subscription = await paykit.api.createSubscription({
  customerId: "cust_abc",
  amount: 2900, // $29/mo
  interval: "month",
  description: "Pro Plan",
  trialDays: 14,
});

// cancel at period end
await paykit.api.cancelSubscription({
  id: subscription.id,
  mode: "at_period_end",
});`,
  Events: `const paykit = createPayKit({
  // ...
  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!");
    },
    "payment.succeeded": async ({ payment }) => {
      console.log("Payment received:", payment.id);
    },
    "invoice.payment_failed": async ({ invoice, error }) => {
      await alertTeam(invoice.customerId, error);
    },
  },
});`,
  Invoices: `const invoices = await paykit.api.listInvoices({
  customerId: "cust_abc",
  status: "paid",
  limit: 10,
});

const invoice = await paykit.api.getInvoice({ id: "inv_abc" });
// invoice.pdfURL  → download link
// invoice.total   → amount in cents
// invoice.status  → "paid"`,
};

export const serverCode = `import { createPayKit } from "paykit"
import { stripe } from "paykit/providers/stripe"
import { drizzleAdapter } from "paykit/adapters/drizzle"

export const paykit = createPayKit({
  database: drizzleAdapter(db),

  providers: [
    stripe({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    }),
  ],

  on: {
    "subscription.activated": async ({ subscription, customer }) => {
      await sendEmail(customer.email, "Welcome to Pro!")
    },
    "payment.succeeded": async ({ payment }) => {
      console.log("Payment received", payment)
    },
  },
})`;

export const handlerCode = `// app/api/paykit/[...path]/route.ts
import { paykit } from "@/lib/paykit"

// Handles webhooks and client API requests
export const { GET, POST } = paykit.handler`;

export function ServerClientTabs() {
  const [activeTab, setActiveTab] = useState<"server" | "handler">("server");

  return (
    <div className="relative">
      <div className="relative overflow-hidden bg-neutral-50 dark:bg-background border border-foreground/[0.1] rounded-lg">
        <div className="flex border-b border-foreground/[0.08] bg-neutral-100/50 dark:bg-card/50">
          <button
            type="button"
            onClick={() => setActiveTab("server")}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-mono transition-colors relative ${
              activeTab === "server"
                ? "text-foreground/80"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            paykit.ts
            {activeTab === "server" && (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground/50" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("handler")}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-mono transition-colors relative ${
              activeTab === "handler"
                ? "text-foreground/80"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            route.ts
            {activeTab === "handler" && (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground/50" />
            )}
          </button>
        </div>

        <div className="relative">
          <DynamicCodeBlock
            lang="ts"
            code={activeTab === "server" ? serverCode : handlerCode}
            codeblock={{
              className:
                "border-0 rounded-none my-0 shadow-none bg-neutral-50 dark:bg-background [&_div]:bg-neutral-50 [&_div]:dark:bg-background",
              keepBackground: true,
              "data-line-numbers": true,
              viewportProps: {
                className: "overflow-x-auto overflow-y-visible max-h-none",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function CodeExamplesSection() {
  const tabs = Object.keys(codeExamples);
  const [activeTab, setActiveTab] = useState<string>("Checkout");
  const codeScrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-base text-foreground/85 dark:text-foreground/75">
          Unified{" "}
          <span className="text-emerald-500 dark:text-emerald-400">API</span>
        </span>
        <div className="h-px flex-1 bg-foreground/[0.08]" />
      </div>

      <p className="text-sm text-foreground/55 dark:text-foreground/45 mb-5 max-w-xl leading-relaxed">
        One API for checkout, subscriptions, invoices, and events — regardless
        of which payment provider you use.
      </p>

      <div className="border border-foreground/[0.1] overflow-hidden bg-neutral-50/50 dark:bg-background/40">
        {/* Tabs */}
        <div className="flex border-b border-foreground/[0.09] bg-neutral-100/50 dark:bg-card/50 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-mono transition-colors relative border-r border-foreground/[0.08] last:border-r-0 shrink-0 ${
                activeTab === tab
                  ? "text-foreground/90 bg-foreground/[0.03]"
                  : "text-foreground/45 hover:text-foreground/70"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-emerald-500/70 dark:bg-emerald-400/60" />
              )}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div ref={codeScrollRef}>
          <DynamicCodeBlock
            key={activeTab}
            lang="ts"
            code={codeExamples[activeTab] ?? ""}
            codeblock={{
              className:
                "border-0 rounded-none my-0 shadow-none bg-neutral-50 dark:bg-background [&_div]:bg-neutral-50 [&_div]:dark:bg-background",
              keepBackground: true,
              "data-line-numbers": true,
              viewportProps: {
                className: "overflow-x-auto overflow-y-visible max-h-none",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function SocialProvidersSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const visibleRows = 2;
  const perRow = 5;
  const rowHeight = 34;
  const totalRows = Math.ceil(socialProviders.length / perRow);
  const maxScroll = totalRows - visibleRows;

  useEffect(() => {
    const interval = setInterval(() => {
      setScrollIndex((prev) => (prev >= maxScroll ? 0 : prev + 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [maxScroll]);

  const allRows = Array.from({ length: totalRows }, (_, rowIdx) =>
    socialProviders.slice(rowIdx * perRow, rowIdx * perRow + perRow),
  );

  return (
    <div ref={containerRef} className="flex gap-6 items-start">
      <div className="shrink-0">
        <span className="text-2xl font-light text-foreground/80 dark:text-foreground/70 tabular-nums leading-none">
          35+
        </span>
        <p className="text-sm text-foreground/55 dark:text-foreground/45 mt-1">
          social providers
        </p>
      </div>

      <div
        className="relative flex-1 overflow-hidden border border-dashed border-foreground/[0.08]"
        style={{ height: `${visibleRows * rowHeight}px` }}
      >
        <motion.div
          animate={{ y: -(scrollIndex * rowHeight) }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {allRows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="flex"
              style={{ height: `${rowHeight}px` }}
            >
              {row.map((provider) => {
                const Icon = providerIcons[provider];
                return (
                  <span
                    key={provider}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono text-foreground/65 dark:text-foreground/50 border-r border-b border-dashed border-foreground/[0.06] cursor-default"
                  >
                    {Icon && (
                      <span className="text-foreground/50 dark:text-foreground/35 shrink-0">
                        {Icon()}
                      </span>
                    )}
                    {provider}
                  </span>
                );
              })}
            </div>
          ))}
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

export function PluginEcosystem() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  const half = Math.ceil(plugins.length / 2);
  const row1 = plugins.slice(0, half);
  const row2 = plugins.slice(half);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base text-foreground/85 dark:text-foreground/75">
            Plugin Ecosystem
          </span>
          <span className="text-xs font-mono text-foreground/35 dark:text-foreground/50">
            {plugins.length} official
          </span>
        </div>
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openEarlyDevDialog();
          }}
          className="text-xs font-mono text-foreground/35 dark:text-foreground/50 hover:text-foreground/55 transition-colors uppercase tracking-wider"
        >
          browse all &rarr;
        </Link>
      </div>

      <div className="relative overflow-hidden">
        {/* Row 1 — scrolls left */}
        <div className="flex animate-[marquee_40s_linear_infinite] mb-1.5">
          {[...row1, ...row1].map((plugin, i) => (
            <span
              key={`${plugin.name}-${i}`}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 mr-1.5 text-xs text-foreground dark:text-foreground/90 border border-foreground/[0.06] rounded-sm cursor-default whitespace-nowrap"
            >
              {plugin.name}
              <span className="text-xs font-mono uppercase tracking-wider text-foreground/50 ">
                {categoryLabels[plugin.category]}
              </span>
            </span>
          ))}
        </div>

        {/* Row 2 — scrolls right */}
        <div className="flex animate-[marquee-reverse_45s_linear_infinite]">
          {[...row2, ...row2].map((plugin, i) => (
            <span
              key={`${plugin.name}-${i}`}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 mr-1.5 text-xs text-foreground dark:text-foreground/90 border border-foreground/[0.06] rounded-sm cursor-default whitespace-nowrap"
            >
              {plugin.name}
              <span className="text-xs font-mono uppercase tracking-wider text-foreground/50 ">
                {categoryLabels[plugin.category]}
              </span>
            </span>
          ))}
        </div>

        {/* Side fades */}
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

const mcpClients = [
  { name: "Cursor", cmd: "npx @better-auth/cli mcp --cursor" },
  { name: "Claude Code", cmd: "claude mcp add better-auth" },
  { name: "Open Code", cmd: "npx @better-auth/cli mcp --open-code" },
];

export function AiNativeSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [promptText, setPromptText] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const hasPlayed = useRef(false);
  const fullPrompt = "Add Google login and 2FA to my app";

  const steps = [
    { label: "mcp", text: "Connected to better-auth docs" },
    { label: "skill", text: "better-auth/add-provider → google" },
    { label: "skill", text: "better-auth/add-plugin → two-factor" },
    { label: "write", text: "lib/auth.ts", lines: 14 },
    { label: "done", text: "Google OAuth + 2FA configured" },
  ];

  useEffect(() => {
    if (!inView || hasPlayed.current) return;
    hasPlayed.current = true;
    let i = 0;
    const typing = setInterval(() => {
      i++;
      setPromptText(fullPrompt.slice(0, i));
      if (i >= fullPrompt.length) {
        clearInterval(typing);
        setTimeout(() => setShowSteps(true), 500);
      }
    }, 30);
    return () => clearInterval(typing);
  }, [inView]);

  useEffect(() => {
    if (!showSteps || visibleSteps >= steps.length) return;
    const timeout = setTimeout(
      () => setVisibleSteps((v) => v + 1),
      visibleSteps === 0 ? 200 : 400,
    );
    return () => clearTimeout(timeout);
  }, [showSteps, visibleSteps, steps.length]);

  return (
    <div ref={ref} className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 border-t border-foreground/[0.06]" />
        <span className="text-xs text-foreground/60 dark:text-foreground/40 font-mono tracking-wider uppercase shrink-0">
          AI Native
        </span>
      </div>
      <p className="text-sm text-foreground/70 dark:text-foreground/55 leading-[1.9] mb-5">
        Your auth lives in{" "}
        <span className="text-foreground/75 dark:text-foreground/60">
          your codebase
        </span>{" "}
        &mdash; so AI can configure it. Ships with{" "}
        <span className="inline-flex items-center gap-1 text-foreground/75 dark:text-foreground/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M19.967 17.484A4 4 0 0 1 18 18" />
          </svg>
          MCP server
        </span>
        ,{" "}
        <span className="inline-flex items-center gap-1 text-foreground/75 dark:text-foreground/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" x2="20" y1="19" y2="19" />
          </svg>
          Claude Code skills
        </span>
        , and{" "}
        <span className="inline-flex items-center gap-1 text-foreground/75 dark:text-foreground/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Cursor rules
        </span>
        .
      </p>

      <div className="border border-dashed border-foreground/[0.08] overflow-hidden">
        {/* Prompt line */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/[0.06] bg-foreground/[0.015]">
          <span className="text-foreground/35 font-mono text-xs select-none">
            &rsaquo;
          </span>
          <span className="text-xs font-mono text-foreground/70 dark:text-foreground/55">
            {promptText}
          </span>
          {!showSteps && inView && (
            <span className="inline-block w-[1.5px] h-[12px] bg-foreground/50 animate-pulse" />
          )}
        </div>

        {/* Steps */}
        {showSteps && (
          <div className="divide-y divide-foreground/[0.04]">
            {steps.slice(0, visibleSteps).map((step) => (
              <motion.div
                key={step.text}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5 px-3 py-1.5"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-foreground/45 dark:text-foreground/35 w-8 shrink-0">
                  {step.label}
                </span>
                <span className="text-xs font-mono text-foreground/60 dark:text-foreground/45 truncate">
                  {step.text}
                </span>
                {"lines" in step && typeof step.lines === "number" && (
                  <span className="text-xs font-mono text-emerald-600/70 dark:text-emerald-400/55 ml-auto shrink-0">
                    +{step.lines}
                  </span>
                )}
                {step.label === "done" && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-foreground/45 ml-auto shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* MCP clients */}
        <div className="border-t border-foreground/[0.06] bg-foreground/[0.015]">
          <div className="flex divide-x divide-foreground/[0.06]">
            {mcpClients.map((mc) => (
              <div key={mc.name} className="flex-1 px-3 py-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-foreground/40 dark:text-foreground/30 mb-0.5">
                  {mc.name}
                </p>
                <code className="text-xs font-mono text-foreground/55 dark:text-foreground/40 truncate block">
                  {mc.cmd}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
