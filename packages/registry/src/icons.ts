import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { installItems } from "./install.js";
import type { RegistrySource } from "./load.js";
import { resolveItems } from "./resolve.js";
import { LAYOUT } from "./schema.js";

/**
 * Icon sets. The vocabulary is Zengin UI's: sixty-odd names every component and template draws by.
 * A set maps each name to an export of one react-icons module, and `zengin icons <set>` rewrites
 * src/lib/icons.tsx so the names come from that set. App code never imports react-icons directly; the
 * Icon manifest shadows it, and the engine says so.
 */

export const ICON_NAMES = [
  "Search", "Close", "Check", "ChevronDown", "ChevronUp", "ChevronLeft", "ChevronRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Plus", "Minus", "Trash", "Edit", "Settings", "Menu", "More", "Home", "User", "Users", "Bell", "Info", "Warning", "Error", "Success", "Help",
  "Copy", "ExternalLink", "Download", "Upload", "Filter", "Sun", "Moon", "Loader", "Grid", "CreditCard", "Mail", "Calendar", "Clock", "Eye", "EyeOff",
  "Lock", "LogOut", "Star", "Send", "Paperclip", "Sparkles", "Link", "Refresh", "Globe", "File", "Folder", "Tag", "Inbox", "Message", "Code", "Terminal",
  "Chart", "Layers", "Database", "Shield", "Drag",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export interface IconSetSpec {
  title: string;
  description: string;
  /** The react-icons module, e.g. `react-icons/lu`. */
  module: string;
  /** Vocabulary name -> export name in the module. */
  names: Record<IconName, string>;
}

const names = (prefix: string, map: Record<IconName, string>): Record<IconName, string> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k, prefix + v])) as Record<IconName, string>;

