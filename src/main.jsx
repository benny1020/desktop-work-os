import React, { useCallback, useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { createRoot } from "react-dom/client";
import {
  X as IconX,
  Activity as IconActivity,
  AlertTriangle as IconAlertTriangle,
  ArrowDown as IconArrowDown,
  ArrowLeft as IconArrowLeft,
  ArrowRight as IconArrowRight,
  ArrowUp as IconArrowUp,
  ArrowUpRight as IconArrowUpRight,
  Bell as IconBell,
  BookOpen as IconBookOpen,
  Braces as IconBraces,
  Calendar as IconCalendar,
  CalendarArrowUp as IconCalendarArrowUp,
  CalendarDays as IconCalendarDays,
  CalendarPlus as IconCalendarPlus,
  Check as IconCheck,
  ChevronDown as IconChevronDown,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  ChevronsUpDown as IconChevronsUpDown,
  Circle as IconCircle,
  CircleCheck as IconCircleCheck,
  CircleDashed as IconCircleDashed,
  CircleDot as IconCircleDot,
  Clock3 as IconClock3,
  Code as IconCode,
  Cog as IconCog,
  Command as IconCommand,
  CornerDownLeft as IconCornerDownLeft,
  Expand as IconExpand,
  Eye as IconEye,
  EyeOff as IconEyeOff,
  FileCode2 as IconFileCode2,
  FileText as IconFileText,
  Filter as IconFilter,
  Focus as IconFocus,
  Folder as IconFolder,
  FolderGit2 as IconFolderGit2,
  GitBranch as IconGitBranch,
  GitCommitHorizontal as IconGitCommitHorizontal,
  GitPullRequest as IconGitPullRequest,
  Gitlab as IconGitlab,
  GripVertical as IconGripVertical,
  Group as IconGroup,
  History as IconHistory,
  Home as IconHome,
  Inbox as IconInbox,
  Info as IconInfo,
  Inspect as IconInspect,
  Key as IconKey,
  Keyboard as IconKeyboard,
  Layers as IconLayers,
  Link as IconLink,
  Link2 as IconLink2,
  ListOrdered as IconListOrdered,
  Loader as IconLoader,
  LockKeyhole as IconLockKeyhole,
  Logs as IconLogs,
  Maximize2 as IconMaximize2,
  Merge as IconMerge,
  MessageSquare as IconMessageSquare,
  Moon as IconMoon,
  MousePointer2 as IconMousePointer2,
  Move as IconMove,
  Network as IconNetwork,
  Orbit as IconOrbit,
  PanelLeftClose as IconPanelLeftClose,
  PanelLeftOpen as IconPanelLeftOpen,
  PanelRight as IconPanelRight,
  Paperclip as IconPaperclip,
  Plus as IconPlus,
  Rocket as IconRocket,
  RotateCw as IconRotateCw,
  ScrollText as IconScrollText,
  Search as IconSearch,
  Send as IconSend,
  Server as IconServer,
  Settings as IconSettings,
  Share as IconShare,
  ShieldCheck as IconShieldCheck,
  Signal as IconSignal,
  Siren as IconSiren,
  Sparkles as IconSparkles,
  Square as IconSquare,
  SquareCheck as IconSquareCheck,
  Star as IconStar,
  Sun as IconSun,
  TriangleAlert as IconTriangleAlert,
  User as IconUser,
  Users as IconUsers,
  Video as IconVideo,
  View as IconView,
  Wallet as IconWallet,
  Webhook as IconWebhook,
} from "lucide-react";
const Icons = {
  X: IconX,
  Activity: IconActivity,
  AlertTriangle: IconAlertTriangle,
  ArrowDown: IconArrowDown,
  ArrowLeft: IconArrowLeft,
  ArrowRight: IconArrowRight,
  ArrowUp: IconArrowUp,
  ArrowUpRight: IconArrowUpRight,
  Bell: IconBell,
  BookOpen: IconBookOpen,
  Braces: IconBraces,
  Calendar: IconCalendar,
  CalendarArrowUp: IconCalendarArrowUp,
  CalendarDays: IconCalendarDays,
  CalendarPlus: IconCalendarPlus,
  Check: IconCheck,
  ChevronDown: IconChevronDown,
  ChevronLeft: IconChevronLeft,
  ChevronRight: IconChevronRight,
  ChevronsUpDown: IconChevronsUpDown,
  Circle: IconCircle,
  CircleCheck: IconCircleCheck,
  CircleDashed: IconCircleDashed,
  CircleDot: IconCircleDot,
  Clock3: IconClock3,
  Code: IconCode,
  Cog: IconCog,
  Command: IconCommand,
  CornerDownLeft: IconCornerDownLeft,
  Expand: IconExpand,
  Eye: IconEye,
  EyeOff: IconEyeOff,
  FileCode2: IconFileCode2,
  FileText: IconFileText,
  Filter: IconFilter,
  Focus: IconFocus,
  Folder: IconFolder,
  FolderGit2: IconFolderGit2,
  GitBranch: IconGitBranch,
  GitCommitHorizontal: IconGitCommitHorizontal,
  GitPullRequest: IconGitPullRequest,
  Gitlab: IconGitlab,
  GripVertical: IconGripVertical,
  Group: IconGroup,
  History: IconHistory,
  Home: IconHome,
  Inbox: IconInbox,
  Info: IconInfo,
  Inspect: IconInspect,
  Key: IconKey,
  Keyboard: IconKeyboard,
  Layers: IconLayers,
  Link: IconLink,
  Link2: IconLink2,
  ListOrdered: IconListOrdered,
  Loader: IconLoader,
  LockKeyhole: IconLockKeyhole,
  Logs: IconLogs,
  Maximize2: IconMaximize2,
  Merge: IconMerge,
  MessageSquare: IconMessageSquare,
  Moon: IconMoon,
  MousePointer2: IconMousePointer2,
  Move: IconMove,
  Network: IconNetwork,
  Orbit: IconOrbit,
  PanelLeftClose: IconPanelLeftClose,
  PanelLeftOpen: IconPanelLeftOpen,
  PanelRight: IconPanelRight,
  Paperclip: IconPaperclip,
  Plus: IconPlus,
  Rocket: IconRocket,
  RotateCw: IconRotateCw,
  ScrollText: IconScrollText,
  Search: IconSearch,
  Send: IconSend,
  Server: IconServer,
  Settings: IconSettings,
  Share: IconShare,
  ShieldCheck: IconShieldCheck,
  Signal: IconSignal,
  Siren: IconSiren,
  Sparkles: IconSparkles,
  Square: IconSquare,
  SquareCheck: IconSquareCheck,
  Star: IconStar,
  Sun: IconSun,
  TriangleAlert: IconTriangleAlert,
  User: IconUser,
  Users: IconUsers,
  Video: IconVideo,
  View: IconView,
  Wallet: IconWallet,
  Webhook: IconWebhook,
};
import {
  initialIssues,
  initialMRs,
  documents,
  members,
  events,
  logs,
  navigation,
} from "./data";
import "./styles.css";
import "./connected.css";
import IntegrationSettings from "./components/IntegrationSettings";
import ReviewWorkbench from "./components/ReviewWorkbench";
import ConnectedWorkspace, {
  ConnectedAssistant,
} from "./components/ConnectedWorkspace";
import { demoSnapshot } from "./lib/demo-review";
import { orderDiff, fileDiffs } from "./reviewData";
import { docContent } from "./docData";

if (navigator.userAgent.includes("Electron"))
  document.documentElement.classList.add("electron");
const I = ({ name, size = 16, ...props }) => {
  const C = Icons[name] || Icons.Circle;
  return <C size={size} strokeWidth={1.7} {...props} />;
};
const cx = (...xs) => xs.filter(Boolean).join(" ");
function persisted(key, initial) {
  try {
    return JSON.parse(localStorage.getItem("orbit-" + key)) ?? initial;
  } catch {
    return initial;
  }
}
const initials = (name) =>
  name
    .split(" ")
    .map((x) => x[0])
    .join("");
function Avatar({ name = "Alex Kim", small = false }) {
  return (
    <span
      className={cx(
        "avatar",
        small && "small",
        members.find((m) => m.name === name)?.color,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
function Status({ status }) {
  return (
    <span className={cx("status", status.toLowerCase().replaceAll(" ", "-"))}>
      <I
        name={
          status === "Done" || status === "Merged" || status === "Approved"
            ? "CircleCheck"
            : status === "In Progress"
              ? "CircleDashed"
              : status.includes("Review") || status === "In review"
                ? "CircleDot"
                : "Circle"
        }
        size={13}
      />
      {status}
    </span>
  );
}
function Priority({ value }) {
  return (
    <span className={cx("priority", value?.toLowerCase())}>
      <I name={value === "Urgent" ? "AlertTriangle" : "Signal"} size={13} />
      {value}
    </span>
  );
}
function Btn({
  children,
  icon,
  onClick,
  primary = false,
  className = "",
  ...rest
}) {
  return (
    <button
      className={cx("btn", primary && "primary", className)}
      onClick={onClick}
      {...rest}
    >
      {icon && <I name={icon} size={14} />} {children}
    </button>
  );
}
import ConnectedCommands, { advanceCommandCredentialScope } from "./components/ConnectedCommands";
import AssistantAvatar from "./components/AssistantAvatar";
import { advanceAssistantCredentialScope } from "./lib/assistant-session";
import ConnectedObjects from "./components/ConnectedObjects";
import ConnectedAttention from "./components/ConnectedAttention";
import {usePlan, parseQuick, dayKey} from "./lib/planning";
import "./workspace.css";
import "./product-polish.css";
import "./review-large-pr.css";
import "./review-code.css";
import ProductGuide, { WorklaneMark } from "./components/ProductGuide";
function App() {
  const [showGuide,setShowGuide] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState(()=>persisted("workspaceMode","demo"));
  const [liveObject,setLiveObject]=useState(null);
  const liveObjectFocus = useRef(null);
  const pendingReviewRef = useRef("");
  const [pendingReview, setPendingReview] = useState("");
  const onReviewPendingChange = useCallback((value) => {
    pendingReviewRef.current = value;
    setPendingReview(value);
  }, []);
  function reviewNavigationBlocked() {
    if (!pendingReviewRef.current) return false;
    notify("Your review is being submitted. Navigation returns when the request finishes.");
    return true;
  }
  function openPalette(mode) {
    if (!reviewNavigationBlocked()) setPalette(mode);
  }
  const planningNavigationRequest = useRef(0);
  function openLiveObject(object) {
    if (reviewNavigationBlocked()) return;
    if (!liveObject) {
      const active = document.activeElement;
      liveObjectFocus.current = active?.closest('.connected-attention')
        ? document.querySelector('[aria-label="Notifications"]')
        : active?.closest('.recent-popover')
          ? document.querySelector('[aria-label="Recently viewed"]')
          : active?.closest('[role="dialog"]')
            ? document.querySelector('[aria-label="Global search"]')
            : active;
    }
    setLiveObject(object);
  }
  const livePlan=usePlan();
  useEffect(()=>localStorage.setItem("orbit-workspaceMode",JSON.stringify(workspaceMode)),[workspaceMode]);
  const [configVersion, setConfigVersion] = useState(0);
  const [liveContext, setLiveContext] = useState("");
  const [visualReview, setVisualReview] = useState(true);
  // Keep each exact-diff review's reading context when switching tools or MRs.
  // ReviewWorkbench validates the saved version before restoring it.
  const demoReviewSessions = useRef(new Map());
  const [issues, setIssues] = useState(() =>
    persisted("issues", initialIssues),
  );
  const [mrs, setMRs] = useState(() => {
    const saved = persisted("mrs", initialMRs);
    const sample = initialMRs.find(mr => mr.id === '428');
    return saved.some(mr => mr.id === sample.id) ? saved : [...saved, sample];
  });
  const [comments, setComments] = useState(() => persisted("comments", {}));
  const [incidents, setIncidents] = useState(() => persisted("incidents", []));
  const [customDocs, setCustomDocs] = useState(() => persisted("docs", []));
  const [theme, setTheme] = useState(() => persisted("theme", "light"));
  const [route, setRoute] = useState({ section: "Home", view: "Home" });
  const [history, setHistory] = useState([{ section: "Home", view: "Home" }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [sidebar, setSidebar] = useState(() => {
    const saved = persisted("sidebar", {});
    return {
      mode: ["expanded", "icons", "hidden"].includes(saved?.mode) ? saved.mode : "expanded",
      lastVisible: saved?.lastVisible === "icons" ? "icons" : "expanded",
    };
  });
  const collapsed = sidebar.mode === "icons";
  const sidebarHidden = sidebar.mode === "hidden";
  const sidebarToggle = useRef(null);
  const [inspector, setInspector] = useState(null);
  const [panelHistory, setPanelHistory] = useState([]);
  const [recent, setRecent] = useState([]);
  const [assistant, setAssistant] = useState(false);
  const [palette, setPalette] = useState(null);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [docId, setDocId] = useState("retry-policy");
  const [selectedMR, setSelectedMR] = useState("391");
  const [filters, setFilters] = useState({});
  const filter = filters[route.section] || "";
  const setFilter = (value) =>
    setFilters((f) => ({ ...f, [route.section]: value }));
  const inspectorOrigin = useRef(null);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [logFilters, setLogFilters] = useState([]);
  const [viewedFiles, setViewedFiles] = useState(() =>
    persisted("viewed-files", {}),
  );
  const [reviewDrafts, setReviewDrafts] = useState(() =>
    persisted("review-drafts", {}),
  );
  const [reviewOutcome, setReviewOutcome] = useState("Comment");
  const [project, setProject] = useState("All projects");
  const [workDay, setWorkDay] = useState("Fri");
  const [calendarMode, setCalendarMode] = useState("Week");
  const [showCompleted, setShowCompleted] = useState(false);
  const [logQuery, setLogQuery] = useState("");
  const [logService, setLogService] = useState("All services");
  const [logLevel, setLogLevel] = useState("All levels");
  const [logEnv, setLogEnv] = useState("production");
  const [logRange, setLogRange] = useState("Last 15 minutes");
  const dragRef = useRef(null);
  const setDragId = (id) => {
    dragRef.current = id;
  };
  const [favoriteDocs, setFavoriteDocs] = useState(() =>
    persisted("favorites", ["retry-policy"]),
  );
  const [prefs, setPrefs] = useState(() =>
    persisted("prefs", {
      mentions: true,
      reviews: true,
      alerts: true,
      digest: true,
    }),
  );
  const [reviewTab, setReviewTab] = useState("Changes");
  const [selectedFile, setSelectedFile] = useState(1);
  const [line, setLine] = useState(null);
  const [reviewEditors, setReviewEditors] = useState(() =>
    persisted("review-editors", {}),
  );
  const reviewEditorKey = `${selectedMR}:${reviewTab === "Discussion" ? "discussion" : `${selectedFile}:${line || "general"}`}`;
  const reviewText = reviewEditors[reviewEditorKey] || "";
  const setReviewText = (text) =>
    setReviewEditors((e) => ({ ...e, [reviewEditorKey]: text }));
  const [quickText, setQuickText] = useState("");
  const [workBacklogQuery, setWorkBacklogQuery] = useState("");
  const [activePop, setActivePop] = useState(null);
  const toastTimer = useRef();
  const shellPopover = notifications ? "notifications" : ["recent", "workspace", "sidebar"].includes(activePop) ? activePop : null;
  const popoverSelectors = {
    notifications: ['.notification-popover, .connected-attention', '[aria-label="Notifications"]'],
    recent: ['.recent-popover', '[aria-label="Recently viewed"]'],
    workspace: ['.workspace-popover', '[aria-label="Workspace switcher"]'],
    sidebar: ['.sidebar-options', '[aria-label="Sidebar options"]'],
  };
  function dismissPopover(restoreFocus = false) {
    const trigger = shellPopover && document.querySelector(popoverSelectors[shellPopover][1]);
    setNotifications(false);
    setActivePop(null);
    if (restoreFocus) requestAnimationFrame(() => { if (!document.querySelector('[role="dialog"]') && trigger?.isConnected) trigger.focus(); });
  }
  useEffect(() => {
    if (!shellPopover) return;
    const [panelSelector, triggerSelector] = popoverSelectors[shellPopover];
    const panel = document.querySelector(panelSelector);
    (panel?.querySelector('button:not(:disabled)') || panel)?.focus();
    const outside = (event) => {
      if (!event.target.closest(`${panelSelector}, ${triggerSelector}`)) dismissPopover();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [shellPopover]);
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({top:0,left:0});
  }, [route.section, route.view]);
  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }
  useEffect(() => {
    try { localStorage.setItem("orbit-sidebar", JSON.stringify(sidebar)); } catch { /* Keep the current layout usable when storage is unavailable. */ }
  }, [sidebar]);
  function changeSidebar(mode) {
    setSidebar(previous => ({ mode, lastVisible: mode === "hidden" ? previous.lastVisible : mode }));
    setActivePop(null);
    requestAnimationFrame(() => sidebarToggle.current?.focus());
  }
  useEffect(() => {
    for (const [k, v] of Object.entries({
      "viewed-files": viewedFiles,
      "review-drafts": reviewDrafts,
      "review-editors": reviewEditors,
      issues,
      mrs,
      comments,
      incidents,
      docs: customDocs,
      theme,
      favorites: favoriteDocs,
      prefs,
    }))
      localStorage.setItem("orbit-" + k, JSON.stringify(v));
    document.documentElement.dataset.theme = theme;
  }, [
    viewedFiles,
    reviewDrafts,
    reviewEditors,
    issues,
    mrs,
    comments,
    incidents,
    customDocs,
    theme,
    favoriteDocs,
    prefs,
  ]);
  function navigate(section, view, scope) {
    if (reviewNavigationBlocked()) return;
    setLiveContext("");
    setLiveObject(null);
    if (scope?.project) setProject(scope.project);
    if (scope?.filter) setFilters((f) => ({ ...f, [section]: scope.filter }));
    const next = {
      section,
      view:
        view || navigation.find((n) => n.name === section)?.views[0] || "Home",
    };
    if (scope?.mrId) next.mrId = scope.mrId;
    if (scope?.taskId) {
      next.taskId = scope.taskId;
      next.planDate = scope.planDate;
      next.focusRequestId = ++planningNavigationRequest.current;
    }
    const enterToday = workspaceMode === "connected" && section === "My Work" && next.view === "Today" && !scope?.taskId;
    if (enterToday) {
      next.planDate = dayKey();
      next.focusRequestId = ++planningNavigationRequest.current;
    }
    if (JSON.stringify(next) !== JSON.stringify(route)) {
      setRoute(next);
      if (enterToday && route.section === section && route.view === next.view) {
        setHistory(h => h.map((entry, index) => index === historyIndex ? next : entry));
      } else {
        setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
        setHistoryIndex(historyIndex + 1);
      }
    }
    setNotifications(false);
    setInspector(null);
    setPanelHistory([]);
    setInspectorExpanded(false);
    setActivePop(null);
  }
  function goHistory(delta) {
    if (reviewNavigationBlocked()) return;
    const n = historyIndex + delta;
    if (n >= 0 && n < history.length) {
      setHistoryIndex(n);
      setRoute(history[n]);
      if (history[n].mrId) setSelectedMR(history[n].mrId);
      setPanelHistory([]);
      setInspectorExpanded(false);
      setActivePop(null);
      setNotifications(false);
      setLiveContext("");
      setLiveObject(null);
      setInspector(null);
    }
  }
  function closeInspector() {
    setInspector(null);
    setPanelHistory([]);
    setInspectorExpanded(false);
    requestAnimationFrame(() => {
      if (inspectorOrigin.current?.isConnected) inspectorOrigin.current.focus();
    });
  }
  function toggleLogFilter(field, value, op) {
    setLogFilters((fs) => {
      const same = fs.find((f) => f.field === field && f.value === value);
      const rest = fs.filter((f) => !(f.field === field && f.value === value));
      return same?.op === op ? rest : [...rest, { field, value, op }];
    });
  }
  function visibleLogs() {
    return logs.filter(
      (l) =>
        (logEnv === "All environments" || l.env === logEnv) &&
        (logService === "All services" || l.service === logService) &&
        (logLevel === "All levels" || l.level === logLevel) &&
        (l.message + " " + l.trace + " " + l.service)
          .toLowerCase()
          .includes(logQuery.toLowerCase()) &&
        (logRange !== "Last 5 minutes" || l.time >= "09:38:00") &&
        logFilters.every((f) =>
          f.op === "include"
            ? String(logFields(l)[f.field]) === String(f.value)
            : String(logFields(l)[f.field]) !== String(f.value),
        ),
    );
  }
  function preview(type, id) {
    if (!inspector && !document.activeElement?.closest('[role="dialog"]'))
      inspectorOrigin.current = document.activeElement;
    if (inspector) setPanelHistory((h) => [...h, inspector]);
    setInspector({ type, id });
    setRecent((r) =>
      [
        { type, id },
        ...r.filter((x) => !(x.type === type && x.id === id)),
      ].slice(0, 6),
    );
    setNotifications(false);
  }
  function panelBack() {
    if (panelHistory.length) {
      setInspector(panelHistory.at(-1));
      setPanelHistory((h) => h.slice(0, -1));
    } else closeInspector();
  }
  function updateIssue(id, patch) {
    setIssues((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function complete(id) {
    const issue = issues.find((x) => x.id === id);
    updateIssue(id, { status: issue.status === "Done" ? "Todo" : "Done" });
    notify(issue.status === "Done" ? "Task reopened" : "Task completed");
  }
  function schedule(id, day) {
    const dates = {
      Mon: "2025-09-29",
      Tue: "2025-09-30",
      Wed: "2025-10-01",
      Thu: "2025-10-02",
      Fri: "2025-10-03",
      Sat: "2025-10-04",
      Backlog: "",
    };
    updateIssue(id, { day, due: dates[day] || "2025-10-04" });
    notify(`${id} scheduled for ${day === "Sat" ? "tomorrow" : day}`);
  }
  function reorder(target) {
    const source = dragRef.current;
    if (!source || source === target) return;
    setIssues((xs) => {
      const next = [...xs];
      const from = next.findIndex((x) => x.id === source);
      const to = next.findIndex((x) => x.id === target);
      if (from < 0 || to < 0) return xs;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
    setDragId(null);
  }
  function review(id) {
    setVisualReview(true);
    setSelectedMR(id);
    setReviewTab("Changes");
    setSelectedFile(1);
    navigate("Code", "Review", { mrId: id });
  }
  function addComment(key, text, review) {
    if (!text.trim()) return;
    setComments((c) => ({
      ...c,
      [key]: [
        ...(c[key] || []),
        { text, author: "Alex Kim", time: "Just now",
          ...(review ? { id: crypto.randomUUID(), createdAt: new Date().toISOString(), review } : {}) },
      ],
    }));
    notify("Comment added");
  }
  function parseDemoQuick(text, targetDay = "Fri") {
    const dates = { Mon: "2025-09-29", Tue: "2025-09-30", Wed: "2025-10-01", Thu: "2025-10-02", Fri: "2025-10-03", Sat: "2025-10-04", Backlog: "" };
    const parsed = parseQuick(text, dates[targetDay] ?? dates.Fri, dates.Fri);
    return { ...parsed, day: Object.keys(dates).find((day) => dates[day] === parsed.date) || parsed.date };
  }
  function addQuick(text, type = "Task", targetDay = "Fri") {
    if (!text.trim()) return false;
    let parsed;
    try { parsed = parseDemoQuick(text, targetDay); }
    catch (error) { notify(error.message); return false; }
    const keys = text.toUpperCase().match(/\b[A-Z]+-\d+\b/g) || [];
    const existing = issues.find((x) => keys.includes(x.id));
    if (existing && type === "Task") {
      updateIssue(existing.id, { day: parsed.day, due: parsed.date, ...(parsed.time ? { time: parsed.time } : {}) });
      notify(`${existing.id} scheduled for ${parsed.date || "Backlog"}${parsed.time ? ` at ${parsed.time}` : ""}`);
      return true;
    }
    const id =
      (type === "Incident" ? "INC" : type === "Issue" ? "PAY" : "TASK") +
      "-" +
      (400 + issues.length + incidents.length + customDocs.length);
    const title = parsed.title;
    if (type === "Incident") {
      setIncidents((xs) => [
        ...xs,
        {
          id,
          title,
          status: "Investigating",
          service: "payment-api",
          issue: null,
        },
      ]);
      preview("incident", id);
    } else if (type === "Document") {
      setCustomDocs((xs) => [
        ...xs,
        {
          id,
          title,
          space: "Engineering",
          updated: "Just now",
          author: "Alex Kim",
          issue: "PAY-382",
        },
      ]);
      setDocId(id);
      navigate("Docs", "Home");
    } else {
      setIssues((xs) => [
        ...xs,
        {
          id,
          title,
          status: "Todo",
          priority: "Medium",
          assignee: "Alex Kim",
          sprint: "Sprint 24",
          due: parsed.date,
          day: parsed.day,
          time: parsed.time,
          project: "PAY",
          description: "Created in Worklane.",
        },
      ]);
      notify(`${id} created`);
    }
    return true;
  }
  useEffect(() => {
    let g = false;
    let timer;
    const handler = (e) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      // A focused dialog owns its keyboard interaction; never navigate the workspace behind it.
      if (document.querySelector('[role="dialog"]') && !palette) {
        const commandFromPreview = document.querySelector('.object-panel') &&
          (e.metaKey || e.ctrlKey) && (["k", "n"].includes(e.key.toLowerCase()) || e.code === "Backslash" || e.key === "\\");
        if (!commandFromPreview) { g = false; return; }
      }
      const typing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        ) || document.activeElement?.isContentEditable;
      if (!palette && (e.metaKey || e.ctrlKey) && !e.altKey && (e.code === "Backslash" || e.key === "\\")) {
        e.preventDefault();
        if (e.repeat) return;
        setSidebar(previous => previous.mode === "hidden"
          ? { mode: previous.lastVisible, lastVisible: previous.lastVisible }
          : { mode: "hidden", lastVisible: previous.mode });
        setActivePop(null);
        if (!document.querySelector('[role="dialog"]')) requestAnimationFrame(() => sidebarToggle.current?.focus());
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        ["k", "n", "j"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "j") { if (!palette) setAssistant((a) => !a); }
        else openPalette(e.key.toLowerCase() === "k" ? "search" : "create");
        return;
      }
      if (e.key === "Escape") {
        if (palette) return;
        if (shellPopover) dismissPopover(true);
        else if (activePop) setActivePop(null);
        else if (assistant) setAssistant(false);
        else if (inspector) closeInspector();
        return;
      }
      if (palette) return;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) { g = false; return; }
      if (g) {
        const section = {
          h: "Home",
          m: "My Work",
          p: "Projects",
          c: "Code",
          o: "Observe",
        }[e.key.toLowerCase()];
        if (section)
          navigate(
            section,
            section === "Projects"
              ? "Issues"
              : section === "Observe"
                ? "Logs"
                : undefined,
          );
        g = false;
      } else if (e.key.toLowerCase() === "g") {
        g = true;
        clearTimeout(timer);
        timer = setTimeout(() => (g = false), 1000);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearTimeout(timer);
    };
  }, [
    workspaceMode,
    historyIndex,
    history,
    assistant,
    palette,
    activePop,
    notifications,
    inspector,
  ]);
  const allDocs = [...documents, ...customDocs];
  const currentMR = mrs.find((m) => m.id === selectedMR) || mrs[0];
  const todayTasks = issues.filter(
    (x) =>
      x.assignee === "Alex Kim" &&
      x.due === (workDay === "Fri" ? "2025-10-03" : "2025-10-04"),
  );
  const sprintIssues = issues.filter((x) => x.sprint === "Sprint 24");
  const needsReview = mrs.filter((m) => m.status === "Review requested");
  const sectionHeader = (title, subtitle, actions) => (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
  const taskRow = (task, compact = false) => (
    <div
      key={task.id}
      className={cx(
        "task-row",
        task.status === "Done" && "completed",
        compact && "compact",
      )}
      draggable
      onDragStart={() => setDragId(task.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => reorder(task.id)}
    >
      <I name="GripVertical" size={13} className="drag-handle" />
      <button
        className="check-button"
        aria-label={`Complete ${task.id}`}
        onClick={() => complete(task.id)}
      >
        <I name={task.status === "Done" ? "SquareCheck" : "Square"} size={17} />
      </button>
      <button className="task-main" onClick={() => preview("issue", task.id)}>
        <span className="task-line">
          <span className="object-key">{task.id}</span>
          <span className="task-title">{task.title}</span>
        </span>
        {!compact && (
          <span className="task-meta">
            <Status status={task.status} />
            <span className="dot">·</span>
            <Priority value={task.priority} />
            {task.mr && (
              <span className="inline-link">
                <I name="GitPullRequest" size={12} /> !{task.mr}
              </span>
            )}
          </span>
        )}
      </button>
      {task.time && <span className="muted">{task.time}</span>}
      <button
        className="row-action"
        title="Move to tomorrow"
        aria-label={`Move ${task.id} to tomorrow`}
        onClick={() => schedule(task.id, "Sat")}
      >
        <I name="CalendarArrowUp" size={15} />
      </button>
      <Avatar name={task.assignee} small />
    </div>
  );
  const eventRow = (e) => (
    <button
      key={e.id}
      className="event-row"
      onClick={() => preview("event", e.id)}
    >
      <span className="event-time">
        {e.time}
        <span>{e.end}</span>
      </span>
      <span className="event-marker" />
      <span className="event-text">
        <strong>{e.title}</strong>
        <span>{e.room}</span>
      </span>
      <span className="event-attendees">
        <Avatar name="Sarah Park" small />
        <Avatar name="Daniel Lee" small />
        <span>+{e.people - 2}</span>
      </span>
      <I name="ChevronRight" size={14} />
    </button>
  );
  function Brief({ full = false }) {
    return (
      <section className={cx("brief", full && "full")}>
        <div className="brief-header">
          <span className="spark-icon">
            <I name="Sparkles" size={17} />
          </span>
          <strong>Assistant brief</strong>
          <span className="new-label">3 updates</span>
        </div>
        <p className="brief-intro">A little context for your day.</p>
        <div className="brief-item">
          <span className="brief-item-icon purple">
            <I name="GitPullRequest" />
          </span>
          <div>
            <button className="text-link" onClick={() => preview("mr", "391")}>
              A review is waiting on you
            </button>
            <p>
              Daniel requested your review on <b>!391</b>.<br />
              Order status mapping · 18h ago
            </p>
            <div className="brief-actions">
              <Btn onClick={() => review("391")}>
                Review changes <I name="ArrowUpRight" size={12} />
              </Btn>
              <button
                onClick={() => {
                  if (!issues.some((x) => x.id === "REV-391"))
                    setIssues((xs) => [
                      ...xs,
                      {
                        id: "REV-391",
                        title: "Review !391 · Fix order status mapping",
                        status: "Todo",
                        priority: "Medium",
                        assignee: "Alex Kim",
                        sprint: "Sprint 24",
                        day: "Fri",
                        due: "2025-10-03",
                        mr: "391",
                        project: "API",
                      },
                    ]);
                  notify("Review added to Today");
                }}
              >
                Add to today
              </button>
            </div>
          </div>
        </div>
        <div className="brief-item">
          <span className="brief-item-icon amber">
            <I name="Clock3" />
          </span>
          <div>
            <button
              className="text-link"
              onClick={() => preview("issue", "PAY-291")}
            >
              One deadline to keep in mind
            </button>
            <p>
              <b>PAY-291</b> is due tomorrow.
              <br />
              Webhook signature handling
            </p>
            <div className="brief-actions">
              <Btn onClick={() => preview("issue", "PAY-291")}>Open issue</Btn>
              <button onClick={() => schedule("PAY-291", "Fri")}>
                Plan for today
              </button>
            </div>
          </div>
        </div>
        <div className="brief-item">
          <span className="brief-item-icon red">
            <I name="Activity" />
          </span>
          <div>
            <button
              className="text-link"
              onClick={() => preview("alert", "alert-1")}
            >
              Payment errors are elevated
            </button>
            <p>
              Error rate increased after the <b>08:32 deploy</b>. Sarah is
              investigating.
            </p>
            <div className="brief-actions">
              <Btn
                onClick={() => {
                  setLogService("payment-api");
                  setLogLevel("ERROR");
                  navigate("Observe", "Logs");
                }}
              >
                Explore logs <I name="ArrowUpRight" size={12} />
              </Btn>
            </div>
          </div>
        </div>
        <div className="brief-footer">
          <I name="ShieldCheck" size={13} /> You’re in control. No actions
          taken.
        </div>
      </section>
    );
  }
  function Home() {
    const tasks = issues.filter(
      (x) =>
        x.assignee === "Alex Kim" &&
        x.due === "2025-10-03" &&
        x.status !== "Done",
    );
    return (
      <div className="home-page">
        <div className="greeting home-greeting">
          <div><div className="date-label">
            <span className="sun-mark">
              <I name="Sun" size={16} />
            </span>{" "}
            Friday, October 3
          </div>
          <h1>
            Good morning, Alex<span>.</span>
          </h1>
          <p>
            You have {tasks.length} tasks and 3 meetings today. Let’s make room
            for the important work.
          </p></div>
          <div className="home-entry-actions">
            <Btn onClick={() => setShowGuide(true)} aria-label="Explore workflows"><I name="MousePointer2" size={14}/> Explore workflows</Btn>
            <Btn onClick={() => navigate("Settings", "Integrations")}><I name="Link2" size={14}/> Connect tools</Btn>
          </div>
        </div>
        <section className="work-thread" aria-label="Connected work trail">
          <div className="work-thread-intro"><small>In focus · Payment reliability</small>
            <button className="work-thread-title" aria-label="Resume payment retry context" onClick={() => preview("issue", "PAY-382")}><span>PAY-382</span> Payment retry implementation <I name="ArrowUpRight" size={13}/></button>
          </div>
          <div className="work-trail">
            <button aria-label="Open PAY-382 context" onClick={() => preview("issue", "PAY-382")}><I name="CircleDot" size={14}/> Issue</button><I name="ChevronRight" size={12}/>
            <button aria-label="Open linked MR !381" onClick={() => preview("mr", "381")}><I name="GitPullRequest" size={14}/> !381</button><I name="ChevronRight" size={12}/>
            <button aria-label="Open linked pipeline #482" onClick={() => preview("pipeline", "482")}><I name="GitBranch" size={14}/> Pipeline</button><I name="ChevronRight" size={12}/>
            <button aria-label="Open linked payment policy" onClick={() => preview("doc", "retry-policy")}><I name="BookOpen" size={14}/> Wiki</button>
          </div>
        </section>
        <div className="home-grid">
          <div className="daily-column">
            <div className="section-title">
              <h2>
                Your day <span className="count">{tasks.length + 3}</span>
              </h2>
              <div>
                <button
                  className="quiet-button"
                  onClick={() => navigate("My Work", "Calendar")}
                >
                  <I name="CalendarDays" size={14} /> Open calendar
                </button>
                <button
                  className="icon-button"
                  aria-label="Add task"
                  onClick={() => openPalette("create")}
                >
                  <I name="Plus" />
                </button>
              </div>
            </div>
            <div className="agenda-label">
              <span>Schedule & priorities</span>
              <span>GMT+9</span>
            </div>
            {eventRow(events[0])}
            <div className="focus-block">
              <div className="focus-label">
                <I name="Focus" size={13} /> Focus time{" "}
                <span>09:30 – 11:30</span>
              </div>
              {tasks.slice(0, 2).map((t) => taskRow(t))}
            </div>
            {eventRow(events[1])}
            {eventRow(events[2])}
            {tasks.slice(2).map((t) => taskRow(t))}
            <button
              className="add-task-line"
              onClick={() => openPalette("create")}
            >
              <I name="Plus" size={15} /> Add a task to your day <kbd>⌘ N</kbd>
            </button>
            <div className="section-title sprint-title">
              <h2>
                Sprint 24 <span className="subtle">Payment reliability</span>
              </h2>
              <button
                className="quiet-button"
                onClick={() => navigate("Projects", "Board")}
              >
                View sprint <I name="ArrowUpRight" size={14} />
              </button>
            </div>
            <div className="sprint-summary">
              <div className="sprint-progress">
                <div>
                  <strong>
                    {sprintIssues.filter((x) => x.status === "Done").length}
                    <span>/{sprintIssues.length} issues complete</span>
                  </strong>
                  <span>Ends Oct 10</span>
                </div>
                <div className="progress-track">
                  {["Done", "In Progress", "In Review", "Todo"].map((s) => (
                    <span
                      key={s}
                      className={"progress-" + s.replaceAll(" ", "-")}
                      style={{
                        flex: Math.max(
                          0.1,
                          sprintIssues.filter((x) => x.status === s).length,
                        ),
                      }}
                    />
                  ))}
                </div>
                <div className="sprint-legend">
                  {["Done", "In Progress", "In Review", "Todo"].map((s) => (
                    <span key={s}>
                      <i className={"legend-" + s.replaceAll(" ", "-")} />
                      {sprintIssues.filter((x) => x.status === s).length} {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="section-title recent-heading">
              <h2>Pick up where you left off</h2>
              <I name="History" size={15} />
            </div>
            <div className="recent-links">
              <button onClick={() => preview("doc", "retry-policy")}>
                <span className="doc-mini">
                  <I name="FileText" size={17} />
                </span>
                <div>
                  Payment Retry Policy<small>Engineering / Payments</small>
                </div>
                <span>Yesterday</span>
                <I name="ChevronRight" size={14} />
              </button>
              <button onClick={() => preview("issue", "PAY-382")}>
                <span className="issue-mini">
                  <I name="CircleDashed" size={17} />
                </span>
                <div>
                  Payment retry implementation<small>PAY-382 / Sprint 24</small>
                </div>
                <span>42m ago</span>
                <I name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
          <div className="context-column">
            <Brief />
          </div>
        </div>
      </div>
    );
  }
  function MyWork() {
    const view = route.view;
    const quickTarget = view === "Backlog" ? "Backlog" : workDay;
    let quickPreview, quickError = "";
    if (quickText.trim()) {
      try { quickPreview = parseDemoQuick(quickText, quickTarget); }
      catch (error) { quickError = error.message; }
    }
    const quickEntry = () => <>
      <form className="quick-add" onSubmit={(event) => {
        event.preventDefault();
        if (addQuick(quickText, "Task", quickTarget)) setQuickText("");
      }}>
        <I name="Plus" />
        <input aria-label="Quick add task" aria-describedby="demo-quick-target" value={quickText} onChange={(event) => setQuickText(event.target.value)} placeholder="Add a task… try “PAY-382 tomorrow 2pm”" />
        <button className="quiet-button" aria-label="Add task to plan" disabled={!quickText.trim()}><kbd>↵</kbd></button>
      </form>
      <div id="demo-quick-target" className={`plan-quick-target ${quickError ? "has-error" : ""}`} aria-live="polite">{quickError || (quickPreview ? <><b>{quickPreview.title}</b> · {quickPreview.date || "Backlog"}{quickPreview.time && ` at ${quickPreview.time}`}</> : `Adding to ${quickTarget === "Backlog" ? "Backlog" : quickTarget === "Sat" ? "tomorrow, Oct 4" : "today, Oct 3"} · Demo dates`)}</div>
    </>;
    const backlogTasks = issues.filter((task) => task.day === "Backlog" && (showCompleted || task.status !== "Done") && `${task.id} ${task.title}`.toLowerCase().includes(workBacklogQuery.trim().toLowerCase()));
    const timeOrder = (time) => {
      if (!time) return Infinity;
      const match = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (!match) return Infinity;
      let hour = Number(match[1]);
      if (match[3]) hour = hour % 12 + (/pm/i.test(match[3]) ? 12 : 0);
      return hour * 60 + Number(match[2] || 0);
    };
    return (
      <div className="page">
        {sectionHeader(
          view === "Inbox"
            ? "Your attention, organized"
            : view === "My Activity"
              ? "My activity"
              : "My work",
          "A clear plan. One connected place.",
          <Btn icon="Plus" primary onClick={() => openPalette("create")}>
            New task
          </Btn>,
        )}
        <div className="tabs">
          {[
            "Today",
            "This Week",
            "Backlog",
            "Calendar",
            "Inbox",
            "My Activity",
          ].map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => navigate("My Work", v)}
            >
              {v}
              {v === "Inbox" && <span className="count">3</span>}
            </button>
          ))}
        </div>
        {view === "Today" ? (
          <>
            <div className="view-toolbar">
              <div className="segmented">
                {["Fri", "Sat"].map((d, i) => (
                  <button
                    key={d}
                    className={workDay === d ? "selected" : ""}
                    onClick={() => setWorkDay(d)}
                  >
                    {i ? "Tomorrow, Oct 4" : "Today, Oct 3"}
                  </button>
                ))}
              </div>
              <button
                className="quiet-button"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <I name={showCompleted ? "EyeOff" : "Eye"} size={14} />
                {showCompleted ? "Hide" : "Show"} completed
              </button>
            </div>
            {quickEntry()}
            <div className="today-layout">
              <section>
                <div className="section-title">
                  <h2>
                    {workDay === "Fri" ? "Friday" : "Saturday"}{" "}
                    <span className="subtle">
                      October {workDay === "Fri" ? "3" : "4"}
                    </span>
                  </h2>
                  <span className="muted">
                    {todayTasks.filter((x) => x.status === "Done").length}/
                    {todayTasks.length} done
                  </span>
                </div>
                {[
                  ...(workDay === "Fri"
                    ? events.slice(0, 3).map((e) => ({
                        sort: timeOrder(e.time),
                        event: e,
                      }))
                    : []),
                  ...todayTasks
                    .filter((x) => showCompleted || x.status !== "Done")
                    .map((t) => ({
                      sort: timeOrder(t.time),
                      task: t,
                    })),
                ]
                  .sort((a, b) => a.sort - b.sort)
                  .map((x) => (x.event ? eventRow(x.event) : taskRow(x.task)))}
                {!todayTasks.length && (
                  <Empty
                    title="A little breathing room"
                    text="Drag a task here from your weekly plan, or add one above."
                  />
                )}
              </section>
              <aside className="work-note">
                <I name="Sun" size={20} />
                <h3>Make space to focus</h3>
                <p>
                  Your plan brings meetings and tasks together. Drag tasks to
                  prioritize, or use the calendar icon to move one to tomorrow.
                </p>
                <hr />
                <h4>Next on your list</h4>
                {issues
                  .filter(
                    (x) => x.day === "Backlog" && x.assignee === "Alex Kim",
                  )
                  .map((t) => (
                    <button key={t.id} onClick={() => schedule(t.id, workDay)}>
                      <I name="Plus" size={13} />
                      <span>{t.title}</span>
                    </button>
                  ))}
              </aside>
            </div>
          </>
        ) : view === "This Week" ? (
          Weekly()
        ) : view === "Calendar" ? (
          Calendar()
        ) : view === "Backlog" ? (
          <>
            {quickEntry()}
            <div className="view-toolbar">
              <span>
                {backlogTasks.filter((task) => task.status !== "Done").length} unscheduled
                tasks
              </span>
              <button className="quiet-button" onClick={() => setShowCompleted(!showCompleted)}><I name={showCompleted ? "EyeOff" : "Eye"} size={14} />{showCompleted ? "Hide" : "Show"} completed</button>
            </div>
            <div className="backlog-toolbar demo-backlog-toolbar"><input type="search" aria-label="Search backlog" value={workBacklogQuery} onChange={(event) => setWorkBacklogQuery(event.target.value)} placeholder="Find a task or issue key…" /><span className="muted">Use the calendar action to schedule for Oct 4</span></div>
            {backlogTasks.map((task) => taskRow(task))}
            {!backlogTasks.length && <div className="plan-empty"><h3>{workBacklogQuery.trim() ? "No matching unscheduled work" : "Your backlog is clear"}</h3><p>{workBacklogQuery.trim() ? "Try another title or issue key." : "Add an idea above, then schedule it when you have room."}</p>{workBacklogQuery.trim() && <button className="btn" onClick={() => setWorkBacklogQuery("")}>Clear backlog search</button>}</div>}
          </>
        ) : view === "Inbox" ? (
          <div className="inbox-layout">
            <Brief full />
            <details>
              <summary>Low priority · 11 updates</summary>
              {[
                "Pipeline #482 passed",
                "Mina updated Payment Retry Policy",
                "Sprint 24 scope updated",
                "4 issues completed by your team",
              ].map((x) => (
                <div className="activity-row" key={x}>
                  <I name="Bell" size={14} />
                  {x}
                  <span className="muted">Today</span>
                </div>
              ))}
            </details>
          </div>
        ) : (
          Activity()
        )}
      </div>
    );
  }
  function Weekly() {
    return (
      <>
        <div className="view-toolbar">
          <div className="inline">
            <I name="CalendarDays" />
            <strong>September 29 – October 3</strong>
            <span className="pill">This week</span>
          </div>
          <span className="muted">
            Drag tasks between days · changes sync across views
          </span>
        </div>
        <div className="week-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, n) => (
            <div
              key={day}
              className={cx("week-day", day === "Fri" && "current")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                schedule(dragRef.current, day);
                setDragId(null);
              }}
            >
              <div className="day-header">
                {day}
                <strong>{[29, 30, 1, 2, 3][n]}</strong>
              </div>
              {events
                .filter((e) => e.day === day)
                .map((e) => (
                  <button
                    className="week-event"
                    key={e.id}
                    onClick={() => preview("event", e.id)}
                  >
                    <span>
                      <I name="Video" size={12} />
                      {e.time}
                    </span>
                    {e.title}
                  </button>
                ))}
              {issues
                .filter(
                  (x) =>
                    x.due ===
                    [
                      "2025-09-29",
                      "2025-09-30",
                      "2025-10-01",
                      "2025-10-02",
                      "2025-10-03",
                    ][n],
                )
                .map((t) => (
                  <div
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    className="week-task"
                    key={t.id}
                  >
                    <button onClick={() => preview("issue", t.id)}>
                      <span className="object-key">{t.id}</span>
                      <strong>{t.title}</strong>
                    </button>
                    <div>
                      <Status status={t.status} />
                      <Avatar name={t.assignee} small />
                    </div>
                    <button
                      className="schedule-mini"
                      aria-label={`Schedule ${t.id}`}
                      onClick={() => {
                        schedule(t.id, "Sat");
                      }}
                    >
                      Tomorrow <I name="ArrowRight" size={12} />
                    </button>
                  </div>
                ))}
              <button className="week-add" onClick={() => openPalette("create")}>
                <I name="Plus" size={14} /> Add task
              </button>
            </div>
          ))}
        </div>
        <div className="backlog-tray">
          <h3>
            <I name="Inbox" size={16} /> Backlog{" "}
            <span className="count">
              {issues.filter((x) => x.day === "Backlog").length}
            </span>
            <small>Drag a task into your week</small>
          </h3>
          <div>
            {issues
              .filter((x) => x.day === "Backlog")
              .map((t) => (
                <button
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  key={t.id}
                  onClick={() => preview("issue", t.id)}
                >
                  <I name="GripVertical" size={13} />
                  <span className="object-key">{t.id}</span>
                  {t.title}
                </button>
              ))}
          </div>
        </div>
      </>
    );
  }
  function Calendar() {
    return (
      <>
        <div className="view-toolbar">
          <div className="inline">
            <strong>October 2025</strong>
            <span className="pill">Week 40</span>
          </div>
          <div className="segmented">
            {["Day", "Week", "Month"].map((m) => (
              <button
                key={m}
                onClick={() => setCalendarMode(m)}
                className={m === calendarMode ? "selected" : ""}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="event-dot" />
            Dooray meeting
          </span>
          <span>
            <i className="task-dot" />
            Task deadline
          </span>
          <span>
            <i className="sprint-dot" />
            Sprint 24 · Sep 29 – Oct 10
          </span>
        </div>
        {calendarMode === "Month" ? (
          <div className="month-grid">
            {Array.from({ length: 35 }, (_, i) => {
              const n = i - 1;
              const date = n > 0 && n <= 31 ? n : null;
              return (
                <div
                  key={i}
                  className={cx(date === 3 && "current")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (date && dragRef.current) {
                      updateIssue(dragRef.current, {
                        due: `2025-10-${String(date).padStart(2, "0")}`,
                        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                          new Date(2025, 9, date).getDay()
                        ],
                      });
                      notify("Task rescheduled");
                    }
                  }}
                >
                  <span>{date}</span>
                  {date &&
                    issues
                      .filter(
                        (x) =>
                          x.due === `2025-10-${String(date).padStart(2, "0")}`,
                      )
                      .map((t) => (
                        <button
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onClick={() => preview("issue", t.id)}
                        >
                          {t.id} {t.title}
                        </button>
                      ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="calendar-grid"
            style={{ "--days": calendarMode === "Day" ? 1 : 5 }}
          >
            <div className="calendar-times">
              <div>GMT+9</div>
              {[
                "09:00",
                "10:00",
                "11:00",
                "12:00",
                "13:00",
                "14:00",
                "15:00",
                "16:00",
              ].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            {(calendarMode === "Day"
              ? ["Fri"]
              : ["Mon", "Tue", "Wed", "Thu", "Fri"]
            ).map((d, i) => (
              <div
                className="calendar-day"
                key={d}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  schedule(dragRef.current, d);
                  setDragId(null);
                }}
              >
                <div
                  className={cx("calendar-day-title", d === "Fri" && "current")}
                >
                  {d} <b>{d === "Fri" ? 3 : [29, 30, 1, 2][i]}</b>
                </div>
                <div className="calendar-all-day">
                  {issues
                    .filter(
                      (x) =>
                        x.due ===
                        {
                          Mon: "2025-09-29",
                          Tue: "2025-09-30",
                          Wed: "2025-10-01",
                          Thu: "2025-10-02",
                          Fri: "2025-10-03",
                        }[d],
                    )
                    .slice(0, 3)
                    .map((t) => (
                      <button
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        key={t.id}
                        onClick={() => preview("issue", t.id)}
                      >
                        <I name="Square" size={10} />
                        {t.id} {t.title}
                      </button>
                    ))}
                </div>
                <div className="calendar-hours">
                  {events
                    .filter((e) => e.day === d)
                    .map((e) => (
                      <button
                        key={e.id}
                        className="calendar-event"
                        style={{
                          top:
                            (Number(e.time.split(":")[0]) - 9) * 64 +
                            (Number(e.time.split(":")[1]) / 60) * 64,
                        }}
                        onClick={() => preview("event", e.id)}
                      >
                        <b>{e.title}</b>
                        <span>
                          {e.time} – {e.end}
                        </span>
                        <small>{e.room}</small>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
  function Projects() {
    const view = route.view;
    const filtered = issues.filter(
      (x) =>
        (project === "All projects" || x.project === project) &&
        (x.title + " " + x.id).toLowerCase().includes(filter.toLowerCase()),
    );
    return (
      <div className="page">
        {sectionHeader(
          view === "Issues"
            ? "Project issues"
            : view === "Board"
              ? "Sprint board"
              : view === "Roadmap"
                ? "Roadmap"
                : view === "Sprint"
                  ? "Sprint 24"
                  : "Projects",
          "Shared priorities, connected to the work.",
          <Btn primary icon="Plus" onClick={() => openPalette("create-issue")}>
            New issue
          </Btn>,
        )}
        <div className="tabs">
          {["Overview", "Issues", "Board", "Sprint", "Roadmap"].map((v) => (
            <button
              key={v}
              onClick={() => navigate("Projects", v)}
              className={v === view ? "active" : ""}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="view-toolbar">
          <div className="inline">
            <select
              aria-label="Filter project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              {["All projects", "PAY", "API", "OPS"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <span className="muted">{filtered.length} issues</span>
          </div>
          <label className="search-field">
            <I name="Search" size={14} />
            <input
              placeholder="Filter issues…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
        </div>
        {view === "Issues" ? (
          <div className="table-wrap">
            <table className="issue-table">
              <thead>
                <tr>
                  {[
                    "Key",
                    "Title",
                    "Status",
                    "Priority",
                    "Assignee",
                    "Sprint",
                    "Due",
                    "MR",
                  ].map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="object-key"
                        onClick={() => preview("issue", t.id)}
                      >
                        {t.id}
                      </button>
                    </td>
                    <td>
                      <button
                        className="table-title"
                        onClick={() => preview("issue", t.id)}
                      >
                        {t.title}
                      </button>
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        aria-label={`Status ${t.id}`}
                        value={t.status}
                        onChange={(e) =>
                          updateIssue(t.id, { status: e.target.value })
                        }
                      >
                        {["Todo", "In Progress", "In Review", "Done"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </td>
                    <td>
                      <Priority value={t.priority} />
                    </td>
                    <td>
                      <Avatar name={t.assignee} small />
                    </td>
                    <td className="muted">{t.sprint}</td>
                    <td className="muted">
                      {t.due ? t.due.slice(5).replace("-", "/") : "—"}
                    </td>
                    <td>
                      {t.mr ? (
                        <button
                          className="linked-text"
                          onClick={() => preview("mr", t.mr)}
                        >
                          <I name="GitPullRequest" size={12} />!{t.mr}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <Empty
                title="No matching issues"
                text="Try another project or search term."
              />
            )}
          </div>
        ) : view === "Board" || view === "Sprint" ? (
          <>
            <div className="board-meta">
              <span>
                <I name="Layers" size={15} /> Sprint 24 · Payment reliability
              </span>
              <span>Sep 29 – Oct 10</span>
            </div>
            <div className="board">
              {["Todo", "In Progress", "In Review", "Done"].map((status) => (
                <section
                  className="board-column"
                  key={status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragRef.current)
                      updateIssue(dragRef.current, { status });
                    setDragId(null);
                  }}
                >
                  <h3>
                    <Status status={status} />
                    <span className="count">
                      {filtered.filter((x) => x.status === status).length}
                    </span>
                  </h3>
                  {filtered
                    .filter((x) => x.status === status)
                    .map((t) => (
                      <div
                        className="board-card"
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                      >
                        <button onClick={() => preview("issue", t.id)}>
                          <span className="object-key">{t.id}</span>
                          <strong>{t.title}</strong>
                        </button>
                        <div>
                          <Priority value={t.priority} />
                          <Avatar name={t.assignee} small />
                        </div>
                        <select
                          aria-label={`Board status ${t.id}`}
                          value={t.status}
                          onChange={(e) =>
                            updateIssue(t.id, { status: e.target.value })
                          }
                        >
                          {["Todo", "In Progress", "In Review", "Done"].map(
                            (s) => (
                              <option key={s}>{s}</option>
                            ),
                          )}
                        </select>
                      </div>
                    ))}
                </section>
              ))}
            </div>
          </>
        ) : view === "Roadmap" ? (
          <div className="roadmap">
            <div className="roadmap-head">
              <span>Initiative</span>
              <span>September</span>
              <span>October</span>
              <span>November</span>
            </div>
            {[
              ["Payment reliability", "PAY", 1, 2],
              ["Order API v2", "API", 2, 2],
              ["Observability baseline", "OPS", 1, 1],
            ].map(([t, p, start, span]) => (
              <div className="roadmap-row" key={p}>
                <button
                  onClick={() => {
                    setProject(p);
                    navigate("Projects", "Issues");
                  }}
                >
                  {t}
                  <small>{p}</small>
                </button>
                <button
                  className="roadmap-bar"
                  style={{
                    gridColumn: `${start + 1} / span ${Math.min(span, 4 - start)}`,
                  }}
                  onClick={() => {
                    setProject(p);
                    navigate("Projects", "Board");
                  }}
                >
                  {t}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="project-list">
            {[
              [
                "PAY",
                "Payments",
                "Reliable money movement, end to end.",
                "teal",
              ],
              [
                "API",
                "Platform API",
                "Consistent contracts for every consumer.",
                "blue",
              ],
              [
                "OPS",
                "Infrastructure",
                "Keep production predictable.",
                "purple",
              ],
            ].map(([id, title, desc, color]) => (
              <button
                key={id}
                onClick={() => {
                  setProject(id);
                  navigate("Projects", "Issues");
                }}
              >
                <span className={"project-symbol " + color}>
                  <I
                    name={
                      id === "PAY"
                        ? "Wallet"
                        : id === "API"
                          ? "Braces"
                          : "Server"
                    }
                    size={22}
                  />
                </span>
                <div>
                  <h3>
                    {title} <span className="object-key">{id}</span>
                  </h3>
                  <p>{desc}</p>
                  <small>
                    {
                      issues.filter(
                        (x) => x.project === id && x.status !== "Done",
                      ).length
                    }{" "}
                    open issues · Sprint 24
                  </small>
                </div>
                <I name="ArrowUpRight" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  function Code() {
    const view = route.view;
    const list = mrs.filter(
      (m) =>
        (view !== "My Reviews" ||
          m.status === "Review requested" ||
          m.status === "Approved") &&
        (m.title + " " + m.id + " " + m.repo)
          .toLowerCase()
          .includes(filter.toLowerCase()),
    );
    if (view === "Review") return MRReview();
    return (
      <div className="page">
        {sectionHeader(
          view,
          view === "My Reviews"
            ? "A focused queue for thoughtful reviews."
            : "From the first commit to production.",
          <Btn
            icon="GitPullRequest"
            onClick={() => navigate("Code", "My Reviews")}
          >
            My reviews <span className="count">{needsReview.length}</span>
          </Btn>,
        )}
        <div className="tabs">
          {[
            "Merge Requests",
            "My Reviews",
            "Repositories",
            "Pipelines",
            "Architecture",
          ].map((v) => (
            <button
              key={v}
              className={v === view ? "active" : ""}
              onClick={() => navigate("Code", v)}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "Merge Requests" || view === "My Reviews" ? (
          <>
            <div className="view-toolbar">
              <div className="inline">
                <span className="pill">
                  <span className="live-dot" /> {list.length} merge requests
                </span>
                {view === "My Reviews" && (
                  <span className="muted">Oldest requests first</span>
                )}
              </div>
              <label className="search-field">
                <I name="Search" size={14} />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter merge requests…"
                />
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Merge request",
                      "Author",
                      "Review status",
                      "CI",
                      "Comments",
                      "Updated",
                      "",
                    ].map((s, i) => (
                      <th key={i}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <button
                          className="mr-title"
                          onClick={() => preview("mr", m.id)}
                        >
                          <I name="GitPullRequest" size={17} />
                          <span>
                            <b>{m.title}</b>
                            <small>
                              {m.repo} <span>!{m.id}</span>
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <Avatar name={m.author} small />
                      </td>
                      <td>
                        <Status status={m.status} />
                      </td>
                      <td>
                        <span
                          className={
                            m.ci === "Passed" ? "success" : "amber-text"
                          }
                        >
                          <I
                            name={m.ci === "Passed" ? "CircleCheck" : "Loader"}
                            size={14}
                          />{" "}
                          {m.ci}
                        </span>
                      </td>
                      <td className="muted">
                        <I name="MessageSquare" size={13} />{" "}
                        {m.comments + (comments["mr-" + m.id]?.length || 0)}
                      </td>
                      <td className="muted">{m.updated}</td>
                      <td>
                        <Btn onClick={() => review(m.id)}>
                          Review <I name="ArrowRight" size={13} />
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!list.length && (
                <Empty
                  title="Your queue is clear"
                  text="There are no merge requests matching this filter."
                />
              )}
            </div>
            <div className="hint-line">
              <I name="PanelRight" size={14} /> Click a title to preview. Open
              Review when you’re ready to dive into the changes.
            </div>
          </>
        ) : view === "Repositories" ? (
          <div className="repository-list">
            <label className="search-field">
              <I name="Search" size={14} />
              <input
                aria-label="Filter repositories"
                placeholder="Filter repositories…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            {["payment-api", "order-api", "auth-service"].map((r, i) =>
              !r.toLowerCase().includes(filter.toLowerCase()) ? null : (
                <button
                  key={r}
                  onClick={() => {
                    navigate("Code", "Merge Requests", { filter: r });
                  }}
                >
                  <I name="FolderGit2" size={24} />
                  <div>
                    <h3>{r}</h3>
                    <p>
                      {
                        [
                          "Payment processing, captures, retries, and webhooks",
                          "Order lifecycle and fulfillment coordination",
                          "Authentication, sessions, and service identities",
                        ][i]
                      }
                    </p>
                    <small>
                      TypeScript · main · Updated {i ? i + "h" : "42m"} ago
                    </small>
                  </div>
                  <span className="pill">Private</span>
                  <I name="ChevronRight" />
                </button>
              ),
            )}
          </div>
        ) : view === "Pipelines" ? (
          <div className="pipeline-list">
            {[482, 481, 480, 479].map((id, i) => (
              <button key={id} onClick={() => preview("pipeline", String(id))}>
                <I name="CircleCheck" className="success" />
                <b>#{id}</b>
                <span>{i % 2 ? "order-api" : "payment-api"}</span>
                <code>
                  {
                    ["feat/payment-retry", "fix/order-status", "main", "main"][
                      i
                    ]
                  }
                </code>
                <span className="success">Passed</span>
                <span className="muted">3m 24s</span>
                <I name="ChevronRight" />
              </button>
            ))}
          </div>
        ) : (
          <div className="architecture-page">
            <h2>Payment request lifecycle</h2>
            <p className="muted">
              Select a component to inspect its implementation and linked work.
            </p>
            <div className="architecture-flow">
              {["Controller", "PaymentService", "RetryQueue", "Worker"].map(
                (n, i) => (
                  <React.Fragment key={n}>
                    <button
                      onClick={() => {
                        review("381");
                        setSelectedFile(i);
                      }}
                    >
                      <I
                        name={["Braces", "Layers", "ListOrdered", "Cog"][i]}
                        size={24}
                      />
                      <strong>{n}</strong>
                      <small>
                        {
                          [
                            "HTTP boundary",
                            "Idempotency & capture",
                            "Exponential backoff",
                            "Background execution",
                          ][i]
                        }
                      </small>
                    </button>
                    {i < 3 && <I name="ArrowRight" />}
                  </React.Fragment>
                ),
              )}
            </div>
            <div className="context-strip">
              <span>Connected work</span>
              <button onClick={() => preview("issue", "PAY-382")}>
                PAY-382
              </button>
              <button onClick={() => preview("doc", "retry-policy")}>
                Payment Retry Policy
              </button>
              <button onClick={() => preview("mr", "381")}>MR !381</button>
            </div>
          </div>
        )}
      </div>
    );
  }
  const files = [
    "PaymentController.ts",
    "PaymentService.ts",
    "RetryQueue.ts",
    "PaymentWorker.ts",
  ];
  const diffLines = [
    [" ", 'import { PaymentGateway } from "./gateway";'],
    ["+", 'import { RetryQueue } from "./RetryQueue";'],
    [" ", ""],
    [" ", "export class PaymentService {"],
    [" ", "  constructor("],
    [" ", "    private readonly gateway: PaymentGateway,"],
    ["+", "    private readonly retryQueue: RetryQueue,"],
    [" ", "  ) {}"],
    [" ", ""],
    [" ", "  async capture(request: CaptureRequest) {"],
    ["-", "    return this.gateway.capture(request);"],
    ["+", "    const key = request.idempotencyKey;"],
    ["+", "    const existing = await this.findCapture(key);"],
    ["+", "    if (existing) return existing;"],
    ["+", ""],
    ["+", "    try {"],
    ["+", "      return await this.gateway.capture(request);"],
    ["+", "    } catch (error) {"],
    ["+", "      if (!isRetryable(error)) throw error;"],
    ["+", ""],
    ["+", "      await this.retryQueue.enqueue({"],
    ["+", "        ...request,"],
    ["+", "        attempt: 1,"],
    ["+", "        nextAttemptAt: this.backoff(1),"],
    ["+", "      });"],
    ["+", '      return { status: "pending", key };'],
    ["+", "    }"],
    [" ", "  }"],
    [" ", "}"],
  ];
  function MRReview() {
    const reviewSnapshot = demoSnapshot(currentMR);
    const savedDiscussions = (comments["mr-" + currentMR.id] || [])
      .filter(comment => typeof comment.review?.body === "string" &&
        reviewSnapshot.files.some(file => file.path === comment.review.path))
      .map(comment => ({
        id: "demo-" + comment.id,
        notes: [{ id: comment.id, body: comment.review.body,
          author: { name: comment.author }, created_at: comment.createdAt,
          position: comment.review.position || { new_path: comment.review.path } }],
      }));
    if (visualReview)
      return (
        <ReviewWorkbench
          key={"demo-" + currentMR.id}
          snapshot={{ ...reviewSnapshot, discussions: [...reviewSnapshot.discussions, ...savedDiscussions] }}
          initialReviewState={demoReviewSessions.current.get(`${currentMR.repo}:${currentMR.id}`)}
          onReviewState={(state) => demoReviewSessions.current.set(`${currentMR.repo}:${currentMR.id}`, state)}
          onBack={() => setVisualReview(false)}
          onRefresh={() => notify("Sample review refreshed")}
          onDemoComment={(text, details) => addComment("mr-" + currentMR.id, text, details)}
          onDemoApprove={() =>
            setMRs((xs) =>
              xs.map((m) =>
                m.id === currentMR.id ? { ...m, status: "Approved" } : m,
              ),
            )
          }
        />
      );
    const isOrder = currentMR.id === "391";
    const names = isOrder
      ? [
          "OrderController.ts",
          "OrderService.ts",
          "StatusMapper.ts",
          "OrderService.test.ts",
        ]
      : files;
    const lines =
      fileDiffs[names[selectedFile]] || (isOrder ? orderDiff : diffLines);
    const viewedKey = `${currentMR.id}:${names[selectedFile]}`;
    const isViewed = !!viewedFiles[viewedKey];
    const drafts = reviewDrafts[currentMR.id] || [];
    const viewedCount = names.filter(
      (f) => viewedFiles[`${currentMR.id}:${f}`],
    ).length;
    function stageReview() {
      if (!reviewText.trim()) return;
      const draft = {
        id: crypto.randomUUID(),
        text: (line ? `${names[selectedFile]}:${line} — ` : "") + reviewText,
      };
      setReviewDrafts((d) => ({
        ...d,
        [currentMR.id]: [...(d[currentMR.id] || []), draft],
      }));
      setReviewText("");
      notify("Draft saved privately. Submit your review when ready.");
    }
    function submitReview() {
      if (drafts.length)
        setComments((c) => ({
          ...c,
          ["mr-" + currentMR.id]: [
            ...(c["mr-" + currentMR.id] || []),
            ...drafts.map((d) => ({
              text: d.text,
              author: "Alex Kim",
              time: "Just now",
            })),
          ],
        }));
      if (reviewOutcome !== "Comment")
        setMRs((xs) =>
          xs.map((m) =>
            m.id === currentMR.id
              ? {
                  ...m,
                  status:
                    reviewOutcome === "Approve"
                      ? "Approved"
                      : "Changes requested",
                }
              : m,
          ),
        );
      setReviewDrafts((d) => ({ ...d, [currentMR.id]: [] }));
      notify("Review submitted in this prototype");
    }
    return (
      <div className="review-page">
        <div className="review-heading">
          <Btn icon="Network" onClick={() => setVisualReview(true)}>
            Visual review
          </Btn>
          <button
            className="quiet-button"
            onClick={() => navigate("Code", "My Reviews")}
          >
            <I name="ArrowLeft" size={14} /> My reviews
          </button>
          <span className="object-key">
            {currentMR.repo} / !{currentMR.id}
          </span>
          <button
            className="quiet-button push-right"
            onClick={() => setAssistant(true)}
          >
            <I name="Sparkles" size={14} /> Ask about this MR
          </button>
        </div>
        <div className="mr-heading">
          <h1>{currentMR.title}</h1>
          <div>
            <Status status={currentMR.status} />
            <span className="muted">{currentMR.author} wants to merge</span>
            <code>{isOrder ? "fix/order-status" : "feat/payment-retry"}</code>
            <I name="ArrowRight" size={13} />
            <code>main</code>
          </div>
        </div>
        <div className="tabs review-tabs">
          {["Overview", "Changes", "Commits", "Pipeline", "Discussion"].map(
            (t) => (
              <button
                key={t}
                className={reviewTab === t ? "active" : ""}
                onClick={() => setReviewTab(t)}
                aria-label={t}
              >
                {t}
                {t === "Changes" && (
                  <span className="count">{currentMR.files}</span>
                )}
              </button>
            ),
          )}
          <button
            className="review-draft-button"
            onClick={() => setReviewTab("Discussion")}
          >
            Review draft ({drafts.length})
          </button>
          <span className="diff-total">
            <b>+{currentMR.added}</b>
            <span>−{currentMR.removed}</span>
          </span>
        </div>
        {reviewTab === "Changes" ? (
          <div className="review-workspace">
            <aside className="file-nav">
              <div className="tiny-heading">
                Changed files <span>{names.length}</span>
              </div>
              {names.map((f, i) => (
                <button
                  key={f}
                  onClick={() => {
                    setSelectedFile(i);
                    setLine(null);
                  }}
                  className={selectedFile === i ? "active" : ""}
                >
                  <I name="FileCode2" size={14} />
                  <span>{f}</span>
                  <b
                    className={
                      viewedFiles[`${currentMR.id}:${f}`] ? "success" : ""
                    }
                  >
                    {viewedFiles[`${currentMR.id}:${f}`] ? "✓" : "M"}
                  </b>
                </button>
              ))}
              <div className="file-review-progress">
                <span data-testid="review-progress">
                  {viewedCount} / {names.length} files viewed
                </span>
                <progress value={viewedCount} max={names.length} />
                <button
                  className="quiet-button"
                  disabled={viewedCount === names.length}
                  onClick={() => {
                    for (let step = 1; step <= names.length; step++) {
                      const i = (selectedFile + step) % names.length;
                      if (!viewedFiles[`${currentMR.id}:${names[i]}`]) {
                        setSelectedFile(i);
                        setLine(null);
                        break;
                      }
                    }
                  }}
                >
                  Next unviewed file <I name="ArrowRight" size={12} />
                </button>
              </div>
              <div className="file-nav-note">
                <I name="MousePointer2" size={15} />
                <p>Click a diff line to leave a contextual comment.</p>
              </div>
            </aside>
            <section className="diff-main">
              <div className="change-map">
                <span>Change structure</span>
                <div>
                  {names.map((f, i) => (
                    <React.Fragment key={f}>
                      <button
                        className={selectedFile === i ? "selected" : ""}
                        onClick={() => {
                          setSelectedFile(i);
                          setLine(null);
                        }}
                      >
                        {f.replace(".ts", "")}
                      </button>
                      {i < 3 && <I name="ChevronRight" size={12} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="diff-file-title">
                <I name="FileCode2" size={14} />
                <strong>src/{names[selectedFile]}</strong>
                <span className="success">+{selectedFile === 1 ? 42 : 18}</span>
                <span className="danger-text">−8</span>
                <label className="viewed-toggle">
                  <input
                    type="checkbox"
                    aria-label={`Viewed ${names[selectedFile]}`}
                    checked={isViewed}
                    onChange={(e) =>
                      setViewedFiles((v) => ({
                        ...v,
                        [viewedKey]: e.target.checked,
                      }))
                    }
                  />{" "}
                  Viewed
                </label>
              </div>
              {isViewed ? (
                <div className="viewed-placeholder">
                  <I name="CircleCheck" />
                  <strong>This file is marked as viewed.</strong>
                  <p>Your review progress is saved for this merge request.</p>
                  <Btn
                    onClick={() =>
                      setViewedFiles((v) => ({ ...v, [viewedKey]: false }))
                    }
                  >
                    Reopen diff
                  </Btn>
                </div>
              ) : (
                <>
                  <div className="diff-hunk">
                    @@ -12,16 +12,34 @@ export class{" "}
                    {names[selectedFile].replace(".ts", "")}
                  </div>
                  <div className="diff-lines">
                    {lines.map(([kind, text], idx) => (
                      <button
                        className={cx(
                          "diff-line",
                          kind === "+" && "added",
                          kind === "-" && "removed",
                          line === idx + 12 && "selected",
                        )}
                        key={idx}
                        onClick={() => setLine(idx + 12)}
                        aria-label={`Comment on line ${idx + 12}`}
                      >
                        <span className="line-number">
                          {kind === "+" ? "" : idx + 12}
                        </span>
                        <span className="line-number">
                          {kind === "-" ? "" : idx + 12}
                        </span>
                        <span className="diff-sign">{kind}</span>
                        <code>{text}</code>
                        <span className="line-add">+</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
            <aside className="review-context">
              <div className="tiny-heading">
                Review context <I name="PanelRight" size={14} />
              </div>
              <label className="tiny-label">Linked issue</label>
              <button
                className="context-object"
                onClick={() => preview("issue", currentMR.issue)}
              >
                <I name="CircleDashed" className="amber-text" />
                <div>
                  <span className="object-key">{currentMR.issue}</span>
                  <strong>
                    {issues.find((x) => x.id === currentMR.issue)?.title}
                  </strong>
                </div>
                <I name="ChevronRight" size={13} />
              </button>
              <label className="tiny-label">Pipeline</label>
              <button
                className="pipeline-context"
                onClick={() => preview("pipeline", "482")}
              >
                <I name="CircleCheck" className="success" /> All checks passed{" "}
                <span>#482</span>
              </button>
              <label className="tiny-label">Related document</label>
              <button
                className="doc-context"
                onClick={() =>
                  preview("doc", isOrder ? "order-contract" : "retry-policy")
                }
              >
                <I name="FileText" size={15} />
                {isOrder ? "Order API v2 contract" : "Payment Retry Policy"}
              </button>
              <div className="review-comment">
                <h3>{line ? `Comment on line ${line}` : "Leave a review"}</h3>
                <textarea
                  aria-label="Review comment"
                  placeholder={
                    line
                      ? "What should we consider here?"
                      : "Share your feedback…"
                  }
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
                <Btn
                  disabled={!reviewText.trim()}
                  onClick={() => {
                    addComment(
                      "mr-" + currentMR.id,
                      (line ? `${names[selectedFile]}:${line} — ` : "") +
                        reviewText,
                    );
                    setReviewText("");
                    setLine(null);
                  }}
                >
                  Add comment
                </Btn>
                <Btn
                  primary
                  disabled={!reviewText.trim()}
                  onClick={stageReview}
                >
                  Add to review
                </Btn>
                <p className="review-footnote">
                  Review drafts stay private until you submit.
                </p>
              </div>
              <div className="review-checklist">
                <span>
                  <I name="CircleCheck" /> CI pipeline passed
                </span>
                <span>
                  <I name="CircleCheck" /> No merge conflicts
                </span>
                <span>
                  <I name="CircleDot" />{" "}
                  {currentMR.status === "Approved"
                    ? "You approved this MR"
                    : "Your review is requested"}
                </span>
              </div>
              <Btn
                primary
                icon="Check"
                disabled={
                  currentMR.status === "Approved" ||
                  currentMR.status === "Merged"
                }
                onClick={() => {
                  if (drafts.length) {
                    setReviewOutcome("Approve");
                    setReviewTab("Discussion");
                    return;
                  }
                  setMRs((xs) =>
                    xs.map((m) =>
                      m.id === currentMR.id ? { ...m, status: "Approved" } : m,
                    ),
                  );
                  notify("Review approved. The merge request remains open.");
                }}
              >
                {currentMR.status === "Approved"
                  ? "Approved"
                  : "Approve changes"}
              </Btn>
              <p className="review-footnote">
                Approval is separate from merging.
              </p>
            </aside>
          </div>
        ) : reviewTab === "Pipeline" ? (
          <div className="review-tab-content">{PipelineContent("482")}</div>
        ) : reviewTab === "Discussion" ? (
          <div className="review-tab-content">
            <h2>Discussion</h2>
            {!!drafts.length && (
              <section className="pending-review">
                <div className="inline">
                  <h3>Your pending review</h3>
                  <span className="pill">Private draft · {drafts.length}</span>
                </div>
                {drafts.map((d) => (
                  <div className="draft-comment" key={d.id}>
                    <p>{d.text}</p>
                    <button
                      className="quiet-button"
                      aria-label={`Remove draft ${d.text}`}
                      onClick={() =>
                        setReviewDrafts((all) => ({
                          ...all,
                          [currentMR.id]: drafts.filter((x) => x.id !== d.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="review-submit">
                  <label>
                    Outcome{" "}
                    <select
                      aria-label="Review outcome"
                      value={reviewOutcome}
                      onChange={(e) => setReviewOutcome(e.target.value)}
                    >
                      <option>Comment</option>
                      <option>Approve</option>
                      <option>Request changes</option>
                    </select>
                  </label>
                  <Btn primary onClick={submitReview}>
                    Submit review
                  </Btn>
                </div>
              </section>
            )}
            <div className="comment">
              <Avatar name="Daniel Lee" small />
              <div>
                <b>
                  Daniel Lee <small>Yesterday</small>
                </b>
                <p>
                  Ready for review. I added coverage for the pending → confirmed
                  transition and preserved the legacy response fields.
                </p>
              </div>
            </div>
            {(comments["mr-" + currentMR.id] || []).map((c, i) => (
              <div className="comment" key={i}>
                <Avatar small />
                <div>
                  <b>
                    {c.author} <small>{c.time}</small>
                  </b>
                  <p>{c.text}</p>
                </div>
              </div>
            ))}
            <textarea
              aria-label="Discussion comment"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Add to the discussion…"
            />
            <Btn
              disabled={!reviewText.trim()}
              onClick={() => {
                addComment("mr-" + currentMR.id, reviewText);
                setReviewText("");
              }}
            >
              Comment
            </Btn>
          </div>
        ) : reviewTab === "Commits" ? (
          <div className="review-tab-content">
            {[
              "Add initial implementation",
              "Cover edge cases with integration tests",
              "Address review feedback",
            ].map((t, i) => (
              <div className="activity-row" key={t}>
                <I name="GitCommitHorizontal" />
                <strong>{t}</strong>
                <code>{["a38f921", "b20cd41", "c712da0"][i]}</code>
                <Avatar name={currentMR.author} small />
              </div>
            ))}
          </div>
        ) : (
          <div className="review-tab-content">
            <h2>What changed</h2>
            <p>
              {isOrder
                ? "Moves order status mapping into a dedicated service and fixes the pending to confirmed transition."
                : "Adds bounded payment retries with exponential backoff and persistent idempotency keys."}
            </p>
            <h3>Validation</h3>
            <p>
              Unit and integration checks passed in pipeline #482. Review the
              failure path and duplicate request handling.
            </p>
            <div className="context-strip">
              <button onClick={() => preview("issue", currentMR.issue)}>
                {currentMR.issue}
              </button>
              <button onClick={() => setReviewTab("Changes")}>
                Inspect {currentMR.files} changed files
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  function PipelineContent(id) {
    return (
      <>
        <div className="panel-hero">
          <span className="success">
            <I name="CircleCheck" size={21} /> Pipeline passed
          </span>
          <h2>Pipeline #{id}</h2>
          <p>payment-api · feat/payment-retry · a38f921</p>
        </div>
        <div className="pipeline-stages">
          {[
            "Install dependencies",
            "Lint & typecheck",
            "Unit tests · 128 passed",
            "Integration tests · 24 passed",
            "Build container",
          ].map((s, i) => (
            <div key={s}>
              <I name="CircleCheck" className="success" />
              <span>{s}</span>
              <small>{[18, 12, 38, 94, 42][i]}s</small>
            </div>
          ))}
        </div>
        <div className="panel-section">
          <h3>Deployment</h3>
          <p>Production · Oct 3, 08:32</p>
          <div className="linked-objects">
            <button onClick={() => preview("mr", "376")}>
              <I name="GitPullRequest" size={14} /> !376 Configure connection
              pool
            </button>
            <button
              onClick={() => {
                navigate("Observe", "Logs");
                setLogService("payment-api");
              }}
            >
              <I name="ScrollText" size={14} /> Explore deployment logs
            </button>
          </div>
        </div>
      </>
    );
  }
  function Observe() {
    const view = route.view;
    const filteredLogs = visibleLogs();
    return (
      <div className="page observe-page">
        {sectionHeader(
          view === "Logs" ? "Log explorer" : view,
          "Mock data · Observe integration will be implemented separately.",
          <span className="live-status">
            <span className="live-dot" /> Snapshot · 09:43:00
          </span>,
        )}
        <div className="tabs">
          {["Overview", "Logs", "Dashboards", "Alerts", "Incidents"].map(
            (v) => (
              <button
                key={v}
                className={v === view ? "active" : ""}
                onClick={() => navigate("Observe", v)}
              >
                {v}
                {v === "Alerts" && <span className="count alert-count">2</span>}
              </button>
            ),
          )}
        </div>
        {view === "Logs" ? (
          <>
            <div className="log-filters">
              <select
                aria-label="Environment"
                value={logEnv}
                onChange={(e) => setLogEnv(e.target.value)}
              >
                {["production", "staging", "All environments"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Service"
                value={logService}
                onChange={(e) => setLogService(e.target.value)}
              >
                {[
                  "All services",
                  "payment-api",
                  "order-api",
                  "auth-service",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Time range"
                value={logRange}
                onChange={(e) => setLogRange(e.target.value)}
              >
                {["Last 15 minutes", "Last 5 minutes", "Last hour"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Log level"
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
              >
                {["All levels", "ERROR", "WARN", "INFO"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <Btn
                icon="RotateCw"
                onClick={() =>
                  notify("Loaded the latest available mock snapshot")
                }
              >
                Refresh
              </Btn>
            </div>
            <label className="log-query">
              <I name="Search" />
              <input
                aria-label="Search logs"
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="Search messages, services, or trace IDs…"
              />
              <kbd>Live filter</kbd>
            </label>
            {!!logFilters.length && (
              <div className="filter-chips" aria-label="Field filters">
                {logFilters.map((f) => (
                  <span className="filter-chip" key={f.field + f.value}>
                    <code>
                      {f.field} {f.op === "include" ? "=" : "≠"} {f.value}
                    </code>
                    <button
                      aria-label={`Remove filter ${f.field}`}
                      onClick={() =>
                        setLogFilters((fs) => fs.filter((x) => x !== f))
                      }
                    >
                      <I name="X" size={12} />
                    </button>
                  </span>
                ))}
                <button
                  className="quiet-button"
                  onClick={() => setLogFilters([])}
                >
                  Clear field filters
                </button>
              </div>
            )}
            <div className="log-histogram">
              <div className="histogram-caption">
                <span>{filteredLogs.length} matching events</span>
                <span>
                  <i className="error-dot" /> Errors <i className="warn-dot" />{" "}
                  Warnings <i className="info-dot" /> Info
                </span>
              </div>
              <div className="bars">
                {Array.from({ length: 60 }, (_, i) => {
                  const start = 9 * 3600 + 28 * 60 + i * 15;
                  const entries = filteredLogs.filter((l) => {
                    const [h, m, s] = l.time.split(":").map(Number);
                    const seconds = h * 3600 + m * 60 + s;
                    return seconds >= start && seconds < start + 15;
                  });
                  return (
                    <span
                      key={i}
                      title={`${entries.length} events in this 15-second interval`}
                      style={{
                        height: `${entries.length ? entries.length * 24 : 2}px`,
                        opacity: entries.length ? 1 : 0.25,
                      }}
                    >
                      <i
                        style={{
                          height: `${entries.length ? (entries.filter((l) => l.level === "ERROR").length / entries.length) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  );
                })}
              </div>
              <div className="histogram-time">
                <span>09:28</span>
                <span>09:33</span>
                <span>09:38</span>
                <span>09:43</span>
              </div>
            </div>
            <div className="table-wrap log-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "Timestamp",
                      "Service",
                      "Level",
                      "Message",
                      "Trace ID",
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr
                      key={l.id}
                      className={inspector?.id === l.id ? "selected-row" : ""}
                      onClick={() => preview("log", l.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") preview("log", l.id);
                      }}
                    >
                      <td className="mono">{l.time}</td>
                      <td>{l.service}</td>
                      <td>
                        <span className={"log-level " + l.level.toLowerCase()}>
                          {l.level}
                        </span>
                      </td>
                      <td>{l.message}</td>
                      <td className="mono muted">{l.trace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredLogs.length && (
                <Empty
                  title="No logs match these filters"
                  text="Broaden the time range, or remove a service or level filter."
                />
              )}
            </div>
          </>
        ) : view === "Alerts" ? (
          <div className="alerts-list">
            {[
              [
                "alert-1",
                "Payment API error rate elevated",
                "Error rate 3.8% · threshold 1%",
                "Critical",
                "payment-api",
              ],
              [
                "alert-2",
                "Connection pool utilization high",
                "Utilization 86% · threshold 80%",
                "Warning",
                "payment-api",
              ],
            ].map(([id, title, desc, severity, service]) => (
              <button key={id} onClick={() => preview("alert", id)}>
                <span
                  className={cx(
                    "alert-symbol",
                    severity === "Critical" ? "red" : "amber",
                  )}
                >
                  <I name="TriangleAlert" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <small>{service} · production · Firing since 08:36</small>
                </div>
                <span
                  className={
                    "pill " + (severity === "Critical" ? "red" : "amber")
                  }
                >
                  {severity}
                </span>
                <I name="ChevronRight" />
              </button>
            ))}
          </div>
        ) : view === "Incidents" ? (
          <>
            <div className="view-toolbar">
              <span>{incidents.length} active incidents</span>
              <Btn icon="Plus" onClick={() => openPalette("create-incident")}>
                Create incident
              </Btn>
            </div>
            {incidents.length ? (
              incidents.map((x) => (
                <button
                  className="incident-row"
                  key={x.id}
                  onClick={() => preview("incident", x.id)}
                >
                  <I name="Siren" className="danger-text" />
                  <b>{x.id}</b>
                  <span>{x.title}</span>
                  <span className="pill">{x.status}</span>
                  <I name="ChevronRight" />
                </button>
              ))
            ) : (
              <Empty
                title="No active incidents"
                text="Open a firing alert to create an incident with its logs and deployment context."
                action={
                  <Btn onClick={() => navigate("Observe", "Alerts")}>
                    View alerts
                  </Btn>
                }
              />
            )}
          </>
        ) : (
          <>
            <div className="service-status">
              <div>
                <I name="Activity" size={22} />
                <h2>One service needs attention</h2>
                <p>Payment errors increased after the 08:32 deployment.</p>
              </div>
              <Btn onClick={() => preview("alert", "alert-1")}>
                Investigate payment-api
              </Btn>
            </div>
            {["payment-api", "order-api", "auth-service"].map((s, i) => (
              <button
                className="service-row"
                key={s}
                onClick={() => {
                  setLogService(s);
                  navigate("Observe", "Logs");
                }}
              >
                <span className={cx("service-dot", i === 0 && "degraded")} />
                <strong>{s}</strong>
                <span>{i === 0 ? "Degraded" : "Operational"}</span>
                <span className="muted">
                  {i === 0 ? "3.8%" : "0.02%"} errors
                </span>
                <span className="muted">p95 {i === 0 ? "820" : "124"} ms</span>
                <I name="ChevronRight" />
              </button>
            ))}
            <div className="hint-line">
              Service health is a fixed mock snapshot. Select a service to
              inspect its logs.
            </div>
          </>
        )}
      </div>
    );
  }
  function DocBody({ doc, compact = false }) {
    const content = docContent[doc.id] || {
      callout: "Draft document created in this workspace.",
      intro:
        "Add a decision, implementation plan, or investigation note to share context with your team.",
      section: "Draft outline",
      headers: ["Section", "Purpose", "Status"],
      rows: [
        ["Context", "Why this work matters", "Draft"],
        ["Decision", "Proposed direction", "Draft"],
      ],
      note: "Link related issues and merge requests before publishing.",
      code: "Status: Draft",
    };
    return (
      <article className={cx("document-body", compact && "compact-doc")}>
        <span className="doc-breadcrumb">
          {doc.space} <I name="ChevronRight" size={12} />{" "}
          {doc.id === "retry-policy" ? "Payments" : "Knowledge base"}
        </span>
        <h1>{doc.title}</h1>
        <div className="doc-byline">
          <Avatar name={doc.author} small />
          <span>{doc.author}</span>
          <span>Updated {doc.updated}</span>
          <span className="pill">Published</span>
        </div>
        <div className="doc-callout">
          <I name="Info" size={17} />
          <p>{content.callout}</p>
        </div>
        <h2 id="overview">Overview</h2>
        <p>{content.intro}</p>
        <h2 id="behavior">{content.section}</h2>
        <table>
          <thead>
            <tr>
              {content.headers.map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h2 id="implementation">Implementation notes</h2>
        <p>{content.note}</p>
        <pre>
          <code>{content.code}</code>
        </pre>
        <h2 id="related">Related work</h2>
        <div className="linked-objects">
          <button onClick={() => preview("issue", doc.issue)}>
            <I name="CircleDashed" size={14} />
            {doc.issue}
          </button>
          <button
            onClick={() =>
              preview("mr", doc.issue === "API-128" ? "391" : "381")
            }
          >
            <I name="GitPullRequest" size={14} /> Implementation merge request
          </button>
        </div>
      </article>
    );
  }
  function Docs() {
    const doc = allDocs.find((d) => d.id === docId) || documents[0];
    const filtered = allDocs.filter(
      (d) =>
        (route.view !== "Favorites" || favoriteDocs.includes(d.id)) &&
        d.title.toLowerCase().includes(filter.toLowerCase()),
    );
    return (
      <div className="docs-layout">
        <aside className="doc-tree">
          <div className="tiny-heading">
            Knowledge{" "}
            <button
              className="icon-button"
              aria-label="New document"
              onClick={() => openPalette("create-document")}
            >
              <I name="Plus" size={14} />
            </button>
          </div>
          <label className="search-field">
            <I name="Search" size={14} />
            <input
              placeholder="Find a page…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="doc-tree-tabs">
            {["Home", "Spaces", "Recent", "Favorites"].map((v) => (
              <button
                key={v}
                className={route.view === v ? "active" : ""}
                onClick={() => navigate("Docs", v)}
              >
                {v}
              </button>
            ))}
          </div>
          {["Engineering", "Operations", "Getting started"].map((space) => (
            <div className="doc-space" key={space}>
              <h4>
                <I name="ChevronDown" size={12} />
                <I name="Folder" size={14} />
                {space}
              </h4>
              {filtered
                .filter((d) => d.space === space)
                .map((d) => (
                  <button
                    key={d.id}
                    className={d.id === docId ? "selected" : ""}
                    onClick={() => setDocId(d.id)}
                  >
                    <I name="FileText" size={14} />
                    {d.title}
                  </button>
                ))}
            </div>
          ))}
          {!filtered.length && <p className="muted">No pages found.</p>}
        </aside>
        <div className="doc-content">
          <div className="doc-toolbar">
            <span>
              <I name="CloudCheck" size={14} /> All changes saved
            </span>
            <button
              className="icon-button"
              aria-label="Favorite document"
              onClick={() =>
                setFavoriteDocs((xs) =>
                  xs.includes(doc.id)
                    ? xs.filter((x) => x !== doc.id)
                    : [...xs, doc.id],
                )
              }
            >
              <I
                name="Star"
                className={favoriteDocs.includes(doc.id) ? "starred" : ""}
              />
            </button>
            <Btn icon="Sparkles" onClick={() => setAssistant(true)}>
              Summarize
            </Btn>
          </div>
          <DocBody doc={doc} />
        </div>
        <aside className="doc-outline">
          <div className="tiny-heading">On this page</div>
          {[
            ["overview", "Overview"],
            ["behavior", docContent[doc.id]?.section || "Draft outline"],
            ["implementation", "Implementation notes"],
            ["related", "Related work"],
          ].map(([id, t]) => (
            <button
              key={id}
              onClick={() =>
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {t}
            </button>
          ))}
          <hr />
          <div className="tiny-heading">Connections</div>
          <button onClick={() => preview("issue", doc.issue)}>
            <I name="CircleDashed" size={14} />
            {doc.issue}
          </button>
          <button
            onClick={() =>
              preview("mr", doc.issue === "API-128" ? "391" : "381")
            }
          >
            <I name="GitPullRequest" size={14} /> Linked merge request
          </button>
          <hr />
          <small>
            Confluence · Engineering
            <br />
            Visible to your workspace
          </small>
        </aside>
      </div>
    );
  }
  function Activity() {
    return (
      <div className="activity-feed">
        {[
          {
            name: "Alex Kim",
            verb: "completed",
            object: "API-124",
            time: "Yesterday, 16:42",
            type: "issue",
            id: "API-124",
          },
          {
            name: "Daniel Lee",
            verb: "requested your review on",
            object: "!391 Fix order status mapping",
            time: "Yesterday, 15:20",
            type: "mr",
            id: "391",
          },
          {
            name: "Mina Choi",
            verb: "updated",
            object: "Payment Retry Policy",
            time: "Yesterday, 14:10",
            type: "doc",
            id: "retry-policy",
          },
          {
            name: "Sarah Park",
            verb: "started investigating",
            object: "OPS-91 Production errors",
            time: "Today, 08:45",
            type: "issue",
            id: "OPS-91",
          },
        ].map((a, i) => (
          <div className="activity-entry" key={i}>
            <Avatar name={a.name} />
            <div>
              <p>
                <b>{a.name}</b> {a.verb}{" "}
                <button onClick={() => preview(a.type, a.id)}>
                  {a.object}
                </button>
              </p>
              <small>{a.time}</small>
            </div>
          </div>
        ))}
      </div>
    );
  }
  function Settings() {
    return (
      <div className="page settings-page">
        {sectionHeader("Settings", "Make Worklane work for you.")}
        <div className="tabs">
          {["Integrations", "Notifications", "Workspace", "Preferences"].map(
            (v) => (
              <button
                key={v}
                className={route.view === v ? "active" : ""}
                onClick={() => navigate("Settings", v)}
              >
                {v}
              </button>
            ),
          )}
        </div>
        {route.view === "Integrations" ? (
          <IntegrationSettings
            onChange={() => { advanceAssistantCredentialScope(); advanceCommandCredentialScope(); setConfigVersion((v) => v + 1); }}
          />
        ) : route.view === "Notifications" ? (
          Object.entries(prefs).map(([k, v]) => (
            <div className="setting-row" key={k}>
              <div>
                <h3>
                  {
                    {
                      mentions: "Mentions & comments",
                      reviews: "Review requests",
                      alerts: "Production alerts",
                      digest: "Daily assistant brief",
                    }[k]
                  }
                </h3>
                <p>
                  {k === "digest"
                    ? "Collect non-urgent updates on Home."
                    : "Group related updates to reduce interruptions."}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={v}
                aria-label={k}
                className={cx("toggle", v && "on")}
                onClick={() => setPrefs((p) => ({ ...p, [k]: !v }))}
              >
                <span />
              </button>
            </div>
          ))
        ) : route.view === "Workspace" && workspaceMode === "connected" ? (
          <>
            <div className="setting-row"><div><h3>My workspace</h3><p>Your personal plan and connected tools on this device.</p></div><span className="pill">Connected</span></div>
            <div className="setting-row"><div><h3>Connected services</h3><p>Each service uses its own URL, account permissions and credentials.</p></div><Btn onClick={()=>navigate("Settings","Integrations")}>Manage integrations</Btn></div>
            <div className="setting-row"><div><h3>Local planning</h3><p>{livePlan.tasks.length} tasks and events · {livePlan.favorites.length} saved references. Planning changes do not change external issue status or deadlines.</p></div></div>
            <div className="setting-row"><div><h3>Your data</h3><p>Connection credentials are encrypted by the operating system. Plans, favorites and review drafts are stored locally without encryption.</p></div></div>
          </>
        ) : route.view === "Workspace" ? (
          <>
            <div className="setting-row">
              <div>
                <h3>Acme Engineering</h3>
                <p>Backend & platform · 4 members · Asia/Seoul</p>
              </div>
              <span className="pill">Local prototype</span>
            </div>
            <div className="setting-row">
              <div>
                <h3>Scenario date</h3>
                <p>
                  Friday, October 3, 2025. Fixed for repeatable UX walkthroughs.
                </p>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <h3>Saved prototype data</h3>
                <p>Changes are stored in this browser.</p>
              </div>
              <Btn onClick={() => setActivePop("reset")}>Reset sample data</Btn>
            </div>
            {activePop === "reset" && (
              <div className="confirm-box">
                <p>
                  Reset tasks, reviews, comments, and incidents to the original
                  sample?
                </p>
                <Btn onClick={() => setActivePop(null)}>Cancel</Btn>
                <Btn
                  onClick={() => {
                    setIssues(initialIssues);
                    setMRs(initialMRs);
                    setViewedFiles({});
                    setReviewDrafts({});
                    setReviewEditors({});
                    setLogFilters([]);
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith("orbit-draft-issue-"))
                      .forEach((k) => localStorage.removeItem(k));
                    setComments({});
                    setIncidents([]);
                    setCustomDocs([]);
                    setActivePop(null);
                    notify("Sample data reset");
                  }}
                >
                  Confirm reset
                </Btn>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="setting-row">
              <div>
                <h3>Appearance</h3>
                <p>Comfortable in daylight or after hours.</p>
              </div>
              <div className="segmented">
                {["light", "dark"].map((t) => (
                  <button
                    key={t}
                    className={theme === t ? "selected" : ""}
                    onClick={() => setTheme(t)}
                  >
                    <I name={t === "light" ? "Sun" : "Moon"} size={14} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="shortcut-list">
              {[
                ["Global search", "⌘ / Ctrl K"],
                ["Quick create", "⌘ / Ctrl N"],
                ["Assistant", "⌘ / Ctrl J"],
                ["Show / hide sidebar", "⌘ / Ctrl \\"],
                ["Home", "G then H"],
                ["My work", "G then M"],
                ["Projects", "G then P"],
                ["Code", "G then C"],
                ["Observe", "G then O"],
              ].map(([n, k]) => (
                <div key={n}>
                  {n}
                  <kbd>{k}</kbd>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  function Inspector() {
    if (!inspector) return null;
    const { type, id } = inspector;
    const issue = issues.find((x) => x.id === id);
    const mr = mrs.find((x) => x.id === id);
    const log = logs.find((x) => x.id === id);
    const doc = allDocs.find((x) => x.id === id);
    const event = events.find((x) => x.id === id);
    const incident = incidents.find((x) => x.id === id);
    return (
      <aside
        className={cx("inspector", inspectorExpanded && "expanded")}
        aria-label="Detail inspector"
      >
        <div className="inspector-header">
          <button
            className="icon-button"
            aria-label="Back in inspector"
            onClick={panelBack}
          >
            <I
              name={panelHistory.length ? "ArrowLeft" : "PanelRight"}
              size={16}
            />
          </button>
          <span>
            {type === "issue"
              ? id
              : type === "mr"
                ? `Merge request !${id}`
                : type === "doc"
                  ? "Document preview"
                  : type === "log"
                    ? "Log details"
                    : type === "pipeline"
                      ? `Pipeline #${id}`
                      : type === "member"
                        ? "Member context"
                        : type === "event"
                          ? "Schedule"
                          : type === "incident"
                            ? id
                            : "Alert details"}
          </span>
          <div className="inspector-tools push-right">
            {type === "log" &&
              (() => {
                const results = visibleLogs();
                const index = results.findIndex((l) => l.id === id);
                return (
                  <>
                    <small>
                      {index < 0
                        ? "Outside results"
                        : `${index + 1} / ${results.length}`}
                    </small>
                    <button
                      className="icon-button"
                      aria-label="Previous result"
                      disabled={index <= 0}
                      onClick={() =>
                        setInspector({ type, id: results[index - 1].id })
                      }
                    >
                      <I name="ChevronLeft" size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next result"
                      disabled={index < 0 || index >= results.length - 1}
                      onClick={() =>
                        setInspector({ type, id: results[index + 1].id })
                      }
                    >
                      <I name="ChevronRight" size={14} />
                    </button>
                  </>
                );
              })()}
            <button
              className="icon-button"
              aria-label={
                inspectorExpanded ? "Collapse inspector" : "Expand inspector"
              }
              onClick={() => setInspectorExpanded((x) => !x)}
            >
              <I
                name={inspectorExpanded ? "PanelRight" : "Maximize2"}
                size={14}
              />
            </button>
            <button
              className="icon-button"
              aria-label="Close inspector"
              onClick={closeInspector}
            >
              <I name="X" size={16} />
            </button>
          </div>
        </div>
        <div className="inspector-scroll">
          {type === "issue" && issue ? (
            <>
              <div className="panel-hero">
                <div className="inline">
                  <span className="project-badge">{issue.project}</span>
                  <span className="object-key">{id}</span>
                  <button
                    className="quiet-button push-right"
                    onClick={() => {
                      setAssistant(true);
                    }}
                  >
                    <I name="Sparkles" size={14} /> Ask
                  </button>
                </div>
                <h2>{issue.title}</h2>
              </div>
              <div className="properties">
                {[
                  [
                    "Status",
                    "status",
                    ["Todo", "In Progress", "In Review", "Done"],
                  ],
                  ["Priority", "priority", ["Urgent", "High", "Medium", "Low"]],
                  ["Assignee", "assignee", members.map((m) => m.name)],
                  ["Sprint", "sprint", ["Sprint 24", "Sprint 25", "Backlog"]],
                ].map(([label, key, options]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <select
                      aria-label={`Inspector ${label}`}
                      value={issue[key]}
                      onChange={(e) =>
                        updateIssue(id, { [key]: e.target.value })
                      }
                    >
                      {options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    aria-label="Issue due date"
                    value={issue.due}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateIssue(id, {
                        due: value,
                        day: value
                          ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                              new Date(value + "T12:00:00").getDay()
                            ]
                          : "Backlog",
                      });
                    }}
                  />
                </label>
              </div>
              <div className="panel-section">
                <h3>Description</h3>
                <p>
                  {issue.description ||
                    "Coordinate the implementation with the backend team. Confirm the expected behavior, add coverage, and link the merge request before moving to review."}
                </p>
              </div>
              {issue.subtasks && (
                <div className="panel-section">
                  <h3>
                    Subtasks <span className="count">3</span>
                  </h3>
                  {issue.subtasks.map((s, i) => (
                    <label className="subtask" key={s}>
                      <input
                        type="checkbox"
                        checked={!!issue.subtaskDone?.[i]}
                        onChange={(e) =>
                          updateIssue(id, {
                            subtaskDone: {
                              ...issue.subtaskDone,
                              [i]: e.target.checked,
                            },
                          })
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
              )}
              <div className="panel-section">
                <h3>Connected work</h3>
                <div className="connection-path">
                  <button onClick={() => preview("mr", issue.mr || "381")}>
                    <I name="GitPullRequest" />
                    <div>
                      <small>Merge request</small>
                      <strong>
                        !{issue.mr || "381"}{" "}
                        {mrs.find((m) => m.id === issue.mr)?.title ||
                          "Payment retry handling"}
                      </strong>
                    </div>
                    <I name="ChevronRight" size={13} />
                  </button>
                  <button onClick={() => preview("pipeline", "482")}>
                    <I name="CircleCheck" className="success" />
                    <div>
                      <small>Pipeline</small>
                      <strong>#482 · All checks passed</strong>
                    </div>
                    <I name="ChevronRight" size={13} />
                  </button>
                  <button
                    onClick={() =>
                      preview(
                        "doc",
                        issue.project === "API"
                          ? "order-contract"
                          : "retry-policy",
                      )
                    }
                  >
                    <I name="FileText" />
                    <div>
                      <small>Documentation</small>
                      <strong>
                        {issue.project === "API"
                          ? "Order API v2 contract"
                          : "Payment Retry Policy"}
                      </strong>
                    </div>
                    <I name="ChevronRight" size={13} />
                  </button>
                  <button onClick={() => preview("log", "log-0")}>
                    <I name="ScrollText" />
                    <div>
                      <small>Production</small>
                      <strong>payment-api · Related logs</strong>
                    </div>
                    <I name="ChevronRight" size={13} />
                  </button>
                </div>
              </div>
              <div className="panel-section">
                <div className="section-title">
                  <h3>Activity</h3>
                  <span className="muted">Jira</span>
                </div>
                <div className="small-activity">
                  <Avatar name="Mina Choi" small />
                  <p>
                    <b>Mina</b> linked Payment Retry Policy
                    <small>Yesterday, 14:10</small>
                  </p>
                </div>
                {(comments[id] || []).map((c, i) => (
                  <div className="small-activity" key={i}>
                    <Avatar small />
                    <p>
                      <b>You</b> {c.text}
                      <small>{c.time}</small>
                    </p>
                  </div>
                ))}
                <CommentBox
                  key={id}
                  draftKey={id}
                  onSubmit={(text) => addComment(id, text)}
                />
              </div>
              <div className="panel-bottom-actions">
                <Btn icon="CalendarPlus" onClick={() => schedule(id, "Fri")}>
                  Add to today
                </Btn>
                <Btn onClick={() => schedule(id, "Sat")}>Move to tomorrow</Btn>
              </div>
            </>
          ) : type === "mr" && mr ? (
            <>
              <div className="panel-hero">
                <Status status={mr.status} />
                <h2>{mr.title}</h2>
                <p>
                  {mr.repo} · !{mr.id}
                </p>
                <div className="inline">
                  <Avatar name={mr.author} small />
                  <span>
                    {mr.author} · {mr.updated}
                  </span>
                </div>
              </div>
              <div className="panel-section">
                <h3>At a glance</h3>
                <p>
                  {mr.files} files changed{" "}
                  <span className="success">+{mr.added}</span>{" "}
                  <span className="danger-text">−{mr.removed}</span>
                </p>
                <p>
                  {mr.id === "391"
                    ? "Fixes the pending → confirmed order transition while preserving the v2 response contract."
                    : "Adds explicit failure handling, bounded retries, and test coverage for production edge cases."}
                </p>
                <Btn primary icon="GitPullRequest" onClick={() => review(id)}>
                  Open review workspace
                </Btn>
              </div>
              <div className="panel-section">
                <h3>Context</h3>
                <div className="linked-objects">
                  <button onClick={() => preview("issue", mr.issue)}>
                    <I name="CircleDashed" />
                    {mr.issue} · Linked issue
                  </button>
                  <button onClick={() => preview("pipeline", "482")}>
                    <I name="CircleCheck" className="success" />
                    Pipeline #482 · {mr.ci}
                  </button>
                  <button
                    onClick={() =>
                      preview(
                        "doc",
                        mr.repo === "order-api"
                          ? "order-contract"
                          : "retry-policy",
                      )
                    }
                  >
                    <I name="FileText" />
                    Related technical document
                  </button>
                </div>
              </div>
              <div className="panel-section">
                <h3>Reviewers</h3>
                <div className="inline">
                  <Avatar small />
                  <span>Alex Kim</span>
                  <Status
                    status={
                      mr.status === "Approved" ? "Approved" : "Review requested"
                    }
                  />
                </div>
              </div>
            </>
          ) : type === "doc" && doc ? (
            <>
              <div className="preview-open">
                <Btn
                  icon="Maximize2"
                  onClick={() => {
                    setDocId(id);
                    navigate("Docs", "Home");
                  }}
                >
                  Open document
                </Btn>
              </div>
              <DocBody doc={doc} compact />
            </>
          ) : type === "pipeline" ? (
            PipelineContent(id)
          ) : type === "log" && log ? (
            <>
              <div className="panel-hero">
                <span className={"log-level " + log.level.toLowerCase()}>
                  {log.level}
                </span>
                <h2>{log.service}</h2>
                <p>October 3, 2025 · {log.time}</p>
              </div>
              <div className="panel-section">
                <h3>Full message</h3>
                <pre className="log-message">{log.message}</pre>
              </div>
              <LogEventDetails
                key={id}
                log={log}
                filters={logFilters}
                onFilter={toggleLogFilter}
                onPreview={(logId) => preview("log", logId)}
              />
              <div className="panel-section">
                <h3>Deployment context</h3>
                <div className="linked-objects">
                  <button onClick={() => preview("mr", "376")}>
                    <I name="GitPullRequest" />
                    !376 Configure payment connection pool
                  </button>
                  <button onClick={() => preview("pipeline", "482")}>
                    <I name="Rocket" />
                    Production deploy · 08:32
                  </button>
                  <button onClick={() => preview("issue", "OPS-91")}>
                    <I name="CircleDashed" />
                    OPS-91 · Investigation
                  </button>
                </div>
              </div>
              <div className="panel-section">
                <h3>Related logs</h3>
                <button
                  className="context-object"
                  onClick={() => {
                    toggleLogFilter("trace_id", log.trace, "include");
                  }}
                >
                  <I name="Search" /> Filter by trace {log.trace}
                </button>
              </div>
              <div className="panel-bottom-actions">
                <Btn icon="Sparkles" onClick={() => setAssistant(true)}>
                  Analyze error
                </Btn>
                <Btn icon="Siren" onClick={() => createIncident()}>
                  Create incident
                </Btn>
              </div>
            </>
          ) : type === "alert" ? (
            <>
              <div className="panel-hero">
                <span className="pill red">
                  {id === "alert-1" ? "Critical" : "Warning"} · Firing
                </span>
                <h2>
                  {id === "alert-1"
                    ? "Payment API error rate elevated"
                    : "Connection pool utilization high"}
                </h2>
                <p>payment-api · production</p>
              </div>
              <div className="panel-section">
                <div className="alert-metric">
                  <strong>{id === "alert-1" ? "3.8%" : "86%"}</strong>
                  <span>
                    {id === "alert-1"
                      ? "error rate / 1% threshold"
                      : "utilization / 80% threshold"}
                  </span>
                </div>
                <p>
                  First detected at 08:36, four minutes after the latest
                  production deployment.
                </p>
                <div className="inline">
                  <Avatar name="Sarah Park" small />
                  <span>Sarah Park is investigating</span>
                </div>
              </div>
              <div className="panel-section">
                <h3>Connected timeline</h3>
                <div className="linked-objects">
                  <button onClick={() => preview("mr", "376")}>
                    <I name="GitPullRequest" />
                    08:32 · !376 deployed to production
                  </button>
                  <button onClick={() => preview("log", "log-0")}>
                    <I name="ScrollText" />
                    08:36 · Connection pool timeouts
                  </button>
                  <button onClick={() => preview("issue", "OPS-91")}>
                    <I name="CircleDashed" />
                    08:45 · OPS-91 investigation started
                  </button>
                </div>
              </div>
              <div className="panel-bottom-actions">
                <Btn
                  onClick={() => {
                    setLogService("payment-api");
                    setLogLevel("ERROR");
                    navigate("Observe", "Logs");
                  }}
                >
                  Explore logs
                </Btn>
                <Btn primary icon="Siren" onClick={createIncident}>
                  Create incident
                </Btn>
              </div>
            </>
          ) : type === "incident" && incident ? (
            <>
              <div className="panel-hero">
                <span className="pill red">{incident.status}</span>
                <h2>{incident.title}</h2>
                <p>{id} · payment-api · production</p>
              </div>
              <div className="panel-section">
                <h3>Incident owner</h3>
                <div className="inline">
                  <Avatar name="Sarah Park" />
                  Sarah Park · On call
                </div>
              </div>
              <div className="panel-section">
                <h3>Evidence</h3>
                <div className="linked-objects">
                  <button onClick={() => preview("alert", "alert-1")}>
                    <I name="TriangleAlert" />
                    Payment error rate 3.8%
                  </button>
                  <button onClick={() => preview("log", "log-0")}>
                    <I name="ScrollText" />
                    Connection pool timeout trace
                  </button>
                  <button onClick={() => preview("mr", "376")}>
                    <I name="GitPullRequest" />
                    Latest deployment !376
                  </button>
                  {incident.issue && (
                    <button onClick={() => preview("issue", incident.issue)}>
                      <I name="CircleDashed" />
                      {incident.issue} · Remediation
                    </button>
                  )}
                </div>
              </div>
              <div className="panel-section">
                <h3>Next action</h3>
                <p>
                  Create an assigned remediation issue with this evidence
                  attached.
                </p>
                <Btn
                  primary
                  disabled={!!incident.issue}
                  onClick={() => {
                    const key = "OPS-" + (100 + issues.length);
                    setIssues((xs) => [
                      ...xs,
                      {
                        id: key,
                        title: "Resolve payment connection pool timeouts",
                        description: `Follow-up for ${incident.id}. Investigate pool limits after deploy !376. Evidence: trace a8f16814c2, error rate 3.8%.`,
                        status: "Todo",
                        priority: "Urgent",
                        assignee: "Sarah Park",
                        sprint: "Sprint 24",
                        due: "2025-10-03",
                        day: "Fri",
                        project: "OPS",
                        mr: "376",
                      },
                    ]);
                    setIncidents((xs) =>
                      xs.map((x) => (x.id === id ? { ...x, issue: key } : x)),
                    );
                    notify(`${key} created and assigned to Sarah Park`);
                  }}
                >
                  {incident.issue
                    ? "Issue " + incident.issue + " created"
                    : "Create assigned issue"}
                </Btn>
              </div>
            </>
          ) : type === "member" ? (
            <>
              <div className="panel-hero">
                <Avatar name={id} />
                <h2>{id}</h2>
                <p>{members.find((m) => m.name === id)?.role}</p>
              </div>
              <div className="panel-section">
                <h3>Current work</h3>
                {issues
                  .filter((x) => x.assignee === id && x.status !== "Done")
                  .map((t) => (
                    <button
                      key={t.id}
                      className="member-work"
                      onClick={() => preview("issue", t.id)}
                    >
                      <span className="object-key">{t.id}</span>
                      <strong>{t.title}</strong>
                      <Status status={t.status} />
                    </button>
                  ))}
              </div>
              <div className="panel-section">
                <h3>Merge requests</h3>
                {mrs
                  .filter((m) => m.author === id)
                  .map((m) => (
                    <button
                      className="member-work"
                      key={m.id}
                      onClick={() => preview("mr", m.id)}
                    >
                      !{m.id} {m.title}
                      <Status status={m.status} />
                    </button>
                  ))}
              </div>
              <div className="panel-section">
                <h3>Today’s schedule</h3>
                {events.slice(0, 3).map(eventRow)}
              </div>
            </>
          ) : type === "event" && event ? (
            <>
              <div className="panel-hero">
                <span className="pill">Dooray meeting</span>
                <h2>{event.title}</h2>
                <p>
                  Friday, October 3 · {event.time} – {event.end}
                </p>
              </div>
              <div className="panel-section">
                <h3>Location</h3>
                <p>{event.room}</p>
                <h3>Participants</h3>
                <div className="inline">
                  {members.map((m) => (
                    <Avatar key={m.name} name={m.name} />
                  ))}
                </div>
              </div>
              <div className="panel-section">
                <h3>Agenda</h3>
                <p>
                  {event.id === "planning"
                    ? "Review Sprint 24 progress, resolve blockers, and agree on the next sprint scope."
                    : "Share progress, call out blockers, and coordinate the next steps for payment reliability."}
                </p>
                <div className="linked-objects">
                  <button onClick={() => preview("issue", "PAY-382")}>
                    PAY-382 · Payment retry implementation
                  </button>
                  <button onClick={() => preview("doc", "retry-policy")}>
                    Payment Retry Policy
                  </button>
                </div>
              </div>
              <div className="panel-section">
                <span className="muted">
                  Meeting links are simulated in this prototype.
                </span>
              </div>
            </>
          ) : (
            <Empty
              title="Preview unavailable"
              text="This linked object is outside the sample dataset."
            />
          )}
        </div>
      </aside>
    );
  }
  function createIncident() {
    const existing = incidents.find((x) => x.service === "payment-api");
    if (existing) {
      preview("incident", existing.id);
      return;
    }
    const id = "INC-" + (42 + incidents.length);
    setIncidents((xs) => [
      ...xs,
      {
        id,
        title: "Payment API connection pool exhaustion",
        status: "Investigating",
        service: "payment-api",
        issue: null,
      },
    ]);
    preview("incident", id);
    notify(`${id} created with alert, log, and deployment context`);
  }
  const context = inspector
    ? `${inspector.type} ${inspector.id}`
    : route.view === "Review"
      ? `MR !${selectedMR}`
      : route.section === "Docs"
        ? `Document: ${allDocs.find((x) => x.id === docId)?.title}`
        : `${route.section} / ${route.view}`;
  return (
    <div className={cx("app", collapsed && "sidebar-collapsed", sidebarHidden && "sidebar-hidden")}>
      {!sidebarHidden && <aside className="sidebar" id="workspace-sidebar" aria-label="Workspace navigation">
        <div className="window-controls">
          <span />
          <span />
          <span />
        </div>
        <button
          className="workspace-switcher"
          onClick={() =>
            { setNotifications(false); setActivePop(activePop === "workspace" ? null : "workspace"); }
          }
          aria-label="Workspace switcher"
          aria-expanded={activePop === "workspace"}
          aria-controls="workspace-popover"
        >
          <span className="brand-mark">
            <WorklaneMark size={25} />
          </span>
          {!collapsed && (
            <>
              <span>
                <b>worklane</b>
                <small>{workspaceMode === "connected" ? "My workspace" : "Acme Engineering"}</small>
              </span>
              <I name="ChevronsUpDown" size={13} />
            </>
          )}
        </button>
        {activePop === "workspace" && (
          <div className="workspace-popover" id="workspace-popover" tabIndex={-1}>
            <strong>{workspaceMode === "connected" ? "My workspace" : "Acme Engineering"}</strong>
            <p>{workspaceMode === "connected" ? "Local planning and connected tools" : "Backend & platform"}</p>
            <Btn onClick={() => navigate("Settings", "Workspace")}>
              Workspace settings
            </Btn>
          </div>
        )}
        <button
          className="sidebar-search"
          onClick={() => openPalette("search")}
          aria-label="Global search"
        >
          <I name="Search" size={16} />
          {!collapsed && (
            <>
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </>
          )}
        </button>
        <div className="sidebar-label">{!collapsed ? "Workspace" : "—"}</div>
        <nav>
          {navigation
            .filter((n) => n.name !== "Settings")
            .map((n) => (
              <div key={n.name}>
                <button
                  title={n.name}
                  aria-label={n.name}
                  className={cx(
                    "nav-item",
                    route.section === n.name && "active",
                  )}
                  onClick={() =>
                    navigate(
                      n.name,
                      n.name === "Projects"
                        ? "Issues"
                        : n.name === "Observe"
                          ? "Logs"
                          : undefined,
                    )
                  }
                >
                  <I name={n.icon} size={18} />
                  {!collapsed && (
                    <>
                      <span>{n.name}</span>
                      {n.name === "My Work" && workspaceMode === "demo" && (
                        <span className="nav-count">
                          {
                            issues.filter(
                              (x) =>
                                x.assignee === "Alex Kim" &&
                                x.due === "2025-10-03" &&
                                x.status !== "Done",
                            ).length
                          }
                        </span>
                      )}
                      {n.name === "Code" && workspaceMode === "demo" && (
                        <span className="nav-dot" />
                      )}
                      {n.views.length > 0 && <I name="ChevronDown" size={12} />}
                    </>
                  )}
                </button>
                {!collapsed &&
                  route.section === n.name &&
                  n.views.length > 0 && (
                    <div className="subnav">
                      {n.views.map((v) => (
                        <button
                          key={v}
                          className={route.view === v ? "selected" : ""}
                          onClick={() => navigate(n.name, v)}
                          aria-label={v}
                        >
                          {v}
                          {v === "My Reviews" && workspaceMode === "demo" && (
                            <span>{needsReview.length}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
        </nav>
        {!collapsed && workspaceMode === "demo" && (
          <>
            <div className="sidebar-label favorites-label">
              Favorites
              <button
                className="icon-button"
                aria-label="Open favorites"
                onClick={() => navigate("Docs", "Favorites")}
              >
                <I name="Plus" size={13} />
              </button>
            </div>
            <button
              className="favorite-item"
              onClick={() => {
                setProject("PAY");
                navigate("Projects", "Issues");
              }}
            >
              <span className="project-dot teal" />
              Payment platform
            </button>
            <button
              className="favorite-item"
              onClick={() => {
                setProject("API");
                navigate("Projects", "Issues");
              }}
            >
              <span className="project-dot blue" />
              Order API
            </button>
            <button
              className="favorite-item"
              onClick={() => preview("doc", "retry-policy")}
            >
              <I name="FileText" size={14} />
              Engineering wiki
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="connections-status">
              <div className="connection-icons">
                <span>J</span>
                <span>C</span>
                <span>D</span>
                <span>
                  <I name="Gitlab" size={13} />
                </span>
                <span>
                  <I name="Search" size={13} />
                </span>
              </div>
              <button onClick={() => navigate("Settings", "Integrations")}>
                <span className="live-dot" />
                Integration settings
                <I name="ChevronRight" size={12} />
              </button>
            </div>
          )}
          <button
            className={cx("nav-item", route.section === "Settings" && "active")}
            title="Settings"
            onClick={() => navigate("Settings", "Integrations")}
          >
            <I name="Settings" size={18} />
            {!collapsed && <span>Settings</span>}
          </button>
          <div className="profile-row">
            <button
              onClick={() => workspaceMode === "connected" ? navigate("Settings", "Integrations") : preview("member", "Alex Kim")}
              title={workspaceMode === "connected" ? "Connection accounts" : "Your profile"}
            >
              <Avatar small name={workspaceMode === "connected" ? "You" : "Alex Kim"} />
              {!collapsed && (
                <span>
                  <b>{workspaceMode === "connected" ? "You" : "Alex Kim"}</b>
                  <small>Personal workspace</small>
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>}
      <div className="app-main">
        <header className="topbar">
          <div className="sidebar-controls">
            <button ref={sidebarToggle} className="icon-button"
              aria-label={sidebarHidden ? "Show sidebar" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls="workspace-sidebar" aria-expanded={!sidebarHidden}
              title={sidebarHidden ? "Show sidebar · ⌘ / Ctrl \\" : collapsed ? "Expand sidebar" : "Minimize sidebar"}
              onClick={() => changeSidebar(sidebarHidden ? sidebar.lastVisible : collapsed ? "expanded" : "icons")}>
              <I name={sidebarHidden || collapsed ? "PanelLeftOpen" : "PanelLeftClose"} size={17}/>
            </button>
            <button className="icon-button sidebar-options-trigger" aria-label="Sidebar options"
              aria-expanded={activePop === "sidebar"} aria-controls="sidebar-options"
              title="Sidebar layout" onClick={() => { setNotifications(false); setActivePop(activePop === "sidebar" ? null : "sidebar"); }}>
              <I name="ChevronDown" size={11}/>
            </button>
            {activePop === "sidebar" && <div className="sidebar-options" id="sidebar-options" role="group" aria-label="Sidebar layout" tabIndex={-1}>
              <small>Sidebar</small>
              {[["expanded", "Expanded", "PanelLeftOpen"], ["icons", "Icons only", "PanelLeftClose"], ["hidden", "Hide sidebar", "EyeOff"]].map(([mode, label, icon]) =>
                <button key={mode} aria-pressed={sidebar.mode === mode} onClick={() => changeSidebar(mode)}>
                  <I name={icon} size={15}/><span>{label}</span>{sidebar.mode === mode && <I name="Check" size={13}/>}
                </button>)}
              <kbd>{"⌘ / Ctrl \\ · Show / hide"}</kbd>
            </div>}
          </div>
          <div className="history-controls">
            <button
              className="icon-button"
              aria-label="Go back"
              disabled={historyIndex === 0}
              onClick={() => goHistory(-1)}
            >
              <I name="ChevronLeft" size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Go forward"
              disabled={historyIndex === history.length - 1}
              onClick={() => goHistory(1)}
            >
              <I name="ChevronRight" size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Recently viewed"
              title="Recently viewed"
              aria-expanded={activePop === "recent"}
              aria-controls="recent-popover"
              onClick={() =>
                { setNotifications(false); setActivePop(activePop === "recent" ? null : "recent"); }
              }
            >
              <I name="History" size={15} />
            </button>
          </div>
          <span className="topbar-divider" />
          <div className="breadcrumb">
            <I
              name={navigation.find((n) => n.name === route.section)?.icon}
              size={15}
            />
            <span>{route.section}</span>
            {route.section !== "Home" && (
              <>
                <I name="ChevronRight" size={12} />
                <b>{route.view}</b>
              </>
            )}
          </div>
          <div className="topbar-right">
            {pendingReview && <span className="form-note" role="status">Submitting review…</span>}
            <select
              className="workspace-mode"
              aria-label="Workspace data mode"
              value={workspaceMode}
              disabled={!!pendingReview}
              onChange={(e) => {
                if (reviewNavigationBlocked()) return;
                setWorkspaceMode(e.target.value);
                setInspector(null);
                setPanelHistory([]);
                setLiveContext("");
                setNotifications(false);
                setPalette(null);
                setActivePop(null);
                setShowGuide(false);
                setLiveObject(null);
              }}
            >
              <option value="demo">Demo workspace</option>
              <option value="connected">Connected workspace</option>
            </select>
            <button
              className="icon-button"
              aria-label="Quick create"
              title="Quick create · ⌘ N"
              onClick={() => openPalette("create")}
            >
              <I name="Plus" size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <I name={theme === "light" ? "Moon" : "Sun"} size={16} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              title="Notifications"
              aria-expanded={notifications}
              aria-controls="attention-popover"
              onClick={() => { setActivePop(null); setNotifications(!notifications); }}
            >
              <I name="Bell" size={16} />
              {workspaceMode === "demo" && <i />}
            </button>
            <span className="topbar-divider" />
            <button
              className={cx("assistant-toggle", assistant && "selected")}
              aria-expanded={assistant}
              title="Assistant · ⌘ / Ctrl J"
              onClick={() => setAssistant(!assistant)}
            >
              <AssistantAvatar size={20} /> Assistant <kbd>⌘ J</kbd>
            </button>
          </div>
          {activePop === "recent" && (
            <div className="recent-popover" id="recent-popover" tabIndex={-1}>
              <h3>Recently viewed</h3>
              {workspaceMode === "connected" ? (livePlan.recent.length ? livePlan.recent.map((o,i)=><button key={i} onClick={()=>{openLiveObject(o);setActivePop(null);}}>{o.title}</button>) : <p>No connected items viewed yet.</p>) : recent.length ? (
                recent.map((x) => (
                  <button
                    key={x.type + x.id}
                    onClick={() => {
                      preview(x.type, x.id);
                      setActivePop(null);
                    }}
                  >
                    <I
                      name={
                        x.type === "mr"
                          ? "GitPullRequest"
                          : x.type === "doc"
                            ? "FileText"
                            : "CircleDot"
                      }
                      size={14}
                    />
                    {x.type === "mr" ? "MR !" : ""}
                    {x.type === "doc"
                      ? allDocs.find((d) => d.id === x.id)?.title
                      : x.id}
                  </button>
                ))
              ) : (
                <p>Items you preview will appear here.</p>
              )}
            </div>
          )}
        </header>
        <div className="workspace-body">
          <main
            className={cx("main-content", inspector && "with-inspector")}
            id="main-content"
          >
            {workspaceMode === "connected" &&
            !["Settings", "Observe"].includes(route.section) ? (
              <ConnectedWorkspace
                key={route.section}
                section={route.section}
                view={route.view}
                focusDate={route.planDate}
                focusTaskId={route.taskId}
                focusRequestId={route.focusRequestId}
                configVersion={configVersion}
                onOpen={openLiveObject}
                onContext={setLiveContext}
                onReviewPendingChange={onReviewPendingChange}
                onSettings={() => navigate("Settings", "Integrations")}
                onNavigate={navigate}
              />
            ) : route.section === "Home" ? (
              Home()
            ) : route.section === "My Work" ? (
              MyWork()
            ) : route.section === "Projects" ? (
              Projects()
            ) : route.section === "Code" ? (
              Code()
            ) : route.section === "Observe" ? (
              Observe()
            ) : route.section === "Docs" ? (
              Docs()
            ) : (
              Settings()
            )}
          </main>
          {Inspector()}
          {assistant &&
            (workspaceMode === "connected" ? (
              <ConnectedAssistant
                key={`assistant-${configVersion}`}
                context={
                  liveContext ||
                  JSON.stringify({ section: route.section, view: route.view })
                }
                onClose={() => setAssistant(false)}
                onSettings={() => navigate("Settings", "Integrations")}
              />
            ) : (
              <Assistant
                context={context}
                issueId={
                  inspector?.type === "issue"
                    ? inspector.id
                    : currentMR.issue || "PAY-382"
                }
                onClose={() => setAssistant(false)}
                onPreview={preview}
                onSchedule={schedule}
                onIncident={createIncident}
              />
            ))}
        </div>
        <footer className="statusbar">
          <span>
            <i className="live-dot" />{" "}
            {workspaceMode === "connected"
              ? "Connected workspace"
              : "Demo workspace"}{" "}
            <span className="muted">
              ·{" "}
              {route.section === "Observe"
                ? "Observe uses mock data"
                : workspaceMode === "connected"
                  ? "Service permissions apply"
                  : "Sample data"}
            </span>
          </span>
          <span>
            {workspaceMode === "demo" && <><button onClick={() => setShowGuide(true)}>Product guide</button><span className="status-separator">/</span></>}
            <I name="Command" size={11} /> K to search{" "}
            <span className="status-separator">/</span> G then H for home{" "}
            <span className="status-separator">/</span>
            <button onClick={() => navigate("Settings", "Preferences")}>
              Keyboard shortcuts
            </button>
          </span>
        </footer>
      </div>
      {showGuide && <ProductGuide onClose={()=>setShowGuide(false)} onPick={id=>{setShowGuide(false);requestAnimationFrame(()=>{if(id==="review")review("381");else if(id==="incident")preview("alert","alert-1");else preview("issue","PAY-382");});}}/>}
      {notifications && workspaceMode === "connected" && <ConnectedAttention key={`attention-${configVersion}`} onClose={()=>dismissPopover(true)} onOpen={openLiveObject} onSettings={()=>navigate("Settings","Integrations")}/>}
      {notifications && workspaceMode === "demo" && (
        <div className="notification-popover" id="attention-popover" tabIndex={-1}>
          <div className="section-title">
            <h3>3 things need attention</h3>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => dismissPopover(true)}
            >
              <I name="X" />
            </button>
          </div>
          <button onClick={() => preview("mr", "391")}>
            <I name="GitPullRequest" className="purple-text" />
            <div>
              <b>Your review is requested</b>
              <small>!391 · Daniel Lee · 18h ago</small>
            </div>
          </button>
          <button onClick={() => preview("issue", "PAY-291")}>
            <I name="Clock3" className="amber-text" />
            <div>
              <b>One issue is due tomorrow</b>
              <small>PAY-291 · Webhook signatures</small>
            </div>
          </button>
          <button onClick={() => preview("alert", "alert-1")}>
            <I name="TriangleAlert" className="danger-text" />
            <div>
              <b>Production errors increased</b>
              <small>payment-api · since 08:36</small>
            </div>
          </button>
          <details>
            <summary>11 low-priority updates</summary>
            <p>8 pipeline completions · 2 document edits · 1 sprint update</p>
          </details>
        </div>
      )}
      {liveObject && workspaceMode === "connected" && <ConnectedObjects key={`objects-${configVersion}`} object={liveObject} returnFocusRef={liveObjectFocus} onSettings={()=>navigate("Settings","Integrations")} onClose={()=>setLiveObject(null)}/>}
      {palette && workspaceMode === "connected" && <ConnectedCommands mode={palette} onClose={()=>setPalette(null)} onOpen={openLiveObject} onNavigate={navigate}/>}
      {palette && workspaceMode === "demo" && (
        <Palette
          mode={palette}
          issues={issues}
          mrs={mrs}
          documents={allDocs}
          incidents={incidents}
          onClose={() => setPalette(null)}
          onPreview={preview}
          onCreate={addQuick}
          onNavigate={navigate}
        />
      )}
      <div className={cx("toast", toast && "visible")} role="status">
        <I name="CircleCheck" size={16} />
        {toast}
      </div>
    </div>
  );
}
function Empty({ title, text, action }) {
  return (
    <div className="empty-state">
      <I name="Inbox" size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function logFields(log) {
  return {
    service: log.service,
    level: log.level,
    environment: log.env,
    trace_id: log.trace,
    request_id: log.request,
    host: log.host,
    container: log.service,
    deployment: "v2.18.4",
    duration_ms: 3024,
  };
}
function LogEventDetails({ log, filters, onFilter, onPreview }) {
  const [tab, setTab] = useState("Fields");
  const [search, setSearch] = useState("");
  const fields = logFields(log);
  const stream = logs.filter(
    (l) => l.service === log.service && l.env === log.env,
  );
  const anchor = stream.findIndex((l) => l.id === log.id);
  const surrounding = stream.slice(Math.max(0, anchor - 2), anchor + 3);
  return (
    <div className="panel-section log-event-details">
      <div className="tabs detail-tabs">
        {["Fields", "JSON", "Surrounding logs"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Fields" ? (
        <>
          <input
            className="field-search"
            aria-label="Find log field"
            placeholder="Find a field or value…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <dl className="log-fields interactive-fields">
            {Object.entries(fields)
              .filter(([k, v]) =>
                `${k} ${v}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd title={String(v)}>{v}</dd>
                  <span className="field-actions">
                    <button
                      className="icon-button"
                      title="Filter for this value"
                      aria-label={`Filter for ${k} ${v}`}
                      aria-pressed={filters.some(
                        (f) =>
                          f.field === k && f.value === v && f.op === "include",
                      )}
                      onClick={() => onFilter(k, v, "include")}
                    >
                      <I name="Plus" size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Filter out this value"
                      aria-label={`Filter out ${k} ${v}`}
                      aria-pressed={filters.some(
                        (f) =>
                          f.field === k && f.value === v && f.op === "exclude",
                      )}
                      onClick={() => onFilter(k, v, "exclude")}
                    >
                      <I name="X" size={13} />
                    </button>
                  </span>
                </div>
              ))}
          </dl>
          {!Object.entries(fields).some(([k, v]) =>
            `${k} ${v}`.toLowerCase().includes(search.toLowerCase()),
          ) && <p className="muted">No matching fields.</p>}
          <p className="field-hint">
            + Include · × Exclude · Your search stays in place
          </p>
        </>
      ) : tab === "JSON" ? (
        <pre className="log-json">
          {JSON.stringify(
            {
              timestamp: `2025-10-03T${log.time}`,
              message: log.message,
              ...fields,
            },
            null,
            2,
          )}
        </pre>
      ) : (
        <div data-testid="surrounding-logs" className="surrounding-logs">
          <p className="muted">
            Same service and environment, before and after this event. Main
            search filters are unchanged.
          </p>
          {surrounding.map((l) => (
            <button
              key={l.id}
              className={l.id === log.id ? "anchor-log" : ""}
              onClick={() => onPreview(l.id)}
            >
              <span>
                <code>{l.time}</code>
                <b className={"log-level " + l.level.toLowerCase()}>
                  {l.level}
                </b>
                {l.id === log.id && <small>Selected event</small>}
              </span>
              <p>{l.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function CommentBox({ onSubmit, draftKey }) {
  const [value, setValue] = useState(() =>
    persisted("draft-issue-" + draftKey, ""),
  );
  useEffect(() => {
    localStorage.setItem(
      "orbit-draft-issue-" + draftKey,
      JSON.stringify(value),
    );
  }, [value, draftKey]);
  return (
    <form
      className="comment-box"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit(value);
          setValue("");
        }
      }}
    >
      <textarea
        onKeyDown={(e) => {
          if (
            (e.ctrlKey || e.metaKey) &&
            e.key === "Enter" &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            e.currentTarget.form.requestSubmit();
          }
        }}
        aria-label="Issue comment"
        placeholder="Leave a comment…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Btn type="submit" disabled={!value.trim()}>
        Comment
      </Btn>
    </form>
  );
}
function Assistant({
  context,
  issueId,
  onClose,
  onPreview,
  onSchedule,
  onIncident,
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const logContext = /Observe|log|alert/i.test(context);
  const mrContext = /MR|mr|Review/.test(context);
  const docContext = /Document|doc/.test(context);
  const suggestions = logContext
    ? ["Analyze this error", "Find the related deployment", "Draft an incident"]
    : mrContext
      ? ["Summarize changes", "Find review risks", "Show linked Jira issue"]
      : docContext
        ? ["Summarize this document", "Find related issues"]
        : [
            "Show related merge requests",
            "Add this issue to today",
            "Move this issue to tomorrow",
          ];
  function send(text) {
    if (!text.trim()) return;
    setMessages((ms) => [...ms, { role: "user", text }]);
    setInput("");
    if (/tomorrow|내일|today|오늘|옮겨|넣어/i.test(text)) {
      const day = /tomorrow|내일/.test(text) ? "Sat" : "Fri";
      setPending({ type: "schedule", id: issueId, day });
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          text: `Ready to reschedule ${issueId}. Please confirm the change below.`,
        },
      ]);
    } else if (/incident|인시던트|장애.*생성/i.test(text)) {
      setPending({ type: "incident" });
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          text: "Draft: Payment API connection pool exhaustion. The incident will include the error trace, deployment !376, and Sarah Park as the on-call contact.",
        },
      ]);
    } else {
      const response = logContext
        ? "The timeout indicates connection pool saturation. Errors appeared four minutes after deploy !376. That timing suggests a relationship, but does not establish the cause. Check pool limits and connection release paths before considering a rollback."
        : mrContext
          ? "This change extracts request handling and adds coverage for failure cases. Focus your review on idempotency across retries, non-retryable errors, and whether the worker can process a duplicate request. Pipeline #482 passed; production behavior still needs verification."
          : docContext
            ? "The policy allows up to 3 retries for transient failures with exponential backoff. Validation failures must return immediately. A stable idempotency key prevents duplicate charges. PAY-382 tracks the implementation."
            : "PAY-382 connects the payment retry implementation to MR !381, pipeline #482, and Payment Retry Policy. The merge request is in review and its checks passed. You can inspect any of these without leaving your current screen.";
      setMessages((ms) => [...ms, { role: "assistant", text: response }]);
    }
  }
  return (
    <aside className="assistant-panel" aria-label="Assistant panel">
      <div className="inspector-header">
        <I name="Sparkles" className="purple-text" />
        <strong>Assistant</strong>
        <button
          className="icon-button push-right"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <I name="X" />
        </button>
      </div>
      <div className="assistant-context">
        <I name="Link2" size={13} />
        <span>{context}</span>
        <span className="pill">Context</span>
      </div>
      <div className="assistant-chat">
        {!messages.length && (
          <>
            <div className="assistant-welcome">
              <span className="assistant-orb">
                <I name="Sparkles" size={24} />
              </span>
              <h2>
                A little help,
                <br />
                right where you work.
              </h2>
              <p>
                I can connect the dots, find context, and prepare your next
                step.
              </p>
            </div>
            <div className="permission-tags">
              <span>Read</span>
              <span>Suggest</span>
              <span>Draft</span>
              <span>
                <I name="LockKeyhole" size={10} /> Confirm to execute
              </span>
            </div>
            <div className="assistant-suggestions">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                  <I name="ArrowUpRight" size={13} />
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) => (
          <div className={"chat-message " + m.role} key={i}>
            {m.role === "assistant" && (
              <span>
                <I name="Sparkles" size={13} /> Worklane assistant
              </span>
            )}
            <p>{m.text}</p>
          </div>
        ))}
        {messages.some((m) => m.role === "assistant") && (
          <div className="assistant-source-links">
            <button onClick={() => onPreview("issue", issueId)}>
              <I name="CircleDashed" size={12} />
              {issueId}
            </button>
            <button
              onClick={() =>
                onPreview(
                  "mr",
                  logContext ? "376" : issueId === "API-128" ? "391" : "381",
                )
              }
            >
              <I name="GitPullRequest" size={12} />
              Related MR
            </button>
            <button onClick={() => onPreview("doc", "retry-policy")}>
              <I name="FileText" size={12} />
              Policy
            </button>
          </div>
        )}
        {pending && (
          <div className="assistant-confirm">
            <span className="tiny-label">Confirmation required</span>
            <h3>
              {pending.type === "schedule" ? pending.id : "Create incident"}
            </h3>
            <p>
              {pending.type === "schedule"
                ? `Current schedule → ${pending.day === "Sat" ? "Tomorrow, Oct 4" : "Today, Oct 3"}`
                : "Attach alert, trace, and deployment context."}
            </p>
            <div>
              <Btn
                onClick={() => {
                  setPending(null);
                  setMessages((ms) => [
                    ...ms,
                    {
                      role: "assistant",
                      text: "Cancelled. Nothing was changed.",
                    },
                  ]);
                }}
              >
                Cancel
              </Btn>
              <Btn
                primary
                onClick={() => {
                  if (pending.type === "schedule")
                    onSchedule(pending.id, pending.day);
                  else onIncident();
                  setMessages((ms) => [
                    ...ms,
                    {
                      role: "assistant",
                      text: "Confirmed. Your change has been applied to the local workspace.",
                    },
                  ]);
                  setPending(null);
                }}
              >
                Confirm
              </Btn>
            </div>
          </div>
        )}
      </div>
      <form
        className="assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          aria-label="Ask assistant"
          placeholder="Ask about your work…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <div>
          <span>
            <I name="Paperclip" size={12} /> Current context attached
          </span>
          <button
            className="send-button"
            aria-label="Send to assistant"
            disabled={!input.trim()}
          >
            <I name="ArrowUp" size={16} />
          </button>
        </div>
      </form>
      <p className="assistant-disclaimer">
        Scripted mock responses · No external AI calls
      </p>
    </aside>
  );
}
function Palette({
  mode,
  issues,
  mrs,
  documents,
  incidents,
  onClose,
  onPreview,
  onCreate,
  onNavigate,
}) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState("");
  const [kind, setKind] = useState(
    mode.includes("incident")
      ? "Incident"
      : mode.includes("issue")
        ? "Issue"
        : mode.includes("document")
          ? "Document"
          : "Task",
  );
  const origin = useRef(document.activeElement);
  const create = mode.startsWith("create");
  const all = [
    ...issues.map((x) => ({
      type: "issue",
      id: x.id,
      title: x.title,
      detail: x.id,
      icon: "CircleDashed",
      search: x.id + " " + x.title,
    })),
    ...mrs.map((x) => ({
      type: "mr",
      id: x.id,
      title: x.title,
      detail: `!${x.id} · ${x.repo}`,
      icon: "GitPullRequest",
      search: x.id + " " + x.title + " " + x.issue,
    })),
    ...documents.map((x) => ({
      type: "doc",
      id: x.id,
      title: x.title,
      detail: x.space,
      icon: "FileText",
      search: x.title + " " + x.issue,
    })),
    ...members.map((x) => ({
      type: "member",
      id: x.name,
      title: x.name,
      detail: x.role,
      icon: "User",
      search: x.name,
    })),
    ...["PAY", "API", "OPS"].map((x) => ({
      type: "project",
      id: x,
      title: x + " project",
      detail: "Project",
      icon: "Layers",
      search: x,
    })),
    ...["payment-api", "order-api", "auth-service"].map((x) => ({
      type: "repository",
      id: x,
      title: x,
      detail: "Repository",
      icon: "FolderGit2",
      search: x,
    })),
    {
      type: "log",
      id: "log-0",
      title: "payment-api production logs",
      detail: "Logs · PAY-382",
      icon: "ScrollText",
      search: "payment logs PAY-382",
    },
    ...incidents.map((x) => ({
      type: "incident",
      id: x.id,
      title: x.title,
      detail: x.id,
      icon: "Siren",
      search: x.id + " " + x.title,
    })),
  ];

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = (
    words.length
      ? all.filter((x) =>
          words.every((word) => x.search.toLowerCase().includes(word)),
        )
      : all.slice(0, 5)
  ).slice(0, 24);
  const groups = [...new Set(results.map((r) => r.type))];
  const groupLabels = {
    issue: "Issues & tasks",
    mr: "Merge requests",
    doc: "Documents",
    member: "People",
    project: "Projects",
    repository: "Repositories",
    log: "Logs",
    incident: "Incidents",
  };
  function execute(item) {
    if (item.type === "project")
      onNavigate("Projects", "Issues", { project: item.id });
    else if (item.type === "repository")
      onNavigate("Code", "Repositories", { filter: item.id });
    else onPreview(item.type, item.id);
    onClose();
  }
  function createItem(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    onCreate(query, kind);
    onClose();
  }
  const header = (
    <div className="command-input">
      <I name={create ? "Plus" : "Search"} size={21} />
      {create ? (
        <input
          aria-label="New item title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Give your ${kind.toLowerCase()} a name…`}
        />
      ) : (
        <Command.Input
          aria-label="Global search input"
          placeholder="Search your workspace, or jump to anything…"
          value={query}
          onValueChange={setQuery}
        />
      )}
      <button type="button" className="escape-key" onClick={onClose}>
        esc
      </button>
    </div>
  );
  const footer = (
    <div className="command-footer">
      <span>
        <kbd>↑</kbd>
        <kbd>↓</kbd> to navigate <kbd>↵</kbd> to {create ? "create" : "open"}
      </span>
      <span>
        <I name="Orbit" size={13} /> Worklane
      </span>
    </div>
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="command-overlay" />
        <Dialog.Content
          className="command-palette command-dialog"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (origin.current?.isConnected) origin.current.focus();
          }}
        >
          <Dialog.Title className="sr-only">
            {create ? "Quick create" : "Global search"}
          </Dialog.Title>
          {create ? (
            <form
              onSubmit={createItem}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.nativeEvent.isComposing || e.keyCode === 229)
                )
                  e.preventDefault();
              }}
            >
              {header}
              <div className="create-content">
                <div className="create-types">
                  {["Task", "Issue", "Document", "Incident"].map((k) => (
                    <button
                      type="button"
                      key={k}
                      className={kind === k ? "selected" : ""}
                      onClick={() => setKind(k)}
                    >
                      <I
                        name={
                          {
                            Task: "SquareCheck",
                            Issue: "CircleDot",
                            Document: "FileText",
                            Incident: "Siren",
                          }[k]
                        }
                        size={15}
                      />
                      {k}
                    </button>
                  ))}
                </div>
                <p>
                  Try “Review payment retries tomorrow 2pm”. Existing issue keys
                  will schedule that issue.
                </p>
                <div className="create-destination">
                  <span>
                    <Avatar small /> Alex Kim
                  </span>
                  <span>
                    <I name="Layers" size={13} />
                    {kind === "Task"
                      ? "My work"
                      : kind === "Issue"
                        ? "Payments"
                        : kind === "Document"
                          ? "Engineering"
                          : "Production"}
                  </span>
                  <Btn type="submit" primary disabled={!query.trim()}>
                    Create {kind.toLowerCase()} <kbd>↵</kbd>
                  </Btn>
                </div>
              </div>
              {footer}
            </form>
          ) : (
            <Command
              label="Global search input"
              shouldFilter={false}
              loop
              vimBindings={false}
              value={selection}
              onValueChange={setSelection}
            >
              {header}
              <div className="command-label">
                {query ? "Workspace results" : "Suggested for you"}
                <span>{results.length} results</span>
              </div>
              <Command.List className="command-results">
                {groups.map((group) => (
                  <Command.Group key={group} heading={groupLabels[group]}>
                    {results
                      .filter((r) => r.type === group)
                      .map((r) => (
                        <Command.Item
                          key={r.type + r.id}
                          value={`${r.type}:${r.id}`}
                          onSelect={() => execute(r)}
                          className="command-result"
                        >
                          <span className="result-icon">
                            <I name={r.icon} size={18} />
                          </span>
                          <span>
                            <b>{r.title}</b>
                            <small>{r.detail}</small>
                          </span>
                          <span className="result-type">{r.type}</span>
                          <I name="CornerDownLeft" size={14} />
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
                {!results.length && (
                  <div className="empty-state">
                    <h3>No matching results</h3>
                    <p>
                      Try an issue key, repository, person, or document title.
                    </p>
                  </div>
                )}
              </Command.List>
              {footer}
            </Command>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

createRoot(document.getElementById("root")).render(<App />);
