'use client';

// Custom SVG Icons matching the SoulPrint brand style
// Based on Material Design Symbols with consistent styling

export function RobotIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1h1v4h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2v-4h1v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18A2.5 2.5 0 0 0 10 15.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"/>
    </svg>
  );
}

export function Robot2Icon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M17.5 15.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0m-8 0a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0M12 1a2 2 0 0 1 2 2a2 2 0 0 1-1 1.72V6h2a6 6 0 0 1 6 6v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a6 6 0 0 1 6-6h2V4.72A2 2 0 0 1 10 3a2 2 0 0 1 2-2m6 11H6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1Z"/>
    </svg>
  );
}

export function PersonHeartIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M15 14c2.67 0 8 1.33 8 4v2H7v-2c0-2.67 5.33-4 8-4m0-2a4 4 0 0 1-4-4a4 4 0 0 1 4-4a4 4 0 0 1 4 4a4 4 0 0 1-4 4M5 15.5c0-.42.12-.82.33-1.16A5.5 5.5 0 0 0 1 19v1h5.5v-2.5c0-.35.07-.68.19-1H5m7-3.25c-.12.08-.24.17-.35.27c-.21.17-.41.35-.6.54A4.4 4.4 0 0 0 9.5 16v4h-3v-1.5a3.5 3.5 0 0 1 5.5-2.75"/>
    </svg>
  );
}

export function NetworkIntelligenceIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m-1-4h2v2h-2zm0-2h2V7h-2z"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 6a6 6 0 0 0-6 6h2a4 4 0 0 1 4-4V6m0 12a6 6 0 0 0 6-6h-2a4 4 0 0 1-4 4v2"/>
    </svg>
  );
}

export function LightbulbIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7M9 21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9z"/>
    </svg>
  );
}

export function LockIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 17a2 2 0 0 0 2-2a2 2 0 0 0-2-2a2 2 0 0 0-2 2a2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5a5 5 0 0 1 5 5v2zm-6-5a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3"/>
    </svg>
  );
}

export function ChatIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 3c5.5 0 10 3.58 10 8s-4.5 8-10 8c-1.24 0-2.43-.18-3.53-.5C5.55 21 2 21 2 21c2.33-2.33 2.7-3.9 2.75-4.5C3.05 15.07 2 13.13 2 11c0-4.42 4.5-8 10-8"/>
    </svg>
  );
}

export function ForumIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M17 12V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v14l4-4h10a1 1 0 0 0 1-1m4-6a1 1 0 0 0-1-1h-1v9H6v1a1 1 0 0 0 1 1h11l4 4z"/>
    </svg>
  );
}

export function AccountCircleIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4a3 3 0 1 1 0 6a3 3 0 0 1 0-6m0 14c-2.5 0-4.71-1.28-6-3.22c.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08A7.99 7.99 0 0 1 12 20"/>
    </svg>
  );
}

export function SettingsHeartIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5c-1.58 0-3.12.25-4.58.72L5.5 3.61l-.71.71l.78 1.57A9.45 9.45 0 0 0 2.5 12a9.5 9.5 0 0 0 9.5 9.5a9.5 9.5 0 0 0 9.5-9.5a9.5 9.5 0 0 0-9.5-9.5"/>
      <path d="M12 6.5c.5 0 1 .08 1.5.21c.26-.85.9-1.54 1.75-1.84A7.5 7.5 0 0 0 12 4.5a7.5 7.5 0 0 0-7.5 7.5a7.5 7.5 0 0 0 2.5 5.59V16c0-.83.67-1.5 1.5-1.5S10 15.17 10 16v1.5"/>
    </svg>
  );
}

export function TargetIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke={color} strokeWidth="2"/>
      <circle cx="12" cy="12" r="2" fill={color}/>
    </svg>
  );
}

export function CampaignIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M18 11v2h4v-2h-4m-2 6.61c.96.71 2.21 1.65 3.2 2.39c.4-.53.8-1.07 1.2-1.6c-.99-.74-2.24-1.68-3.2-2.4c-.4.54-.8 1.08-1.2 1.61M20.4 5.6c-.4-.53-.8-1.07-1.2-1.6c-.99.74-2.24 1.68-3.2 2.4c.4.53.8 1.07 1.2 1.6c.96-.72 2.21-1.65 3.2-2.4M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v4h2v-4h1l5 3V6L8 9H4"/>
    </svg>
  );
}

export function VolunteerIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3C4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5C22 5.42 19.58 3 16.5 3m-4.4 15.55l-.1.1l-.1-.1C7.14 14.24 4 11.39 4 8.5C4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5c0 2.89-3.14 5.74-7.9 10.05"/>
      <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21z"/>
    </svg>
  );
}

export function PrivacyTipIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V5l-9-4m0 6a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5a1.5 1.5 0 0 1-1.5-1.5A1.5 1.5 0 0 1 12 7m0 10c-1.93 0-3.5-1.57-3.5-3.5h2c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5h2c0 1.93-1.57 3.5-3.5 3.5"/>
    </svg>
  );
}

export function CloudUploadIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5c0-2.64-2.05-4.78-4.65-4.96M14 13v4h-4v-4H7l5-5l5 5h-3z"/>
    </svg>
  );
}

export function CalendarIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 16H5V8h14v11M9 10H7v2h2v-2m4 0h-2v2h2v-2m4 0h-2v2h2v-2m-8 4H7v2h2v-2m4 0h-2v2h2v-2m4 0h-2v2h2v-2"/>
    </svg>
  );
}

export function BarChartIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M22 21H2V3h2v16h2v-9h4v9h2V6h4v13h2v-5h4v7z"/>
    </svg>
  );
}

export function FeedbackIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m0 14H5.17L4 17.17V4h16v12m-9-4h2v2h-2v-2m0-6h2v4h-2V6"/>
    </svg>
  );
}

export function DesktopIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M21 2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7v2H8v2h8v-2h-2v-2h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m0 14H3V4h18v12"/>
    </svg>
  );
}

export function MobileIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2m0 18H7V5h10v14m-5 2a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1a1 1 0 0 1-1 1"/>
    </svg>
  );
}

export function WarningIcon({ className = "w-6 h-6", color = "currentColor" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2L1 21z"/>
    </svg>
  );
}

// Export all icons as a collection for easy importing
export const SoulPrintIcons = {
  Robot: RobotIcon,
  Robot2: Robot2Icon,
  PersonHeart: PersonHeartIcon,
  NetworkIntelligence: NetworkIntelligenceIcon,
  Lightbulb: LightbulbIcon,
  Lock: LockIcon,
  Chat: ChatIcon,
  Forum: ForumIcon,
  AccountCircle: AccountCircleIcon,
  SettingsHeart: SettingsHeartIcon,
  Target: TargetIcon,
  Campaign: CampaignIcon,
  Volunteer: VolunteerIcon,
  PrivacyTip: PrivacyTipIcon,
  CloudUpload: CloudUploadIcon,
  Calendar: CalendarIcon,
  BarChart: BarChartIcon,
  Feedback: FeedbackIcon,
  Desktop: DesktopIcon,
  Mobile: MobileIcon,
  Warning: WarningIcon,
};