export const ICON_SETS: Record<string, IconSetSpec> = {
  lucide: {
    title: "Lucide",
    description: "The set most React apps already use: even 2px strokes, round joins, one voice across a thousand glyphs.",
    module: "react-icons/lu",
    names: names("Lu", {
      Search: "Search", Close: "X", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash2", Edit: "Pencil",
      Settings: "Settings", Menu: "Menu", More: "Ellipsis", Home: "House", User: "User", Users: "Users", Bell: "Bell", Info: "Info", Warning: "TriangleAlert",
      Error: "CircleX", Success: "CircleCheck", Help: "CircleHelp", Copy: "Copy", ExternalLink: "ExternalLink", Download: "Download", Upload: "Upload", Filter: "Filter",
      Sun: "Sun", Moon: "Moon", Loader: "Loader", Grid: "LayoutGrid", CreditCard: "CreditCard", Mail: "Mail", Calendar: "Calendar", Clock: "Clock", Eye: "Eye",
      EyeOff: "EyeOff", Lock: "Lock", LogOut: "LogOut", Star: "Star", Send: "Send", Paperclip: "Paperclip", Sparkles: "Sparkles", Link: "Link", Refresh: "RefreshCw",
      Globe: "Globe", File: "File", Folder: "Folder", Tag: "Tag", Inbox: "Inbox", Message: "MessageSquare", Code: "Code", Terminal: "Terminal", Chart: "ChartBar",
      Layers: "Layers", Database: "Database", Shield: "Shield", Drag: "GripVertical",
    }),
  },
  tabler: {
    title: "Tabler",
    description: "Thin, wide, a little technical. Four thousand glyphs on a 24 grid; suits dashboards and dense tables.",
    module: "react-icons/tb",
    names: names("Tb", {
      Search: "Search", Close: "X", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash", Edit: "Pencil",
      Settings: "Settings", Menu: "Menu2", More: "Dots", Home: "Home", User: "User", Users: "Users", Bell: "Bell", Info: "InfoCircle", Warning: "AlertTriangle",
      Error: "AlertCircle", Success: "CircleCheck", Help: "HelpCircle", Copy: "Copy", ExternalLink: "ExternalLink", Download: "Download", Upload: "Upload", Filter: "Filter",
      Sun: "Sun", Moon: "Moon", Loader: "Loader2", Grid: "LayoutGrid", CreditCard: "CreditCard", Mail: "Mail", Calendar: "Calendar", Clock: "Clock", Eye: "Eye",
      EyeOff: "EyeOff", Lock: "Lock", LogOut: "Logout", Star: "Star", Send: "Send", Paperclip: "Paperclip", Sparkles: "Sparkles", Link: "Link", Refresh: "Refresh",
      Globe: "World", File: "File", Folder: "Folder", Tag: "Tag", Inbox: "Inbox", Message: "Message", Code: "Code", Terminal: "Terminal2", Chart: "ChartBar",
      Layers: "Stack2", Database: "Database", Shield: "Shield", Drag: "GripVertical",
    }),
  },
  phosphor: {
    title: "Phosphor",
    description: "Friendly and geometric, with a bit more curve than Lucide. Regular weight here; the family has five more.",
    module: "react-icons/pi",
    names: names("Pi", {
      Search: "MagnifyingGlass", Close: "X", Check: "Check", ChevronDown: "CaretDown", ChevronUp: "CaretUp", ChevronLeft: "CaretLeft", ChevronRight: "CaretRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash", Edit: "PencilSimple",
      Settings: "Gear", Menu: "List", More: "DotsThree", Home: "House", User: "User", Users: "Users", Bell: "Bell", Info: "Info", Warning: "Warning",
      Error: "WarningCircle", Success: "CheckCircle", Help: "Question", Copy: "Copy", ExternalLink: "ArrowSquareOut", Download: "DownloadSimple", Upload: "UploadSimple",
      Filter: "Funnel", Sun: "Sun", Moon: "Moon", Loader: "Spinner", Grid: "SquaresFour", CreditCard: "CreditCard", Mail: "Envelope", Calendar: "Calendar", Clock: "Clock",
      Eye: "Eye", EyeOff: "EyeSlash", Lock: "Lock", LogOut: "SignOut", Star: "Star", Send: "PaperPlaneRight", Paperclip: "Paperclip", Sparkles: "Sparkle", Link: "Link",
      Refresh: "ArrowsClockwise", Globe: "Globe", File: "File", Folder: "Folder", Tag: "Tag", Inbox: "Tray", Message: "ChatCircle", Code: "Code", Terminal: "Terminal",
      Chart: "ChartBar", Layers: "Stack", Database: "Database", Shield: "Shield", Drag: "DotsSixVertical",
    }),
  },
  heroicons: {
    title: "Heroicons",
    description: "Tailwind's set, outline weight. Slightly heavier strokes and rounder forms; reads well at 20 and 24.",
    module: "react-icons/hi2",
    names: names("HiOutline", {
      Search: "MagnifyingGlass", Close: "XMark", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash", Edit: "Pencil",
      Settings: "Cog6Tooth", Menu: "Bars3", More: "EllipsisHorizontal", Home: "Home", User: "User", Users: "Users", Bell: "Bell", Info: "InformationCircle",
      Warning: "ExclamationTriangle", Error: "ExclamationCircle", Success: "CheckCircle", Help: "QuestionMarkCircle", Copy: "DocumentDuplicate", ExternalLink: "ArrowTopRightOnSquare",
      Download: "ArrowDownTray", Upload: "ArrowUpTray", Filter: "Funnel", Sun: "Sun", Moon: "Moon", Loader: "ArrowPath", Grid: "Squares2X2", CreditCard: "CreditCard",
      Mail: "Envelope", Calendar: "Calendar", Clock: "Clock", Eye: "Eye", EyeOff: "EyeSlash", Lock: "LockClosed", LogOut: "ArrowRightOnRectangle", Star: "Star",
      Send: "PaperAirplane", Paperclip: "PaperClip", Sparkles: "Sparkles", Link: "Link", Refresh: "ArrowPath", Globe: "GlobeAlt", File: "Document", Folder: "Folder",
      Tag: "Tag", Inbox: "Inbox", Message: "ChatBubbleLeft", Code: "CodeBracket", Terminal: "CommandLine", Chart: "ChartBar", Layers: "Square3Stack3D",
      Database: "CircleStack", Shield: "ShieldCheck", Drag: "EllipsisVertical",
    }),
  },
  feather: {
    title: "Feather",
    description: "The original minimal line set: 2px, 24 grid, nothing extra. Fewer glyphs, every one of them calm.",
    module: "react-icons/fi",
    names: names("Fi", {
      Search: "Search", Close: "X", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash2", Edit: "Edit2",
      Settings: "Settings", Menu: "Menu", More: "MoreHorizontal", Home: "Home", User: "User", Users: "Users", Bell: "Bell", Info: "Info", Warning: "AlertTriangle",
      Error: "AlertCircle", Success: "CheckCircle", Help: "HelpCircle", Copy: "Copy", ExternalLink: "ExternalLink", Download: "Download", Upload: "Upload", Filter: "Filter",
      Sun: "Sun", Moon: "Moon", Loader: "Loader", Grid: "Grid", CreditCard: "CreditCard", Mail: "Mail", Calendar: "Calendar", Clock: "Clock", Eye: "Eye", EyeOff: "EyeOff",
      Lock: "Lock", LogOut: "LogOut", Star: "Star", Send: "Send", Paperclip: "Paperclip", Sparkles: "Zap", Link: "Link", Refresh: "RefreshCw", Globe: "Globe", File: "File",
      Folder: "Folder", Tag: "Tag", Inbox: "Inbox", Message: "MessageSquare", Code: "Code", Terminal: "Terminal", Chart: "BarChart2", Layers: "Layers", Database: "Database",
      Shield: "Shield", Drag: "MoreVertical",
    }),
  },
  radix: {
    title: "Radix",
    description: "15-pixel glyphs drawn for dense interfaces: crisp at small sizes, the set Radix Themes ships.",
    module: "react-icons/rx",
    names: names("Rx", {
      Search: "MagnifyingGlass", Close: "Cross2", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Minus", Trash: "Trash", Edit: "Pencil1",
      Settings: "Gear", Menu: "HamburgerMenu", More: "DotsHorizontal", Home: "Home", User: "Person", Users: "Person", Bell: "Bell", Info: "InfoCircled",
      Warning: "ExclamationTriangle", Error: "CrossCircled", Success: "CheckCircled", Help: "QuestionMarkCircled", Copy: "Copy", ExternalLink: "ExternalLink",
      Download: "Download", Upload: "Upload", Filter: "MixerHorizontal", Sun: "Sun", Moon: "Moon", Loader: "Update", Grid: "Grid", CreditCard: "IdCard", Mail: "EnvelopeClosed",
      Calendar: "Calendar", Clock: "Clock", Eye: "EyeOpen", EyeOff: "EyeClosed", Lock: "LockClosed", LogOut: "Exit", Star: "Star", Send: "PaperPlane", Paperclip: "Link2",
      Sparkles: "MagicWand", Link: "Link1", Refresh: "Reload", Globe: "Globe", File: "FileText", Folder: "Archive", Tag: "Bookmark", Inbox: "EnvelopeOpen",
      Message: "ChatBubble", Code: "Code", Terminal: "Code", Chart: "BarChart", Layers: "Layers", Database: "Archive", Shield: "LockClosed", Drag: "DragHandleDots2",
    }),
  },
  material: {
    title: "Material",
    description: "Google's filled set, outlined where a hollow reads better. Heavier than the line sets; matches Material apps.",
    module: "react-icons/md",
    names: names("Md", {
      Search: "Search", Close: "Close", Check: "Check", ChevronDown: "ExpandMore", ChevronUp: "ExpandLess", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUpward", ArrowDown: "ArrowDownward", ArrowLeft: "ArrowBack", ArrowRight: "ArrowForward", Plus: "Add", Minus: "Remove", Trash: "DeleteOutline", Edit: "Edit",
      Settings: "Settings", Menu: "Menu", More: "MoreHoriz", Home: "Home", User: "Person", Users: "People", Bell: "Notifications", Info: "InfoOutline", Warning: "WarningAmber",
      Error: "ErrorOutline", Success: "CheckCircleOutline", Help: "HelpOutline", Copy: "ContentCopy", ExternalLink: "OpenInNew", Download: "Download", Upload: "Upload",
      Filter: "FilterList", Sun: "LightMode", Moon: "DarkMode", Loader: "Refresh", Grid: "GridView", CreditCard: "CreditCard", Mail: "MailOutline", Calendar: "CalendarToday",
      Clock: "AccessTime", Eye: "Visibility", EyeOff: "VisibilityOff", Lock: "LockOutline", LogOut: "Logout", Star: "StarBorder", Send: "Send", Paperclip: "AttachFile",
      Sparkles: "AutoAwesome", Link: "Link", Refresh: "Refresh", Globe: "Public", File: "InsertDriveFile", Folder: "Folder", Tag: "LabelOutline", Inbox: "Inbox",
      Message: "ChatBubbleOutline", Code: "Code", Terminal: "Terminal", Chart: "BarChart", Layers: "Layers", Database: "Storage", Shield: "Shield", Drag: "DragIndicator",
    }),
  },
  bootstrap: {
    title: "Bootstrap",
    description: "Bootstrap's own set: fine 1px-ish strokes on a 16 grid, drawn small first. Quiet next to text.",
    module: "react-icons/bs",
    names: names("Bs", {
      Search: "Search", Close: "X", Check: "Check", ChevronDown: "ChevronDown", ChevronUp: "ChevronUp", ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Plus: "Plus", Minus: "Dash", Trash: "Trash", Edit: "Pencil",
      Settings: "Gear", Menu: "List", More: "ThreeDots", Home: "House", User: "Person", Users: "People", Bell: "Bell", Info: "InfoCircle", Warning: "ExclamationTriangle",
      Error: "ExclamationCircle", Success: "CheckCircle", Help: "QuestionCircle", Copy: "Copy", ExternalLink: "BoxArrowUpRight", Download: "Download", Upload: "Upload",
      Filter: "Funnel", Sun: "Sun", Moon: "Moon", Loader: "ArrowRepeat", Grid: "Grid", CreditCard: "CreditCard", Mail: "Envelope", Calendar: "Calendar", Clock: "Clock",
      Eye: "Eye", EyeOff: "EyeSlash", Lock: "Lock", LogOut: "BoxArrowRight", Star: "Star", Send: "Send", Paperclip: "Paperclip", Sparkles: "Stars", Link: "Link45Deg",
      Refresh: "ArrowClockwise", Globe: "Globe", File: "FileEarmark", Folder: "Folder", Tag: "Tag", Inbox: "Inbox", Message: "Chat", Code: "Code", Terminal: "Terminal",
      Chart: "BarChart", Layers: "Layers", Database: "Database", Shield: "Shield", Drag: "GripVertical",
    }),
  },
};

export const REACT_ICONS_VERSION = "^5.5.0";

/** src/lib/icons.tsx for a set: the same `Icon` object and types the default file exports, drawn by react-icons. */
export function renderIconsModule(name: string, set: IconSetSpec): string {
  const imports = [...new Set(Object.values(set.names))].sort();
  const entries = ICON_NAMES.map((n) => `  ${n}: ${set.names[n]},`);
  return `import type { IconBaseProps } from "react-icons";
import { ${imports.join(", ")} } from "${set.module}";

/**
 * The icon vocabulary, drawn by ${set.title} (${set.module}) since \`zengin icons ${name}\`. Components and app code
 * draw by name: <Icon.Search />. Run \`zengin icons <set>\` again to change every icon at once, or edit a line
 * here to swap one glyph. Sized by font-size (1em) unless \`size\` says otherwise, like every react-icons glyph.
 */
export const Icon = {
${entries.join("\n")}
} as const;

export type IconName = keyof typeof Icon;
export const iconNames = Object.keys(Icon) as IconName[];
export type IconProps = IconBaseProps;
export type IconComponent = (typeof Icon)[IconName];
export type IconSet = Partial<Record<IconName, IconComponent>>;

/** Kept for API parity with the default module; a project on a fixed set has nothing to swap at runtime. */
export function setIconSet(_set: IconSet): void {}
`;
}

export interface IconsSummary {
  name: string;
  title: string;
  description: string;
  module: string;
}

export async function listIconSets(source: RegistrySource): Promise<IconsSummary[]> {
  const index = await source.index();
  return index.items.filter((i) => i.type === "icons" && i.iconSet).map((i) => ({ name: i.name.replace(/^icons-/, ""), title: i.title, description: i.description, module: i.iconSet!.module }));
}

export interface ApplyIconsResult {
  name: string;
  module: string;
  files: string[];
  /** npm packages the project now needs; the caller says how to install them. */
  dependencies: Record<string, string>;
  /** The file that was replaced, when the project already had one. */
  replaced: boolean;
}

/** Points the project's icon vocabulary at a set: rewrites src/lib/icons.tsx and records the react-icons dependency. */
export async function applyIcons(opts: { projectDir: string; name: string; source: RegistrySource }): Promise<ApplyIconsResult> {
  const dir = resolve(opts.projectDir);
  if (!existsSync(join(dir, "zengin.config.yaml"))) throw new Error(`${dir} has no zengin.config.yaml. Run zengin icons inside a project made by zengin create, or pass --dir.`);
  const index = await opts.source.index();
  const itemName = `icons-${opts.name.replace(/^icons-/, "")}`;
  const summary = index.items.find((i) => i.name === itemName && i.type === "icons");
  if (!summary) {
    const sets = index.items.filter((i) => i.type === "icons").map((i) => i.name.replace(/^icons-/, ""));
    throw new Error(`No icon set "${opts.name}". Sets: ${sets.join(", ")}.`);
  }
  const target = join(dir, LAYOUT.libDir, "icons.tsx");
  const replaced = existsSync(target);
  const items = await resolveItems(opts.source, [itemName]);
  const r = installItems({ projectDir: dir, items, version: index.version, force: true });
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string> };
    pkg.dependencies = { ...pkg.dependencies, ...r.dependencies };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  return { name: opts.name.replace(/^icons-/, ""), module: summary.iconSet!.module, files: r.written, dependencies: r.dependencies, replaced };
}
